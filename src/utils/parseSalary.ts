/**
 * Parse salary strings into structured fields.
 *
 * Inputs we handle:
 *   Habr Career:  «От 50 000 ₽»                  → { salaryFrom:50000, currency:'RUB' }
 *                 «От 2000 $ - Рассмотрю предложения»
 *                                                 → { salaryFrom:2000, currency:'USD' }
 *                 «До 100 000 ₽»                  → { salaryTo:100000, currency:'RUB' }
 *                 «100 000 — 150 000 ₽»           → { salaryFrom, salaryTo, currency:'RUB' }
 *                 «Не ищу работу» / «Ищу работу» / «Рассмотрю предложения»  → {}
 *   LinkedIn:     '$80,000 - $120,000/year'       → { salaryFrom:80000, salaryTo:120000,
 *                                                     currency:'USD', salaryPeriod:'year' }
 *                 '$50/hour'                      → { salaryFrom:50, currency:'USD',
 *                                                     salaryPeriod:'hour' }
 *
 * For HH.ru, the API returns a structured object — convert via `hhSalaryToFields`.
 */

import type { Currency, SalaryPeriod } from '@/entities';

export interface ParsedSalary {
  salaryFrom?: number;
  salaryTo?: number;
  currency?: Currency;
  salaryPeriod?: SalaryPeriod;
  salaryGross?: boolean;
}

/** Maps currency symbols / codes (case-insensitive) to our `Currency` type. */
const CURRENCY_TOKENS: Array<[RegExp, Currency]> = [
  [/(?:₽|руб(?:\.|лей|ль)?|rub|rur)\b/i, 'RUB'],
  [/(?:\$|usd)\b/i,                       'USD'],
  [/(?:€|eur|евро)\b/i,                   'EUR'],
  [/(?:₸|kzt|тенге)\b/i,                  'KZT'],
];

const PERIOD_TOKENS: Array<[RegExp, SalaryPeriod]> = [
  [/\/\s*(?:hour|hr|час|ч)\b|per\s+hour|в\s+час/i,   'hour'],
  [/\/\s*(?:year|yr|год|г)\b|per\s+year|в\s+год|annual/i, 'year'],
  [/\/\s*(?:month|mo|месяц|мес)\b|per\s+month|в\s+месяц/i, 'month'],
];

/** Numbers may contain inner spaces ("50 000") or commas ("50,000"). */
const NUMBER_RE = /(\d[\d ,]*\d|\d)/g;

function detectCurrency(s: string): Currency | undefined {
  for (const [re, cur] of CURRENCY_TOKENS) {
    if (re.test(s)) return cur;
  }
  return undefined;
}

function detectPeriod(s: string): SalaryPeriod | undefined {
  for (const [re, period] of PERIOD_TOKENS) {
    if (re.test(s)) return period;
  }
  return undefined;
}

function detectGross(s: string): boolean | undefined {
  if (/gross\b|до\s+налог|до\s+вычет|до\s+ndfl/i.test(s)) return true;
  if (/\bnet\b|на\s+руки|после\s+налог|после\s+вычет/i.test(s)) return false;
  return undefined;
}

function parseNumber(token: string): number | undefined {
  const cleaned = token.replace(/[\s,]/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/** Strip the openToWork tail («- Не ищу работу» etc.) — keep only the salary part. */
function stripOpenToWorkTail(s: string): string {
  return s.replace(/\s*[-—–]\s*(?:не\s*ищу|ищу\s+работ|рассмотрю|not\s*looking|looking\s+for|considering).*$/i, '');
}

export function parseSalaryString(input: string | null | undefined): ParsedSalary {
  if (!input) return {};
  const raw = String(input).trim();
  if (!raw) return {};

  const s = stripOpenToWorkTail(raw);

  const result: ParsedSalary = {};
  const currency = detectCurrency(s);
  if (currency) result.currency = currency;
  const period = detectPeriod(s);
  if (period) result.salaryPeriod = period;
  const gross = detectGross(s);
  if (gross !== undefined) result.salaryGross = gross;

  const numbers = Array.from(s.matchAll(NUMBER_RE))
    .map((m) => parseNumber(m[1]))
    .filter((n): n is number => n !== undefined);

  if (numbers.length === 0) return result;

  const isFromOnly = /\bот\b|\bfrom\b|\bstarting\s+at\b/i.test(s);
  const isToOnly   = /\bдо\b|\bup\s+to\b/i.test(s);

  if (isFromOnly && !isToOnly) {
    result.salaryFrom = numbers[0];
  } else if (isToOnly && !isFromOnly) {
    result.salaryTo = numbers[0];
  } else if (numbers.length >= 2) {
    result.salaryFrom = numbers[0];
    result.salaryTo = numbers[1];
  } else {
    // Single number, no qualifier — treat as exact.
    result.salaryFrom = numbers[0];
    result.salaryTo = numbers[0];
  }

  return result;
}

/**
 * Convert HH.ru API `salary` object to our flat fields.
 * HH currency codes: RUR | USD | EUR | KZT | UZS | BYR | …
 */
export function hhSalaryToFields(
  hh: { from?: number | null; to?: number | null; currency?: string | null; gross?: boolean } | null | undefined,
): ParsedSalary {
  if (!hh) return {};
  const out: ParsedSalary = {};
  if (typeof hh.from === 'number' && hh.from > 0) out.salaryFrom = hh.from;
  if (typeof hh.to   === 'number' && hh.to   > 0) out.salaryTo   = hh.to;
  if (hh.currency) {
    const cur = String(hh.currency).toUpperCase();
    if (cur === 'RUR' || cur === 'RUB') out.currency = 'RUB';
    else if (cur === 'USD' || cur === 'EUR' || cur === 'KZT') out.currency = cur;
  }
  if (typeof hh.gross === 'boolean') out.salaryGross = hh.gross;
  return out;
}
