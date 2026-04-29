/**
 * HH.ru parser — category configuration.
 *
 * Maps user-facing categories (developer/analyst/qa with sub-roles) to
 * HH.ru API search parameters and to internal `positionId`s in our system.
 *
 * `positionId` points to an existing entry in `defaultPositions.json` —
 * imported vacancies will appear under that position template. If a 1:1
 * match doesn't exist (e.g. blockchain has no dedicated position), we
 * pick the closest fit; the user can re-assign the position later in the
 * preview step before saving.
 *
 * `defaultAliases` — list of search queries passed one-by-one to HH.ru's
 * `text=` filter. Each alias produces an independent search; results are
 * merged and deduplicated by HH id within a category. Users can override
 * this list per category through the importer UI; overrides are persisted
 * in `localStorage`.
 *
 * `professionalRoles` — HH.ru `professional_role` IDs (numeric). Optional
 * but improves precision when present. Source: HH.ru `/professional_roles`
 * dictionary. We only list IDs we are confident about.
 */

export type HHGroupId = 'developer' | 'analyst' | 'qa';

export interface HHCategory {
  id: string;
  groupId: HHGroupId;
  label: string;
  /** Internal positionId from defaultPositions.json (best fit). */
  positionId: string;
  /** Built-in default aliases. User overrides take precedence at runtime. */
  defaultAliases: string[];
  /** Optional list of HH.ru `professional_role` IDs. */
  professionalRoles?: number[];
}

export const HH_GROUP_LABELS: Record<HHGroupId, string> = {
  developer: 'Разработчики',
  analyst:   'Аналитики',
  qa:        'Тестировщики',
};

/**
 * Confirmed HH.ru `professional_role` IDs (subset, most reliable):
 *   96  — Программист, разработчик
 *   124 — Инженер
 *   156 — BI-аналитик, аналитик данных
 *   157 — Тестировщик
 *   164 — Гейм-дизайнер
 *   10  — Аналитик
 *   25  — Бизнес-аналитик
 */
export const HH_CATEGORIES: HHCategory[] = [
  // ── Разработчики ──────────────────────────────────────────────
  { id: 'dev_backend',    groupId: 'developer', label: 'Backend',
    positionId: 'pos_backend', professionalRoles: [96],
    defaultAliases: ['backend разработчик', 'бэкенд разработчик', 'backend developer', 'server side developer'] },
  { id: 'dev_frontend',   groupId: 'developer', label: 'Frontend',
    positionId: 'pos_frontend', professionalRoles: [96],
    defaultAliases: ['frontend разработчик', 'фронтенд разработчик', 'frontend developer'] },
  { id: 'dev_embedded',   groupId: 'developer', label: 'Embedded',
    positionId: 'pos_cpp', professionalRoles: [96, 124],
    defaultAliases: ['embedded разработчик', 'embedded developer', 'firmware engineer', 'разработчик микроконтроллеров'] },
  { id: 'dev_database',   groupId: 'developer', label: 'Database',
    positionId: 'pos_data_engineer', professionalRoles: [96],
    defaultAliases: ['database engineer', 'разработчик баз данных', 'DBA', 'sql разработчик'] },
  { id: 'dev_blockchain', groupId: 'developer', label: 'Blockchain',
    positionId: 'pos_backend', professionalRoles: [96],
    defaultAliases: ['blockchain разработчик', 'solidity developer', 'web3 разработчик', 'smart contract developer'] },
  { id: 'dev_1c',         groupId: 'developer', label: '1С',
    positionId: 'pos_1c_dev', professionalRoles: [96],
    defaultAliases: ['1С разработчик', '1c developer', 'программист 1С'] },
  { id: 'dev_gamedev',    groupId: 'developer', label: 'Gamedev',
    positionId: 'pos_cpp', professionalRoles: [96, 164],
    defaultAliases: ['gamedev разработчик', 'unity разработчик', 'unreal engine разработчик', 'game developer'] },

  // ── Аналитики ────────────────────────────────────────────────
  { id: 'ana_system',   groupId: 'analyst', label: 'Системный',
    positionId: 'pos_analyst_sys', professionalRoles: [10],
    defaultAliases: ['системный аналитик', 'system analyst'] },
  { id: 'ana_business', groupId: 'analyst', label: 'Бизнес',
    positionId: 'pos_analyst_sys', professionalRoles: [25, 10],
    defaultAliases: ['бизнес аналитик', 'business analyst'] },
  { id: 'ana_product',  groupId: 'analyst', label: 'Продуктовый',
    positionId: 'pos_analyst_data', professionalRoles: [156, 10],
    defaultAliases: ['продуктовый аналитик', 'product analyst'] },
  { id: 'ana_data',     groupId: 'analyst', label: 'Данных',
    positionId: 'pos_analyst_data', professionalRoles: [156],
    defaultAliases: ['аналитик данных', 'data analyst', 'BI аналитик'] },

  // ── Тестировщики ──────────────────────────────────────────────
  { id: 'qa_manual', groupId: 'qa', label: 'Manual',
    positionId: 'pos_qa_manual', professionalRoles: [157],
    defaultAliases: ['qa manual', 'ручное тестирование', 'инженер по тестированию', 'manual tester'] },
  { id: 'qa_auto',   groupId: 'qa', label: 'Auto',
    positionId: 'pos_qa_auto', professionalRoles: [157],
    defaultAliases: ['qa automation', 'автотестировщик', 'sdet', 'automation engineer'] },
  { id: 'qa_mobile', groupId: 'qa', label: 'Mobile',
    positionId: 'pos_qa_auto', professionalRoles: [157],
    defaultAliases: ['qa mobile', 'тестирование мобильных приложений', 'mobile qa engineer'] },
];

