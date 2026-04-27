/**
 * Client-side LLM extraction.
 * Supports Deepseek (via llmService) and editable system prompts stored in localStorage.
 */

import { generateCompletion, extractJSON } from '@/services/llmService';
import type { PromptDomain } from './promptComposer';
import { composePrompt } from './promptComposer';

// ── Default prompts ──────────────────────────────────────────────────────────

export const DEFAULT_VACANCY_PROMPT = `You are a structured-data extraction assistant for a recruiting system.
Extract the vacancy described in the user message and return a valid JSON object matching the schema below.

RULES — follow strictly:
- NEVER invent or guess. Omit any field not determinable from the source text.
- grade          → intern | junior | middle | senior | lead | principal | staff
- currency       → detect from symbol: ₽=RUB  $=USD  €=EUR  ₸=KZT
- workFormat     → office | remote | hybrid
- employmentType → full | part | contract | freelance
- requirements[].name     → exact spelling from source; do NOT translate or normalise
- requirements[].minYears → only when explicitly stated ("3+ years", "от 3 лет"); omit otherwise
- salaryFrom / salaryTo   → both when source gives a range ("от 300 до 500 тыс")
- positionId     → pick closest from the allowed list in context; do NOT invent IDs
- requirements   → do NOT add tools absent from source text`;

export const DEFAULT_CANDIDATE_PROMPT = `You are a structured-data extraction assistant for a recruiting system.
Extract the candidate described in the user message and return a valid JSON object matching the schema below.

RULES — follow strictly:
- NEVER invent or guess. Omit any field not determinable from the source text.
- currency    → detect from symbol: ₽=RUB  $=USD  €=EUR  ₸=KZT
- workFormat  → office | remote | hybrid | any
- Dates       → ISO YYYY-MM-DD; if only month/year given, use the 1st of that month
- isCurrent   → true when end date is н.в. / present / current / по настоящее время or absent for the latest entry
- grade       → estimate from job title and seniority keywords (intern/junior/middle/senior/lead)
- tools[].name  → exact spelling from source; do NOT translate or normalise
- tools[].years → years at that company; estimate from date range if not stated explicitly
- tools         → extract ALL technologies, frameworks, languages, tools, platforms mentioned anywhere
- responsibilities → 1-3 sentence summary of what the candidate did at that company
- positionId    → pick closest from the allowed list in context; do NOT invent IDs
- Russian names "Фамилия Имя Отчество" → first token=lastName, second=firstName, third=middleName`;

// ── Prompt storage ────────────────────────────────────────────────────────────

const KEYS = {
  vacancy:   'llm_prompt_vacancy',
  candidate: 'llm_prompt_candidate',
} as const;

const DOMAIN_KEYS = {
  vacancy:   'llm_prompt_domain_vacancy',
  candidate: 'llm_prompt_domain_candidate',
} as const;

export type PromptType = keyof typeof KEYS;

export function getPromptDomain(type: PromptType): PromptDomain {
  const stored = localStorage.getItem(DOMAIN_KEYS[type]);
  return (stored as PromptDomain) || 'any';
}

export function setPromptDomain(type: PromptType, domain: PromptDomain): void {
  if (domain === 'any') {
    localStorage.removeItem(DOMAIN_KEYS[type]);
  } else {
    localStorage.setItem(DOMAIN_KEYS[type], domain);
  }
}

/**
 * Effective system prompt:
 *   1) full custom override saved by the user, if any
 *   2) otherwise composed from base rules + selected domain templates
 */
export function getPrompt(type: PromptType): string {
  const override = localStorage.getItem(KEYS[type]);
  if (override !== null) return override;
  return composePrompt(type, getPromptDomain(type));
}

export function getDefaultPrompt(type: PromptType): string {
  return composePrompt(type, getPromptDomain(type));
}

export function setPrompt(type: PromptType, value: string): void {
  const composed = composePrompt(type, getPromptDomain(type));
  if (value.trim() === composed.trim()) {
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
  const raw = await generateCompletion(text, getPrompt('vacancy'), undefined, true);
  return JSON.parse(extractJSON(raw));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function extractCandidateFromText(text: string): Promise<Record<string, any>> {
  const raw = await generateCompletion(text, getPrompt('candidate'), undefined, true);
  return JSON.parse(extractJSON(raw));
}

// Legacy helpers (kept for compatibility)
export function setDeepseekApiKey(key: string): void {
  localStorage.setItem('deepseek_api_key', key);
}
export function getDeepseekApiKey(): string {
  return localStorage.getItem('deepseek_api_key') ?? '';
}
