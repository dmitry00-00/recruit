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
 * `text` — keyword query passed to HH.ru's `text=` filter. We use
 * `SYNONYM`-friendly Russian + English wording. Combined with
 * `professional_role` IDs where they exist, this gives narrower results.
 *
 * `professionalRoles` — HH.ru `professional_role` IDs (numeric). Optional
 * but improves precision when present. Source: HH.ru `/professional_roles`
 * dictionary. We only list IDs we are confident about.
 */
import type { Grade } from '@/entities';

export type HHGroupId = 'developer' | 'analyst' | 'qa';

export interface HHCategory {
  id: string;
  groupId: HHGroupId;
  label: string;
  /** Internal positionId from defaultPositions.json (best fit). */
  positionId: string;
  /** HH.ru search query (text=). */
  text: string;
  /** Optional list of HH.ru `professional_role` IDs. */
  professionalRoles?: number[];
  /** Optional grade restriction — useful for narrow categories. */
  defaultGrades?: Grade[];
}

export const HH_GROUP_LABELS: Record<HHGroupId, string> = {
  developer: 'Разработчики',
  analyst:   'Аналитики',
  qa:        'Тестировщики',
};

/**
 * Confirmed HH.ru `professional_role` IDs (subset, most reliable):
 *   96  — Программист, разработчик
 *   104 — CTO / Технический директор
 *   124 — Инженер
 *   150 — Системный администратор
 *   156 — BI-аналитик, аналитик данных
 *   157 — Тестировщик
 *   164 — Гейм-дизайнер
 *   165 — Дата-сайентист
 *   10  — Аналитик
 *   25  — Бизнес-аналитик
 *   148 — Менеджер продукта
 */
export const HH_CATEGORIES: HHCategory[] = [
  // ── Разработчики ──────────────────────────────────────────────
  { id: 'dev_backend',    groupId: 'developer', label: 'Backend',
    positionId: 'pos_backend',       text: 'backend разработчик',
    professionalRoles: [96] },
  { id: 'dev_frontend',   groupId: 'developer', label: 'Frontend',
    positionId: 'pos_frontend',      text: 'frontend разработчик',
    professionalRoles: [96] },
  { id: 'dev_embedded',   groupId: 'developer', label: 'Embedded',
    positionId: 'pos_cpp',           text: 'embedded разработчик C++ микроконтроллер',
    professionalRoles: [96, 124] },
  { id: 'dev_database',   groupId: 'developer', label: 'Database',
    positionId: 'pos_data_engineer', text: 'database engineer DBA SQL разработчик базы данных',
    professionalRoles: [96] },
  { id: 'dev_blockchain', groupId: 'developer', label: 'Blockchain',
    positionId: 'pos_backend',       text: 'blockchain solidity smart contract web3 разработчик',
    professionalRoles: [96] },
  { id: 'dev_1c',         groupId: 'developer', label: '1С',
    positionId: 'pos_1c_dev',        text: '1С разработчик',
    professionalRoles: [96] },
  { id: 'dev_gamedev',    groupId: 'developer', label: 'Gamedev',
    positionId: 'pos_cpp',           text: 'gamedev unity unreal разработчик игр',
    professionalRoles: [96, 164] },

  // ── Аналитики ────────────────────────────────────────────────
  { id: 'ana_system',   groupId: 'analyst', label: 'Системный',
    positionId: 'pos_analyst_sys',  text: 'системный аналитик',
    professionalRoles: [10] },
  { id: 'ana_business', groupId: 'analyst', label: 'Бизнес',
    positionId: 'pos_analyst_sys',  text: 'бизнес аналитик',
    professionalRoles: [25, 10] },
  { id: 'ana_product',  groupId: 'analyst', label: 'Продуктовый',
    positionId: 'pos_analyst_data', text: 'продуктовый аналитик product analyst',
    professionalRoles: [156, 10] },
  { id: 'ana_data',     groupId: 'analyst', label: 'Данных',
    positionId: 'pos_analyst_data', text: 'data analyst аналитик данных',
    professionalRoles: [156] },

  // ── Тестировщики ──────────────────────────────────────────────
  { id: 'qa_manual', groupId: 'qa', label: 'Manual',
    positionId: 'pos_qa_manual', text: 'qa тестировщик manual ручное тестирование',
    professionalRoles: [157] },
  { id: 'qa_auto',   groupId: 'qa', label: 'Auto',
    positionId: 'pos_qa_auto',   text: 'qa automation автотестировщик automation engineer',
    professionalRoles: [157] },
  { id: 'qa_mobile', groupId: 'qa', label: 'Mobile',
    positionId: 'pos_qa_auto',   text: 'qa mobile тестирование мобильных приложений',
    professionalRoles: [157] },
];

export function getHHCategoryById(id: string): HHCategory | undefined {
  return HH_CATEGORIES.find((c) => c.id === id);
}

export function groupHHCategories(): Record<HHGroupId, HHCategory[]> {
  const groups: Record<HHGroupId, HHCategory[]> = { developer: [], analyst: [], qa: [] };
  for (const c of HH_CATEGORIES) groups[c.groupId].push(c);
  return groups;
}