export function getHHCategoryById(id: string): HHCategory | undefined {
  return HH_CATEGORIES.find((c) => c.id === id);
}

export function groupHHCategories(): Record<HHGroupId, HHCategory[]> {
  const groups: Record<HHGroupId, HHCategory[]> = { developer: [], analyst: [], qa: [] };
  for (const c of HH_CATEGORIES) groups[c.groupId].push(c);
  return groups;
}

// ── Per-category alias overrides (localStorage) ───────────────

const ALIAS_KEY_PREFIX = 'hh_aliases_';

function aliasKey(catId: string): string {
  return `${ALIAS_KEY_PREFIX}${catId}`;
}

/** Returns the active aliases for a category — user override or defaults. */
export function getAliases(catId: string): string[] {
  const cat = getHHCategoryById(catId);
  if (!cat) return [];
  const stored = localStorage.getItem(aliasKey(catId));
  if (stored === null) return cat.defaultAliases;
  try {
    const parsed = JSON.parse(stored) as unknown;
    if (Array.isArray(parsed) && parsed.every((x) => typeof x === 'string')) {
      const cleaned = parsed.map((s) => s.trim()).filter(Boolean);
      return cleaned.length ? cleaned : cat.defaultAliases;
    }
  } catch {
    /* fall through to defaults */
  }
  return cat.defaultAliases;
}

export function setAliases(catId: string, aliases: string[]): void {
  const cat = getHHCategoryById(catId);
  if (!cat) return;
  const cleaned = aliases.map((s) => s.trim()).filter(Boolean);
  // If identical to defaults — drop the override to keep storage clean.
  const isDefault =
    cleaned.length === cat.defaultAliases.length &&
    cleaned.every((a, i) => a === cat.defaultAliases[i]);
  if (isDefault) localStorage.removeItem(aliasKey(catId));
  else localStorage.setItem(aliasKey(catId), JSON.stringify(cleaned));
}

export function resetAliases(catId: string): void {
  localStorage.removeItem(aliasKey(catId));
}

export function isAliasesCustomised(catId: string): boolean {
  return localStorage.getItem(aliasKey(catId)) !== null;
}
