/**
 * Converts HH.ru API response objects into our NormalizedVacancy shape.
 *
 * Key responsibilities:
 *   • Map HH currencies (RUR/USD/EUR) → internal Currency enum.
 *   • Map HH `experience` ranges (noExperience .. moreThan6) → Grade.
 *   • Map HH `schedule` (remote/flexible/fullDay/shift/flyInFlyOut) → WorkFormat.
 *   • Map HH `employment` (full/part/project/probation/volunteer) → EmploymentType.
 *   • Resolve `key_skills[].name` to internal toolIds via existing alias map.
 *   • Strip HTML from `description` for the `notes` field.
 *
 * NormalizedVacancy is what the existing import pipeline consumes — preview
 * cards and `addVacancy()` already accept it, so HH-imported entries flow
 * through the same review / edit / save UI as LLM-extracted ones.
 */

import type { Grade, Currency, WorkFormat, EmploymentType } from '@/entities';
import type { HHVacancyDetail, HHVacancyListItem } from '@/services/hhApi';
import { stripHtml } from '@/services/hhApi';
import type { NormalizedVacancy, NormalizedRequirement } from './importNormalizer';
import { resolveToolId } from './importNormalizer';

// ── HH enum mappings ──────────────────────────────────────────

const HH_CURRENCY_MAP: Record<string, Currency> = {
  RUR: 'RUB', RUB: 'RUB',
  USD: 'USD',
  EUR: 'EUR',
  KZT: 'KZT',
};

/**
 * HH `experience` is a range, not a level. We map mid-range to a single
 * representative grade so the vacancy lands in a useful bucket. The user
 * can adjust in preview before saving.
 */
const HH_EXPERIENCE_TO_GRADE: Record<string, Grade> = {
  noExperience:    'junior',
  between1And3:    'middle',
  between3And6:    'senior',
  moreThan6:       'lead',
};

const HH_SCHEDULE_TO_WORKFORMAT: Record<string, WorkFormat> = {
  remote:        'remote',
  flexible:      'hybrid',
  fullDay:       'office',
  shift:         'office',
  flyInFlyOut:   'office',
};

const HH_EMPLOYMENT_TO_TYPE: Record<string, EmploymentType> = {
  full:      'full',
  part:      'part',
  project:   'contract',
  probation: 'contract',
  volunteer: 'freelance',
};

// ── Title-based grade hints ───────────────────────────────────

/**
 * HH `experience` is coarse (4 buckets); the title usually hints the actual
 * grade more precisely (e.g. "Senior Frontend Developer"). When the title
 * contains an unambiguous grade keyword, we prefer it over the experience
 * mapping.
 */
function detectGradeFromTitle(title: string): Grade | undefined {
  const t = title.toLowerCase();
  if (/(intern|стажер|стажёр)/.test(t))                     return 'intern';
  if (/(junior|джун|младш)/.test(t))                        return 'junior';
  if (/(senior|синьор|сеньор|старш)/.test(t))               return 'senior';
  if (/(lead|тимлид|team\s*lead|руководитель)/.test(t))     return 'lead';
  if (/(principal|стафф|staff)/.test(t))                    return 'principal';
  if (/(middle|мидл)/.test(t))                              return 'middle';
  return undefined;
}

// ── Core convert ─────────────────────────────────────────────

export interface HHConvertOptions {
  /** Force-assign positionId (set per-category by the importer). */
  positionId?: string;
  /** Include the full HTML-stripped description in `notes`. Default: true. */
  includeDescription?: boolean;
}

/**
 * Convert an HH.ru vacancy (list-item or detail) into NormalizedVacancy.
 *
 * Detail objects yield richer requirements (full key_skills + description),
 * but list items are usable too — `snippet.requirement` is parsed for tools
 * when the full description isn't available.
 */
