/**
 * HH.ru public API client.
 *
 * Used for harvesting vacancies into the local DB. The vacancy search endpoint
 * is open (no auth, no key) and returns structured JSON with key_skills,
 * salary, area, schedule, etc. Detail endpoint adds full HTML description and
 * complete `key_skills` list — needed because list responses sometimes return
 * a truncated subset.
 *
 * Rate limit: ~5 rps without auth. We add a small inter-request delay to stay
 * polite. Pagination cap: HH returns max 2000 results per query (page*per_page).
 */

/** In dev the Vite proxy at /hh-api → api.hh.ru bypasses CORS.
 *  In production (no proxy) we fall back to the direct URL. */
const HH_BASE = '/hh-api';

export interface HHSalary {
  from?: number | null;
  to?: number | null;
  currency?: string | null;
  gross?: boolean;
}

export interface HHKeySkill { name: string }
export interface HHIdName { id: string; name: string }
export interface HHEmployer {
  id?: string;
  name: string;
  url?: string;
  logo_urls?: { 90?: string; 240?: string; original?: string };
  alternate_url?: string;
}

export interface HHVacancyListItem {
  id: string;
  name: string;
  area: HHIdName;
  salary?: HHSalary | null;
  employer: HHEmployer;
  schedule?: HHIdName | null;
  employment?: HHIdName | null;
  experience?: HHIdName | null;
  published_at: string;
  alternate_url: string;
  snippet?: { requirement?: string | null; responsibility?: string | null } | null;
  professional_roles?: HHIdName[];
}

export interface HHVacancyDetail extends HHVacancyListItem {
  description: string;            // HTML
  key_skills: HHKeySkill[];
  branded_description?: string;
}

export interface HHSearchResponse {
  items: HHVacancyListItem[];
  found: number;
  pages: number;
  page: number;
  per_page: number;
}

export interface HHSearchParams {
  text: string;
  /** HH.ru `professional_role` IDs (numeric, but accepted as strings/arrays). */
  professionalRoles?: number[];
  /** HH.ru area ID (1=Москва, 2=СПб, 113=Россия). */
  area?: number;
  /** Vacancies published since this ISO date (YYYY-MM-DD). */
  dateFrom?: string;
  /** Page number (0-based). */
  page?: number;
  /** Page size (max 100). */
  perPage?: number;
  /** Search only the title field. Narrower, less noise. */
  searchField?: 'name' | 'company_name' | 'description';
  /** HH.ru experience filter id: noExperience | between1And3 | between3And6 | moreThan6 */
  experience?: 'noExperience' | 'between1And3' | 'between3And6' | 'moreThan6';
  /** Vacancies only — exclude internships if false. */
  onlyWithSalary?: boolean;
}

async function hhGet<T>(path: string, params?: Record<string, string | string[]>): Promise<T> {
  const base = `${window.location.origin}${HH_BASE}${path}`;
  const url = new URL(base);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (Array.isArray(v)) {
        for (const item of v) url.searchParams.append(k, item);
      } else if (v !== undefined && v !== '') {
        url.searchParams.set(k, v);
      }
    }
  }

  const res = await fetch(url.toString(), {
    headers: { 'Accept': 'application/json' },
  });

  if (!res.ok) {
    let detail = '';
    try { detail = await res.text(); } catch { /* ignore */ }
    throw new Error(`HH.ru ${res.status}: ${res.statusText}${detail ? ` — ${detail.slice(0, 120)}` : ''}`);
  }
  return res.json() as Promise<T>;
}

export async function searchVacancies(p: HHSearchParams): Promise<HHSearchResponse> {
  const params: Record<string, string | string[]> = {
    text: p.text,
    per_page: String(Math.min(100, Math.max(1, p.perPage ?? 50))),
    page: String(Math.max(0, p.page ?? 0)),
  };
  if (p.professionalRoles?.length) {
    params.professional_role = p.professionalRoles.map(String);
  }
  if (p.area !== undefined)        params.area = String(p.area);
  if (p.dateFrom)                  params.date_from = p.dateFrom;
  if (p.searchField)               params.search_field = p.searchField;
  if (p.experience)                params.experience = p.experience;
  if (p.onlyWithSalary)            params.only_with_salary = 'true';

  return hhGet<HHSearchResponse>('/vacancies', params);
}

export async function getVacancyDetail(id: string): Promise<HHVacancyDetail> {
  return hhGet<HHVacancyDetail>(`/vacancies/${id}`);
}

/** Sleep N milliseconds — used to politely throttle bulk fetches. */
export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Fetch up to `limit` vacancies for a search, walking pagination as needed.
 * Reports incremental progress via the optional callback. Stops when:
 *   • `limit` reached, or
 *   • API runs out of pages, or
 *   • the cumulative vacancy count exceeds HH's 2000-result cap.
 */
export async function searchVacanciesPaged(
  base: HHSearchParams,
  limit: number,
  onProgress?: (collected: number, total: number) => void,
): Promise<HHVacancyListItem[]> {
  const perPage = Math.min(100, Math.max(10, base.perPage ?? 50));
  const out: HHVacancyListItem[] = [];

  for (let page = 0; out.length < limit; page++) {
    const res = await searchVacancies({ ...base, perPage, page });
    if (!res.items.length) break;

    for (const item of res.items) {
      out.push(item);
      if (out.length >= limit) break;
    }
    onProgress?.(out.length, Math.min(res.found, limit));

    if (page + 1 >= res.pages) break;
    if ((page + 1) * perPage >= 2000) break;       // HH.ru hard cap

    await sleep(350);                              // polite spacing
  }

  return out.slice(0, limit);
}

/**
 * Strip HTML tags from a string. We use a textarea/DOMParser combo to also
 * decode entities. Falls back to a regex strip if DOMParser is unavailable.
 */
export function stripHtml(html: string): string {
  if (!html) return '';
  if (typeof DOMParser !== 'undefined') {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const text = doc.body?.innerText || doc.body?.textContent || '';
    return text.replace(/\n{3,}/g, '\n\n').trim();
  }
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}
