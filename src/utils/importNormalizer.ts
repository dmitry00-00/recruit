import aliasesData from '@/data/toolAliases.json';
import type { Grade, Currency, WorkFormat, EmploymentType, VacancyStatus } from '@/entities';

// ── Types ────────────────────────────────────────────────────────────────────

export interface NormalizedTool {
  toolId: string;
  years: number;
  confidence: 'exact' | 'fuzzy' | 'unknown';
  rawName: string;
}

export interface NormalizedRequirement {
  toolId: string;
  minYears?: number;
  confidence: 'exact' | 'fuzzy' | 'unknown';
  rawName: string;
}

export interface NormalizedVacancy {
  positionId?: string;
  companyName?: string;
  companyLogoUrl?: string;
  grade?: Grade;
  salaryFrom?: number;
  salaryTo?: number;
  currency?: Currency;
  workFormat?: WorkFormat;
  employmentType?: EmploymentType;
  location?: string;
  status?: VacancyStatus;
  sourceUrl?: string;
  publishedAt?: string;
  notes?: string;
  minRequirements: NormalizedRequirement[];
  maxRequirements: NormalizedRequirement[];
  _warnings: string[];
}

export interface NormalizedWorkEntry {
  companyName: string;
  positionId?: string;
  grade?: Grade;
  startDate?: string;
  endDate?: string;
  isCurrent: boolean;
  salary?: number;
  currency?: Currency;
  responsibilities?: string;
  tools: NormalizedTool[];
  _warnings: string[];
}

export interface NormalizedCandidate {
  firstName?: string;
  lastName?: string;
  middleName?: string;
  email?: string;
  phone?: string;
  telegramHandle?: string;
  linkedinUrl?: string;
  city?: string;
  country?: string;
  positionId?: string;
  workFormat?: WorkFormat | 'any';
  relocate?: boolean;
  salaryExpected?: number;
  currency?: Currency;
  notes?: string;
  workEntries: NormalizedWorkEntry[];
  _warnings: string[];
}

// ── Alias lookup ─────────────────────────────────────────────────────────────

const toolAliases: Record<string, string> = aliasesData.aliases as Record<string, string>;
const positionAliases: Record<string, string> = (aliasesData as Record<string, unknown>)._positionAliases as Record<string, string>;

function normalizeKey(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function resolveToolId(raw: string): { toolId: string; confidence: 'exact' | 'fuzzy' | 'unknown' } {
  const key = normalizeKey(raw);

  if (toolAliases[key]) return { toolId: toolAliases[key], confidence: 'exact' };

  // Fuzzy: try removing version numbers and punctuation
  const stripped = key.replace(/\s*\d+(\.\d+)*\s*/g, '').replace(/[^a-zа-яё\s]/gi, ' ').replace(/\s+/g, ' ').trim();
  if (stripped !== key && toolAliases[stripped]) {
    return { toolId: toolAliases[stripped], confidence: 'fuzzy' };
  }

  // Fuzzy: try matching any alias that starts with our key
  for (const [alias, id] of Object.entries(toolAliases)) {
    if (alias.startsWith(key) || key.startsWith(alias)) {
      return { toolId: id, confidence: 'fuzzy' };
    }
  }

  return { toolId: key, confidence: 'unknown' };
}

export function resolvePositionId(raw: string): { positionId: string; confidence: 'exact' | 'fuzzy' | 'unknown' } {
  const key = normalizeKey(raw);

  if (positionAliases[key]) return { positionId: positionAliases[key], confidence: 'exact' };

  for (const [alias, id] of Object.entries(positionAliases)) {
    if (alias.includes(key) || key.includes(alias)) {
      return { positionId: id, confidence: 'fuzzy' };
    }
  }

  return { positionId: key, confidence: 'unknown' };
}

// ── Enum coercion ─────────────────────────────────────────────────────────────

const GRADE_MAP: Record<string, Grade> = {
  intern:    'intern',    'стажёр': 'intern',   стажер: 'intern',
  junior:    'junior',    джуниор: 'junior',    'джун': 'junior',
  middle:    'middle',    мидл: 'middle',
  senior:    'senior',    сеньор: 'senior',     'сениор': 'senior',
  lead:      'lead',      лид: 'lead',          'тимлид': 'lead',   teamlead: 'lead',
  principal: 'principal', 'принципал': 'principal',
  staff:     'staff',
};

const CURRENCY_MAP: Record<string, Currency> = {
  rub: 'RUB', '₽': 'RUB', руб: 'RUB',
  usd: 'USD', '$': 'USD',
  eur: 'EUR', '€': 'EUR',
  kzt: 'KZT', '₸': 'KZT',
};

const WORK_FORMAT_MAP: Record<string, WorkFormat | 'any'> = {
  office: 'office', офис: 'office', 'в офисе': 'office',
  remote: 'remote', удалённо: 'remote', удаленно: 'remote', 'remote work': 'remote',
  hybrid: 'hybrid', гибрид: 'hybrid', 'гибридный': 'hybrid',
  any: 'any', любой: 'any',
};

const EMPLOYMENT_MAP: Record<string, EmploymentType> = {
  full: 'full', 'full-time': 'full', 'full time': 'full', полная: 'full',
  part: 'part', 'part-time': 'part', 'part time': 'part', частичная: 'part',
  contract: 'contract', контракт: 'contract',
  freelance: 'freelance', фриланс: 'freelance',
};

export function coerceGrade(raw: string | undefined): Grade | undefined {
  if (!raw) return undefined;
  return GRADE_MAP[normalizeKey(raw)];
}

export function coerceCurrency(raw: string | undefined): Currency | undefined {
  if (!raw) return undefined;
  return CURRENCY_MAP[normalizeKey(raw)] as Currency | undefined;
}

export function coerceWorkFormat(raw: string | undefined): WorkFormat | 'any' | undefined {
  if (!raw) return undefined;
  return WORK_FORMAT_MAP[normalizeKey(raw)];
}

export function coerceEmploymentType(raw: string | undefined): EmploymentType | undefined {
  if (!raw) return undefined;
  return EMPLOYMENT_MAP[normalizeKey(raw)];
}

// ── Vacancy normalizer ───────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeVacancy(raw: Record<string, any>): NormalizedVacancy {
  const warnings: string[] = [];

  const posResult = raw.positionId
    ? { positionId: raw.positionId as string, confidence: 'exact' as const }
    : raw.position
    ? resolvePositionId(String(raw.position))
    : null;

  if (posResult?.confidence === 'unknown') {
    warnings.push(`positionId не распознан: "${posResult.positionId}"`);
  }

  const grade = coerceGrade(raw.grade);
  if (raw.grade && !grade) warnings.push(`grade не распознан: "${raw.grade}"`);

  const currency = coerceCurrency(raw.currency) ?? 'RUB';
  const workFormat = coerceWorkFormat(raw.workFormat) as WorkFormat | undefined;
  const employmentType = coerceEmploymentType(raw.employmentType);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const normalizeReqs = (list: any[]): NormalizedRequirement[] =>
    (list ?? []).map((r) => {
      if (r.toolId) return { toolId: r.toolId, minYears: r.minYears, confidence: 'exact' as const, rawName: r.toolId };
      const { toolId, confidence } = resolveToolId(String(r.name ?? r.tool ?? r.skill ?? r));
      if (confidence === 'unknown') warnings.push(`Инструмент не распознан: "${r.name ?? r}"`);
      return { toolId, minYears: r.minYears ?? r.years, confidence, rawName: String(r.name ?? r) };
    });

  return {
    positionId: posResult?.positionId,
    companyName: raw.companyName ?? raw.company,
    companyLogoUrl: raw.companyLogoUrl,
    grade,
    salaryFrom: raw.salaryFrom != null ? Number(raw.salaryFrom) : undefined,
    salaryTo: raw.salaryTo != null ? Number(raw.salaryTo) : undefined,
    currency,
    workFormat,
    employmentType,
    location: raw.location ?? raw.city,
    status: (raw.status as VacancyStatus) ?? 'open',
    sourceUrl: raw.sourceUrl ?? raw.url,
    publishedAt: raw.publishedAt,
    notes: raw.notes ?? raw.description,
    minRequirements: normalizeReqs(raw.minRequirements ?? raw.requirements ?? []),
    maxRequirements: normalizeReqs(raw.maxRequirements ?? raw.minRequirements ?? raw.requirements ?? []),
    _warnings: warnings,
  };
}

