// ── Vacancy Parser — Orchestrates scraping + LLM extraction ──

import { generateCompletion, extractJSON, type LLMStreamCallbacks } from './llmService';
import { fetchPageContent, extractTextFromHTML, detectSourceType, normalizeTelegramUrl, truncateText, type SourceType } from './scraperService';
import { getAllTools } from '@/utils/toolTreeHelpers';

// ── Types ────────────────────────────────────────────────────

export interface ParsedVacancy {
  title: string;
  companyName: string;
  grade: string;
  salaryFrom?: number;
  salaryTo?: number;
  currency: string;
  location?: string;
  workFormat: string;
  employmentType: string;
  description?: string;
  sourceUrl?: string;
  requirements: ParsedRequirement[];
}

export interface ParsedRequirement {
  toolName: string;
  toolId?: string; // Resolved after matching
  minYears?: number;
  isRequired: boolean; // true = MIN, false = MAX only
}

// ── Tool name resolution ─────────────────────────────────────

function buildToolIndex(): Map<string, string> {
  const tools = getAllTools();
  const index = new Map<string, string>();

  for (const tool of tools) {
    // Exact match by name (case-insensitive)
    index.set(tool.name.toLowerCase(), tool.id);
    // Also add aliases if any
    if ('aliases' in tool && Array.isArray(tool.aliases)) {
      for (const alias of tool.aliases) {
        index.set(alias.toLowerCase(), tool.id);
      }
    }
  }

  // Common aliases not in tree
  const extraAliases: Record<string, string> = {
    'js': 't_js',
    'javascript': 't_js',
    'ts': 't_ts',
    'typescript': 't_ts',
    'react.js': 't_react',
    'reactjs': 't_react',
    'react native': 't_reactnative',
    'node': 't_nodejs',
    'node.js': 't_nodejs',
    'nodejs': 't_nodejs',
    'nest': 't_nestjs',
    'nest.js': 't_nestjs',
    'next': 't_nextjs',
    'next.js': 't_nextjs',
    'vue': 't_vue',
    'vue.js': 't_vue',
    'nuxt': 't_nuxt',
    'nuxt.js': 't_nuxt',
    'postgres': 't_postgres',
    'postgresql': 't_postgres',
    'pg': 't_postgres',
    'mongo': 't_mongodb',
    'elasticsearch': 't_elastic',
    'k8s': 't_k8s',
    'kubernetes': 't_k8s',
    'ci/cd': 't_github_actions',
    'github actions': 't_github_actions',
    'gitlab ci': 't_gitlab_ci',
    'gitlab ci/cd': 't_gitlab_ci',
    'aws': 't_aws',
    'gcp': 't_gcp',
    'google cloud': 't_gcp',
    'css3': 't_css',
    'html5': 't_html',
    'scss': 't_sass',
    'sass': 't_sass',
    'tailwind': 't_tailwind',
    'tailwindcss': 't_tailwind',
    'spring boot': 't_springboot',
    'spring framework': 't_spring',
    'django rest framework': 't_django',
    'drf': 't_django',
    'ef core': 't_ef_core',
    'entity framework': 't_ef_core',
    '.net core': 't_dotnet',
    '.net': 't_dotnet',
    'asp.net core': 't_aspnet',
    'asp.net': 't_aspnet',
    'c#': 't_csharp',
    'csharp': 't_csharp',
    'c++': 't_cpp',
    'cpp': 't_cpp',
    'objective-c': 't_objc',
    'obj-c': 't_objc',
    'kotlin coroutines': 't_kotlin_corout',
    'jetpack compose': 't_compose',
    'compose': 't_compose',
    'dagger': 't_dagger',
    'hilt': 't_dagger',
    'dagger/hilt': 't_dagger',
    'android studio': 't_android_studio',
    'xcode': 't_xcode',
    'swiftui': 't_swiftui',
    'rest api': 'st_rest',
    'rest': 'st_rest',
    'restful': 'st_rest',
    'grpc': 'st_grpc',
    'graphql': 't_graphql',
    'websocket': 'st_websocket',
    'websockets': 'st_websocket',
    'oauth': 'st_oauth',
    'oauth2': 'st_oauth',
    'solid': 'st_solid',
    'design patterns': 'st_patterns',
    'паттерны проектирования': 'st_patterns',
    'tdd': 'st_tdd',
    'clean architecture': 'sk_clean_arch',
    'clean code': 'st_clean',
    'ddd': 'sk_ddd',
    'microservices': 'sk_microservices',
    'микросервисы': 'sk_microservices',
    'mvvm': 'sk_mobile_arch',
    'mvp': 'sk_mobile_arch',
    'mvi': 'sk_mobile_arch',
    'viper': 'sk_mobile_arch',
    'highload': 'oc_highload',
    'высоконагруженные': 'oc_highload',
    'agile': 'oc_agile',
    'scrum': 'oc_agile',
    'kanban': 'oc_agile',
    'sql': 'st_sql92',
  };

  for (const [alias, toolId] of Object.entries(extraAliases)) {
    if (!index.has(alias)) {
      index.set(alias, toolId);
    }
  }

  return index;
}

