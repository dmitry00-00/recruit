// ── Resume Parser — LLM-based extraction of candidate data ──

import { generateCompletion, extractJSON, type LLMStreamCallbacks } from './llmService';
import { resolveToolId } from './vacancyParser';

// ── Types ────────────────────────────────────────────────────

export interface ParsedWorkEntry {
  companyName: string;
  position: string;
  grade: string;
  startDate?: string; // YYYY-MM-DD
  endDate?: string;
  isCurrent: boolean;
  salary?: number;
  currency: string;
  tools: Array<{ toolName: string; toolId?: string; years: number }>;
}

export interface ParsedCandidate {
  firstName: string;
  lastName: string;
  middleName?: string;
  email?: string;
  phone?: string;
  telegramHandle?: string;
  city?: string;
  country?: string;
  workFormat: string;
  relocate: boolean;
  salaryExpected?: number;
  currency: string;
  notes?: string;
  workEntries: ParsedWorkEntry[];
}

export interface ResumeParseProgress {
  stage: 'reading' | 'parsing' | 'resolving' | 'done' | 'error';
  message: string;
  current?: number;
  total?: number;
}

// ── File reading ─────────────────────────────────────────────

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error(`Не удалось прочитать файл: ${file.name}`));
    reader.readAsText(file);
  });
}

export async function readFileContent(file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase();

  if (['txt', 'md', 'csv', 'json', 'html', 'htm'].includes(ext || '')) {
    return readFileAsText(file);
  }

  if (ext === 'pdf') {
    // PDF: read as text, LLM will handle raw content
    // For proper PDF parsing, a library like pdf.js would be needed
    // For now, try reading as text (works for text-based PDFs)
    try {
      return await readFileAsText(file);
    } catch {
      return `[PDF файл: ${file.name}, ${(file.size / 1024).toFixed(1)} KB — вставьте текст резюме вручную]`;
    }
  }

  if (['doc', 'docx', 'rtf'].includes(ext || '')) {
    // For doc/docx, try reading as text (basic fallback)
    try {
      return await readFileAsText(file);
    } catch {
      return `[Документ: ${file.name}, ${(file.size / 1024).toFixed(1)} KB — вставьте текст резюме вручную]`;
    }
  }

  return readFileAsText(file);
}

// ── Strip HTML ───────────────────────────────────────────────

function stripHtml(text: string): string {
  if (!text.includes('<') || !text.includes('>')) return text;
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, 'text/html');
  doc.querySelectorAll('script,style,svg,noscript').forEach((el) => el.remove());
  return doc.body?.textContent || text;
}

// ── LLM Prompt ──────────────────────────────────────────────

const SYSTEM_PROMPT = `Ты — AI-ассистент рекрутера. Твоя задача — извлечь структурированную информацию о кандидате из текста резюме.

Извлеки данные в формат JSON:

{
  "candidates": [
    {
      "firstName": "Имя",
      "lastName": "Фамилия",
      "middleName": "Отчество или null",
      "email": "email или null",
      "phone": "телефон или null",
      "telegramHandle": "@handle или null",
      "city": "город",
      "country": "страна",
      "workFormat": "office|remote|hybrid|any",
      "relocate": false,
      "salaryExpected": число или null,
      "currency": "RUB|USD|EUR",
      "notes": "краткое резюме кандидата (1-2 предложения)",
      "workEntries": [
        {
          "companyName": "название компании",
          "position": "должность (frontend|backend|fullstack|android|ios|devops|qa|analyst|designer|pm|data|1c|другое)",
          "grade": "intern|junior|middle|senior|lead",
          "startDate": "YYYY-MM-DD",
          "endDate": "YYYY-MM-DD или null если текущее место",
          "isCurrent": true/false,
          "salary": число или null,
          "currency": "RUB",
          "tools": [
            {
              "toolName": "название технологии",
              "years": число (лет опыта с этим инструментом на этом месте)
            }
          ]
        }
      ]
    }
  ]
}

Правила:
- Если в тексте несколько резюме (разделены линиями, заголовками и т.п.), верни несколько кандидатов
- grade определяй по контексту: стажировка = intern, 0-1 год = junior, 2-3 = middle, 4-5 = senior, тимлид = lead
- position: приведи к одному из типов (frontend, backend, fullstack, android, ios, devops, qa, analyst, designer, pm, data, 1c)
- tools.years — оцени исходя из длительности работы на данном месте и контекста
- Если дата начала/окончания неизвестна точно, укажи приблизительно (начало года/месяца)
- workFormat: если не указан, ставь "any"
- Всегда возвращай валидный JSON, без комментариев`;

