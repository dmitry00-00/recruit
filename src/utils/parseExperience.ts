/**
 * Parse Russian experience strings into total months.
 *
 *   "11 лет 5 месяцев"      → 137
 *   "11 лет"                → 132
 *   "5 месяцев"             →   5
 *   "1 год 1 месяц"         →  13
 *   "22 года"               → 264
 *   "3 года и 5 месяцев"    →  41
 *   "более 5 лет"           →  60   (lower bound — caller should treat as «≥»)
 *
 * English fallback for LinkedIn:
 *   "5 years 3 months"      →  63
 *   "10+ years"             → 120
 */

const RU_YEARS_RE   = /(\d+)\s*(?:лет|год[ауов]?)/i;
const RU_MONTHS_RE  = /(\d+)\s*(?:месяц[аев]?|мес\.?)/i;
const EN_YEARS_RE   = /(\d+)\s*(?:years?|yrs?|y\b)/i;
const EN_MONTHS_RE  = /(\d+)\s*(?:months?|mos?|m\b)/i;

export function parseExperienceMonths(input: string | null | undefined): number | undefined {
  if (!input) return undefined;
  const s = String(input).trim();
  if (!s) return undefined;

  let total = 0;
  let any = false;

  const yearsRu = s.match(RU_YEARS_RE);
  if (yearsRu) { total += Number(yearsRu[1]) * 12; any = true; }
  else {
    const yearsEn = s.match(EN_YEARS_RE);
    if (yearsEn) { total += Number(yearsEn[1]) * 12; any = true; }
  }

  const monthsRu = s.match(RU_MONTHS_RE);
  if (monthsRu) { total += Number(monthsRu[1]); any = true; }
  else {
    const monthsEn = s.match(EN_MONTHS_RE);
    if (monthsEn) { total += Number(monthsEn[1]); any = true; }
  }

  return any ? total : undefined;
}

/** Helper for forming a Date from `monthsAgo` (used for `lastActiveAt` calibrations). */
export function monthsAgoToDate(months: number, now: Date = new Date()): Date {
  const d = new Date(now);
  d.setMonth(d.getMonth() - months);
  return d;
}