export function hhToNormalizedVacancy(
  raw: HHVacancyListItem | HHVacancyDetail,
  opts: HHConvertOptions = {},
): NormalizedVacancy {
  const warnings: string[] = [];
  const isDetail = 'description' in raw && 'key_skills' in raw;

  // Salary
  const salaryFrom = raw.salary?.from ?? undefined;
  const salaryTo   = raw.salary?.to ?? undefined;
  const currency   = raw.salary?.currency
    ? (HH_CURRENCY_MAP[raw.salary.currency.toUpperCase()] ?? 'RUB')
    : 'RUB';

  // Grade — title trumps experience-bucket
  const grade = detectGradeFromTitle(raw.name)
    ?? (raw.experience ? HH_EXPERIENCE_TO_GRADE[raw.experience.id] : undefined);
  if (!grade) warnings.push('Грейд не определён — выставлен middle по умолчанию');

  // Format / employment
  const workFormat = raw.schedule ? HH_SCHEDULE_TO_WORKFORMAT[raw.schedule.id] : undefined;
  const employmentType = raw.employment ? HH_EMPLOYMENT_TO_TYPE[raw.employment.id] : undefined;

  // Skills → requirements
  let requirements: NormalizedRequirement[] = [];
  if (isDetail && (raw as HHVacancyDetail).key_skills?.length) {
    requirements = (raw as HHVacancyDetail).key_skills.map((ks) => {
      const { toolId, confidence } = resolveToolId(ks.name);
      if (confidence === 'unknown') warnings.push(`Не распознан навык: "${ks.name}"`);
      return { toolId, confidence, rawName: ks.name };
    });
  } else {
    // List item — try to mine tools out of the snippet text.
    const snippetText = [raw.snippet?.requirement, raw.snippet?.responsibility]
      .filter(Boolean)
      .join(' ');
    if (snippetText) {
      requirements = mineToolsFromText(snippetText, warnings);
    }
  }

  // Notes — title + responsibility/requirement + (optional) full description
  const notesParts: string[] = [];
  notesParts.push(raw.name);
  if (raw.snippet?.responsibility) notesParts.push(`Обязанности: ${stripHtml(raw.snippet.responsibility)}`);
  if (raw.snippet?.requirement)    notesParts.push(`Требования: ${stripHtml(raw.snippet.requirement)}`);
  if (opts.includeDescription !== false && isDetail) {
    const desc = stripHtml((raw as HHVacancyDetail).description);
    if (desc) notesParts.push(desc);
  }

  return {
    positionId: opts.positionId,
    companyName: raw.employer.name,
    companyLogoUrl: raw.employer.logo_urls?.['90']
      ?? raw.employer.logo_urls?.['240']
      ?? raw.employer.logo_urls?.original,
    grade: grade ?? 'middle',
    salaryFrom,
    salaryTo,
    currency,
    workFormat,
    employmentType,
    location: raw.area?.name,
    status: 'open',
    sourceUrl: raw.alternate_url,
    publishedAt: raw.published_at,
    notes: notesParts.join('\n\n'),
    minRequirements: requirements,
    maxRequirements: requirements,           // HH gives a single skill set; reuse for both
    _warnings: warnings,
  };
}

/**
 * Best-effort tool extraction from free-text snippets. Walks all known
 * aliases and matches on word boundaries. Imperfect but useful when only
 * list items are available and we want to skip a per-vacancy detail fetch.
 */
function mineToolsFromText(text: string, warnings: string[]): NormalizedRequirement[] {
  const seen = new Set<string>();
  const out: NormalizedRequirement[] = [];
  const lower = text.toLowerCase();

  // Split on common separators and try each token.
  const tokens = lower.split(/[,;.\n\r·•|/\\()[\]"]+/).map((t) => t.trim()).filter(Boolean);
  for (const tok of tokens) {
    if (tok.length < 2 || tok.length > 40) continue;
    const { toolId, confidence } = resolveToolId(tok);
    if (confidence === 'unknown') continue;
    if (seen.has(toolId)) continue;
    seen.add(toolId);
    out.push({ toolId, confidence, rawName: tok });
  }

  if (!out.length) warnings.push('Навыки не извлечены из сниппета — нужна детальная загрузка');
  return out;
}