function buildUserPrompt(text: string): string {
  return `Извлеки данные кандидата(ов) из следующего резюме и верни JSON:

---
${text}
---

Верни только JSON, без пояснений.`;
}

// ── Position resolver ────────────────────────────────────────

function resolvePositionId(position: string): string {
  const p = position.toLowerCase();
  if (p.includes('android')) return 'pos_android';
  if (p.includes('ios')) return 'pos_ios';
  if (p.includes('fullstack') || p.includes('full-stack') || p.includes('фулстек')) return 'pos_fullstack';
  if (p.includes('frontend') || p.includes('фронтенд') || p.includes('front-end')) return 'pos_frontend';
  if (p.includes('backend') || p.includes('бэкенд') || p.includes('back-end')) return 'pos_backend';
  if (p.includes('devops') || p.includes('sre')) return 'pos_devops';
  if (p.includes('qa') || p.includes('тестировщик')) return 'pos_qa_auto';
  if (p.includes('analyst') || p.includes('аналитик')) return 'pos_analyst_sys';
  if (p.includes('designer') || p.includes('дизайнер')) return 'pos_designer';
  if (p.includes('pm') || p.includes('product manager') || p.includes('продакт')) return 'pos_pm';
  if (p.includes('data') || p.includes('ml')) return 'pos_data_engineer';
  if (p.includes('1с') || p.includes('1c')) return 'pos_1c_dev';
  return 'pos_backend';
}

// ── Main parse function ──────────────────────────────────────

export async function parseResumesFromText(
  text: string,
  onProgress?: (progress: ResumeParseProgress) => void,
  streamCallbacks?: LLMStreamCallbacks,
): Promise<ParsedCandidate[]> {
  const cleanText = stripHtml(text).slice(0, 15000);

  onProgress?.({ stage: 'parsing', message: 'Отправка в LLM для анализа резюме...' });

  const prompt = buildUserPrompt(cleanText);
  const rawResponse = await generateCompletion(prompt, SYSTEM_PROMPT, streamCallbacks);

  onProgress?.({ stage: 'resolving', message: 'Обработка результата...' });

  const jsonStr = extractJSON(rawResponse);
  let parsed: { candidates: Array<Record<string, unknown>> };

  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new Error('LLM вернула невалидный JSON. Попробуйте ещё раз.');
  }

  if (!parsed.candidates || !Array.isArray(parsed.candidates)) {
    if (Array.isArray(parsed)) {
      parsed = { candidates: parsed as unknown as Array<Record<string, unknown>> };
    } else {
      parsed = { candidates: [parsed] };
    }
  }

  const candidates: ParsedCandidate[] = parsed.candidates.map((c) => {
    const rawEntries = (c.workEntries as Array<Record<string, unknown>>) || [];

    const workEntries: ParsedWorkEntry[] = rawEntries.map((we) => {
      const rawTools = (we.tools as Array<Record<string, unknown>>) || [];
      const tools = rawTools.map((t) => {
        const toolName = String(t.toolName || '');
        return {
          toolName,
          toolId: resolveToolId(toolName),
          years: typeof t.years === 'number' ? t.years : 0,
        };
      });

      return {
        companyName: String(we.companyName || ''),
        position: String(we.position || 'backend'),
        grade: normalizeGrade(String(we.grade || 'middle')),
        startDate: we.startDate ? String(we.startDate) : undefined,
        endDate: we.endDate ? String(we.endDate) : undefined,
        isCurrent: we.isCurrent === true,
        salary: typeof we.salary === 'number' ? we.salary : undefined,
        currency: String(we.currency || 'RUB'),
        tools,
      };
    });

    return {
      firstName: String(c.firstName || ''),
      lastName: String(c.lastName || ''),
      middleName: c.middleName ? String(c.middleName) : undefined,
      email: c.email ? String(c.email) : undefined,
      phone: c.phone ? String(c.phone) : undefined,
      telegramHandle: c.telegramHandle ? String(c.telegramHandle) : undefined,
      city: c.city ? String(c.city) : undefined,
      country: c.country ? String(c.country) : undefined,
      workFormat: normalizeWorkFormat(String(c.workFormat || 'any')),
      relocate: c.relocate === true,
      salaryExpected: typeof c.salaryExpected === 'number' ? c.salaryExpected : undefined,
      currency: String(c.currency || 'RUB'),
      notes: c.notes ? String(c.notes) : undefined,
      workEntries,
    };
  });

  onProgress?.({ stage: 'done', message: `Найдено кандидатов: ${candidates.length}` });
  return candidates;
}