let _toolIndex: Map<string, string> | null = null;

function getToolIndex(): Map<string, string> {
  if (!_toolIndex) _toolIndex = buildToolIndex();
  return _toolIndex;
}

export function resolveToolId(toolName: string): string | undefined {
  const index = getToolIndex();
  const normalized = toolName.toLowerCase().trim();
  return index.get(normalized);
}

function resolveRequirements(reqs: ParsedRequirement[]): ParsedRequirement[] {
  return reqs.map((r) => ({
    ...r,
    toolId: r.toolId || resolveToolId(r.toolName),
  }));
}

// ── LLM Prompt ──────────────────────────────────────────────

const SYSTEM_PROMPT = `Ты — AI-ассистент рекрутера. Твоя задача — извлечь структурированную информацию о вакансиях из текста.

Извлеки данные в формат JSON. Для КАЖДОЙ вакансии в тексте создай объект:

{
  "vacancies": [
    {
      "title": "название должности",
      "companyName": "компания",
      "grade": "intern|junior|middle|senior|lead|principal|staff",
      "salaryFrom": число или null,
      "salaryTo": число или null,
      "currency": "RUB|USD|EUR|KZT",
      "location": "город",
      "workFormat": "office|remote|hybrid",
      "employmentType": "full|part|contract|freelance",
      "description": "краткое описание вакансии (1-2 предложения)",
      "requirements": [
        {
          "toolName": "название технологии/навыка",
          "minYears": число или null,
          "isRequired": true/false
        }
      ]
    }
  ]
}

Правила:
- grade определяй по контексту (опыт 1-2 года = junior, 3-4 = middle, 5+ = senior, тимлид = lead)
- Если зарплата "от 200 000", salaryFrom=200000, salaryTo=null
- Если формат не указан, ставь "office"
- requirements: раздели на обязательные (isRequired=true) и желательные (isRequired=false)
- toolName должен точно совпадать с названием технологии (React, TypeScript, PostgreSQL, Docker и т.д.)
- Если указаны года опыта, заполни minYears
- Всегда возвращай валидный JSON, без комментариев
- Если в тексте несколько вакансий, верни все в массиве`;

function buildUserPrompt(text: string, sourceType: SourceType): string {
  const sourceHint =
    sourceType === 'hh' ? 'Это вакансия с сайта hh.ru.' :
    sourceType === 'habr_career' ? 'Это вакансия с career.habr.com.' :
    sourceType === 'telegram' ? 'Это посты из Telegram-канала с вакансиями.' :
    'Это текст с описанием вакансий.';

  return `${sourceHint}

Извлеки все вакансии из следующего текста и верни JSON:

---
${text}
---

Верни только JSON, без пояснений.`;
}

// ── Main parsing functions ──────────────────────────────────

export interface ParseProgress {
  stage: 'fetching' | 'extracting' | 'parsing' | 'resolving' | 'done' | 'error';
  message: string;
  llmOutput?: string;
}

export async function parseVacanciesFromUrl(
  url: string,
  onProgress?: (progress: ParseProgress) => void,
  streamCallbacks?: LLMStreamCallbacks,
): Promise<ParsedVacancy[]> {
  const sourceType = detectSourceType(url);
  const finalUrl = sourceType === 'telegram' ? normalizeTelegramUrl(url) : url;

  // Step 1: Fetch
  onProgress?.({ stage: 'fetching', message: `Загрузка ${finalUrl}...` });
  const html = await fetchPageContent(finalUrl);

  // Step 2: Extract text
  onProgress?.({ stage: 'extracting', message: 'Извлечение текста из HTML...' });
  let text = extractTextFromHTML(html, sourceType);
  text = truncateText(text);

  if (!text || text.length < 20) {
    throw new Error('Не удалось извлечь текст со страницы. Попробуйте вставить текст вручную.');
  }

  // Step 3: Parse with LLM
  return parsePlainText(text, sourceType, url, onProgress, streamCallbacks);
}