// ── Candidate normalizer ─────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeCandidate(raw: Record<string, any>): NormalizedCandidate {
  const warnings: string[] = [];

  const posResult = raw.positionId
    ? { positionId: raw.positionId as string, confidence: 'exact' as const }
    : raw.position
    ? resolvePositionId(String(raw.position))
    : null;

  if (posResult?.confidence === 'unknown') {
    warnings.push(`positionId не распознан: "${posResult.positionId}"`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const normalizeEntry = (e: Record<string, any>): NormalizedWorkEntry => {
    const entryWarnings: string[] = [];
    const posRes = e.positionId
      ? { positionId: e.positionId as string, confidence: 'exact' as const }
      : e.position
      ? resolvePositionId(String(e.position))
      : null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tools: NormalizedTool[] = (e.tools ?? e.skills ?? []).map((t: any) => {
      if (t.toolId) return { toolId: t.toolId, years: t.years ?? 0, confidence: 'exact' as const, rawName: t.toolId };
      const name = String(t.name ?? t.skill ?? t.tool ?? t);
      const { toolId, confidence } = resolveToolId(name);
      if (confidence === 'unknown') entryWarnings.push(`Инструмент не распознан: "${name}"`);
      return { toolId, years: t.years ?? t.experience ?? 0, confidence, rawName: name };
    });

    return {
      companyName: e.companyName ?? e.company ?? '',
      positionId: posRes?.positionId,
      grade: coerceGrade(e.grade),
      startDate: e.startDate,
      endDate: e.endDate ?? undefined,
      isCurrent: e.isCurrent ?? false,
      salary: e.salary != null ? Number(e.salary) : undefined,
      currency: coerceCurrency(e.currency) ?? 'RUB',
      responsibilities: e.responsibilities ?? e.description,
      tools,
      _warnings: entryWarnings,
    };
  };

  return {
    firstName: raw.firstName ?? raw.first_name,
    lastName: raw.lastName ?? raw.last_name,
    middleName: raw.middleName ?? raw.middle_name,
    email: raw.email,
    phone: raw.phone,
    telegramHandle: raw.telegramHandle ?? raw.telegram,
    linkedinUrl: raw.linkedinUrl ?? raw.linkedin,
    city: raw.city,
    country: raw.country,
    positionId: posResult?.positionId,
    workFormat: coerceWorkFormat(raw.workFormat) ?? 'any',
    relocate: raw.relocate ?? false,
    salaryExpected: raw.salaryExpected != null ? Number(raw.salaryExpected) : undefined,
    currency: coerceCurrency(raw.currency) ?? 'RUB',
    notes: raw.notes,
    workEntries: (raw.workEntries ?? raw.experience ?? []).map(normalizeEntry),
    _warnings: warnings,
  };
}
