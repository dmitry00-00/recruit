/**
 * Client-side LLM extraction via Deepseek deepseek-v4-flash.
 * Converts free-form vacancy/resume text → partial canonical JSON.
 */

const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';

export interface LLMConfig {
  apiKey: string;
}

function getLLMConfig(): LLMConfig | null {
  const key = localStorage.getItem('deepseek_api_key');
  if (!key) return null;
  return { apiKey: key };
}

export function setDeepseekApiKey(key: string): void {
  localStorage.setItem('deepseek_api_key', key);
}

export function getDeepseekApiKey(): string {
  return localStorage.getItem('deepseek_api_key') ?? '';
}

// ── Prompts ──────────────────────────────────────────────────────────────────

const VACANCY_SYSTEM_PROMPT = `You are a structured data extraction assistant for a recruiting system.
Extract vacancy information from raw text and return ONLY valid JSON, no explanation.
Use this exact structure (omit fields you cannot determine):
{
  "companyName": "string",
  "position": "string (job title)",
  "grade": "intern|junior|middle|senior|lead|principal|staff",
  "salaryFrom": number,
  "salaryTo": number,
  "currency": "RUB|USD|EUR|KZT",
  "workFormat": "office|remote|hybrid",
  "employmentType": "full|part|contract|freelance",
  "location": "string",
  "sourceUrl": "string",
  "notes": "string (key requirements summary in 1-2 sentences)",
  "requirements": [
    { "name": "skill/tool name", "minYears": number or omit }
  ]
}
Return only JSON. No markdown, no code blocks.`;

const CANDIDATE_SYSTEM_PROMPT = `You are a structured data extraction assistant for a recruiting system.
Extract candidate information from a resume/CV and return ONLY valid JSON, no explanation.
Use this exact structure (omit fields you cannot determine):
{
  "firstName": "string",
  "lastName": "string",
  "middleName": "string",
  "email": "string",
  "phone": "string",
  "telegramHandle": "string (@handle)",
  "linkedinUrl": "string",
  "city": "string",
  "country": "string",
  "position": "string (desired job title)",
  "workFormat": "office|remote|hybrid|any",
  "relocate": boolean,
  "salaryExpected": number,
  "currency": "RUB|USD|EUR|KZT",
  "notes": "string",
  "workEntries": [
    {
      "companyName": "string",
      "position": "string",
      "grade": "intern|junior|middle|senior|lead|principal|staff",
      "startDate": "YYYY-MM-DD",
      "endDate": "YYYY-MM-DD or null",
      "isCurrent": boolean,
      "salary": number,
      "currency": "RUB|USD|EUR|KZT",
      "responsibilities": "string",
      "tools": [
        { "name": "skill/tool name", "years": number }
      ]
    }
  ]
}
For tools/skills, extract all mentioned technologies, frameworks, languages and tools.
For years of experience per tool, estimate from dates if not explicitly stated.
Return only JSON. No markdown, no code blocks.`;

// ── API call ─────────────────────────────────────────────────────────────────

async function callDeepseek(systemPrompt: string, userText: string, apiKey: string): Promise<string> {
  const response = await fetch(DEEPSEEK_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userText },
      ],
      temperature: 0.1,
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Deepseek API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  const content: string = data.choices?.[0]?.message?.content ?? '';

  // Strip any accidental markdown code fences
  return content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
}

// ── Public API ────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function extractVacancyFromText(text: string): Promise<Record<string, any>> {
  const config = getLLMConfig();
  if (!config) throw new Error('Deepseek API key not configured. Set it in Import settings.');

  const json = await callDeepseek(VACANCY_SYSTEM_PROMPT, text, config.apiKey);
  return JSON.parse(json);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function extractCandidateFromText(text: string): Promise<Record<string, any>> {
  const config = getLLMConfig();
  if (!config) throw new Error('Deepseek API key not configured. Set it in Import settings.');

  const json = await callDeepseek(CANDIDATE_SYSTEM_PROMPT, text, config.apiKey);
  return JSON.parse(json);
}