export async function parseVacanciesFromText(
  text: string,
  sourceUrl?: string,
  onProgress?: (progress: ParseProgress) => void,
  streamCallbacks?: LLMStreamCallbacks,
): Promise<ParsedVacancy[]> {
  return parsePlainText(text, 'unknown', sourceUrl, onProgress, streamCallbacks);
}

async function parsePlainText(
  text: string,
  sourceType: SourceType,
  sourceUrl?: string,
  onProgress?: (progress: ParseProgress) => void,
  streamCallbacks?: LLMStreamCallbacks,
): Promise<ParsedVacancy[]> {
  onProgress?.({ stage: 'parsing', message: 'Отправка в LLM для анализа...' });

  const prompt = buildUserPrompt(text, sourceType);
  const rawResponse = await generateCompletion(prompt, SYSTEM_PROMPT, streamCallbacks);

  onProgress?.({ stage: 'resolving', message: 'Обработка результата...', llmOutput: rawResponse });

  // Parse JSON from LLM response
  const jsonStr = extractJSON(rawResponse);
  let parsed: { vacancies: Array<Record<string, unknown>> };

  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new Error('LLM вернула невалидный JSON. Попробуйте ещё раз или отредактируйте текст.');
  }

  if (!parsed.vacancies || !Array.isArray(parsed.vacancies)) {
    // Maybe it returned a single vacancy or just an array
    if (Array.isArray(parsed)) {
      parsed = { vacancies: parsed as unknown as Array<Record<string, unknown>> };
    } else {
      parsed = { vacancies: [parsed] };
    }
  }

  // Step 4: Resolve tool IDs
  const vacancies: ParsedVacancy[] = parsed.vacancies.map((v) => {
    const rawReqs = (v.requirements as Array<Record<string, unknown>>) || [];
    const resolvedReqs = resolveRequirements(
      rawReqs.map((r) => ({
        toolName: String(r.toolName || ''),
        minYears: typeof r.minYears === 'number' ? r.minYears : undefined,
        isRequired: r.isRequired !== false,
      }))
    );

    return {
      title: String(v.title || ''),
      companyName: String(v.companyName || ''),
      grade: normalizeGrade(String(v.grade || 'middle')),
      salaryFrom: typeof v.salaryFrom === 'number' ? v.salaryFrom : undefined,
      salaryTo: typeof v.salaryTo === 'number' ? v.salaryTo : undefined,
      currency: normalizeCurrency(String(v.currency || 'RUB')),
      location: v.location ? String(v.location) : undefined,
      workFormat: normalizeWorkFormat(String(v.workFormat || 'office')),
      employmentType: normalizeEmploymentType(String(v.employmentType || 'full')),
      description: v.description ? String(v.description) : undefined,
      sourceUrl,
      requirements: resolvedReqs,
    };
  });

  onProgress?.({ stage: 'done', message: `Найдено вакансий: ${vacancies.length}` });
  return vacancies;
}

// ── Normalizers ──────────────────────────────────────────────

function normalizeGrade(grade: string): string {
  const map: Record<string, string> = {
    intern: 'intern', стажёр: 'intern', стажер: 'intern',
    junior: 'junior', джуниор: 'junior', 'jun': 'junior',
    middle: 'middle', мидл: 'middle', 'mid': 'middle',
    senior: 'senior', сеньор: 'senior', 'sen': 'senior',
    lead: 'lead', лид: 'lead', тимлид: 'lead', teamlead: 'lead',
    principal: 'principal',
    staff: 'staff',
  };
  return map[grade.toLowerCase()] || 'middle';
}

function normalizeCurrency(currency: string): string {
  const c = currency.toUpperCase();
  if (['RUB', 'USD', 'EUR', 'KZT'].includes(c)) return c;
  if (c.includes('РУБ') || c === '₽') return 'RUB';
  if (c === '$') return 'USD';
  if (c === '€') return 'EUR';
  return 'RUB';
}

function normalizeWorkFormat(format: string): string {
  const f = format.toLowerCase();
  if (f.includes('remote') || f.includes('удал')) return 'remote';
  if (f.includes('hybrid') || f.includes('гибрид')) return 'hybrid';
  return 'office';
}

function normalizeEmploymentType(type: string): string {
  const t = type.toLowerCase();
  if (t.includes('part') || t.includes('частич')) return 'part';
  if (t.includes('contract') || t.includes('контракт')) return 'contract';
  if (t.includes('freelance') || t.includes('фриланс')) return 'freelance';
  return 'full';
}
