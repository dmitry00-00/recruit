/**
 * Client-side LLM extraction.
 * Supports Deepseek (via llmService) and editable system prompts stored in localStorage.
 */

import { generateCompletion, extractJSON } from '@/services/llmService';

// ── Default prompts ──────────────────────────────────────────────────────────

export const DEFAULT_VACANCY_PROMPT = `You are a structured data extraction assistant for a recruiting system.
Extract vacancy information from raw text and return ONLY valid JSON, no explanation.

Rules:
- Return ONLY a single JSON object. No markdown, no code blocks, no extra text.
- Omit any field you cannot determine with reasonable confidence.
- "grade" must be one of: intern, junior, middle, senior, lead, principal, staff
- "currency" must be one of: RUB, USD, EUR, KZT — detect from symbols (₽→RUB, $→USD, €→EUR, ₸→KZT)
- "workFormat" must be one of: office, remote, hybrid
- "employmentType" must be one of: full, part, contract, freelance
- "requirements[].name" — use the exact technology/tool name as written in the source text
- "requirements[].minYears" — include only if explicitly stated or clearly implied
- Do NOT invent data. Do NOT add requirements that are not in the source text.
- If salary is written as a range (e.g. "от 300 до 500"), set both salaryFrom and salaryTo.

JSON structure:
{
  "companyName": "string",
  "position": "string — job title as written",
  "grade": "intern|junior|middle|senior|lead|principal|staff",
  "salaryFrom": number,
  "salaryTo": number,
  "currency": "RUB|USD|EUR|KZT",
  "workFormat": "office|remote|hybrid",
  "employmentType": "full|part|contract|freelance",
  "location": "string — city or region",
  "sourceUrl": "string — URL if present",
  "notes": "string — 1-2 sentence summary of key requirements",
  "requirements": [
    { "name": "skill or tool name", "minYears": number }
  ]
}`;

export const DEFAULT_CANDIDATE_PROMPT = `You are a structured data extraction assistant for a recruiting system.
Extract candidate information from a resume or CV and return ONLY valid JSON, no explanation.

Rules:
- Return ONLY a single JSON object. No markdown, no code blocks, no extra text.
- Omit any field you cannot determine with reasonable confidence.
- "grade" per work entry: estimate from job title and seniority keywords.
- "currency" must be one of: RUB, USD, EUR, KZT — detect from symbols (₽→RUB, $→USD, €→EUR, ₸→KZT)
- "workFormat" must be one of: office, remote, hybrid, any
- Dates must be ISO format YYYY-MM-DD. If only month/year is given use the 1st of that month.
- "isCurrent": true if the candidate is still working there (н.в., present, current, по настоящее время, etc.)
- "tools[].name" — use the exact technology/tool name as written in the resume.
- "tools[].years" — years at that specific company for that tool; estimate from date ranges if not explicit.
- Extract ALL technologies, frameworks, languages, tools, platforms mentioned anywhere in the resume.
- "responsibilities" — 1-3 sentence summary of what the candidate did at that company.
- Do NOT invent data. Do NOT add tools that are not mentioned in the source text.

JSON structure:
{
  "firstName": "string",
  "lastName": "string",
  "middleName": "string",
  "email": "string",
  "phone": "string",
  "telegramHandle": "string — @handle",
  "linkedinUrl": "string",
  "city": "string",
  "country": "string",
  "position": "string — desired job title",
  "workFormat": "office|remote|hybrid|any",
  "relocate": boolean,
  "salaryExpected": number,
  "currency": "RUB|USD|EUR|KZT",
  "notes": "string — short candidate summary",
  "workEntries": [
    {
      "companyName": "string",
      "position": "string — job title at this company",
      "grade": "intern|junior|middle|senior|lead|principal|staff",
      "startDate": "YYYY-MM-DD",
      "endDate": "YYYY-MM-DD or null",
      "isCurrent": boolean,
      "salary": number,
      "currency": "RUB|USD|EUR|KZT",
      "responsibilities": "string",
      "tools": [
        { "name": "tool name", "years": number }
      ]
    }
  ]
}`;

// ── Prompt storage ────────────────────────────────────────────────────────────

const KEYS = {
  vacancy:   'llm_prompt_vacancy',
  candidate: 'llm_prompt_candidate',
} as const;

export type PromptType = keyof typeof KEYS;

export function getPrompt(type: PromptType): string {
  return localStorage.getItem(KEYS[type]) ?? (type === 'vacancy' ? DEFAULT_VACANCY_PROMPT : DEFAULT_CANDIDATE_PROMPT);
}

export function setPrompt(type: PromptType, value: string): void {
  if (value.trim() === (type === 'vacancy' ? DEFAULT_VACANCY_PROMPT : DEFAULT_CANDIDATE_PROMPT).trim()) {
    localStorage.removeItem(KEYS[type]);
  } else {
    localStorage.setItem(KEYS[type], value);
  }
}

export function resetPrompt(type: PromptType): void {
  localStorage.removeItem(KEYS[type]);
}

export function isPromptCustomised(type: PromptType): boolean {
  return localStorage.getItem(KEYS[type]) !== null;
}

// ── Extraction ────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function extractVacancyFromText(text: string): Promise<Record<string, any>> {
  const systemPrompt = getPrompt('vacancy');
  const raw = await generateCompletion(text, systemPrompt);
  return JSON.parse(extractJSON(raw));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function extractCandidateFromText(text: string): Promise<Record<string, any>> {
  const systemPrompt = getPrompt('candidate');
  const raw = await generateCompletion(text, systemPrompt);
  return JSON.parse(extractJSON(raw));
}

// Legacy helpers (kept for compatibility)
export function setDeepseekApiKey(key: string): void {
  localStorage.setItem('deepseek_api_key', key);
}
export function getDeepseekApiKey(): string {
  return localStorage.getItem('deepseek_api_key') ?? '';
}