export async function parseResumesFromFiles(
  files: File[],
  onProgress?: (progress: ResumeParseProgress) => void,
  streamCallbacks?: LLMStreamCallbacks,
): Promise<ParsedCandidate[]> {
  const allCandidates: ParsedCandidate[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    onProgress?.({
      stage: 'reading',
      message: `Чтение файла ${file.name} (${i + 1}/${files.length})...`,
      current: i + 1,
      total: files.length,
    });

    const content = await readFileContent(file);
    if (!content || content.length < 20) continue;

    const candidates = await parseResumesFromText(
      content,
      (p) => {
        onProgress?.({
          ...p,
          message: `[${i + 1}/${files.length}] ${file.name}: ${p.message}`,
          current: i + 1,
          total: files.length,
        });
      },
      streamCallbacks,
    );

    allCandidates.push(...candidates);
  }

  onProgress?.({
    stage: 'done',
    message: `Обработано файлов: ${files.length}, найдено кандидатов: ${allCandidates.length}`,
    current: files.length,
    total: files.length,
  });

  return allCandidates;
}

// ── Helpers for saving ───────────────────────────────────────

export function parsedCandidateToStoreFormat(c: ParsedCandidate) {
  const candidateData = {
    firstName: c.firstName,
    lastName: c.lastName,
    middleName: c.middleName,
    email: c.email,
    phone: c.phone,
    telegramHandle: c.telegramHandle,
    city: c.city,
    country: c.country,
    workFormat: (c.workFormat || 'any') as 'office' | 'remote' | 'hybrid' | 'any',
    relocate: c.relocate,
    salaryExpected: c.salaryExpected,
    currency: (c.currency || 'RUB') as 'RUB' | 'USD' | 'EUR' | 'KZT',
    notes: c.notes,
  };

  const workEntries = c.workEntries
    .filter((we) => we.companyName)
    .map((we) => ({
      companyName: we.companyName,
      positionId: resolvePositionId(we.position),
      grade: (we.grade || 'middle') as 'intern' | 'junior' | 'middle' | 'senior' | 'lead' | 'principal' | 'staff',
      startDate: we.startDate ? new Date(we.startDate) : new Date(),
      endDate: we.endDate ? new Date(we.endDate) : undefined,
      isCurrent: we.isCurrent,
      tools: we.tools
        .filter((t) => t.toolId)
        .map((t) => ({ toolId: t.toolId!, years: t.years })),
      salary: we.salary,
      currency: (we.currency || 'RUB') as 'RUB' | 'USD' | 'EUR' | 'KZT',
    }));

  return { candidateData, workEntries };
}

// ── Normalizers ──────────────────────────────────────────────

function normalizeGrade(grade: string): string {
  const map: Record<string, string> = {
    intern: 'intern', стажёр: 'intern', стажер: 'intern',
    junior: 'junior', джуниор: 'junior',
    middle: 'middle', мидл: 'middle',
    senior: 'senior', сеньор: 'senior',
    lead: 'lead', лид: 'lead', тимлид: 'lead', teamlead: 'lead',
    principal: 'principal',
    staff: 'staff',
  };
  return map[grade.toLowerCase()] || 'middle';
}

function normalizeWorkFormat(format: string): string {
  const f = format.toLowerCase();
  if (f.includes('remote') || f.includes('удал')) return 'remote';
  if (f.includes('hybrid') || f.includes('гибрид')) return 'hybrid';
  if (f.includes('office') || f.includes('офис')) return 'office';
  return 'any';
}
