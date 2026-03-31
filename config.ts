import type { Grade, PositionCategory } from '../entities';

// ── Matching thresholds ──────────────────────────────────────

export const MATCH_THRESHOLDS = {
  HIGH:   80,   // ≥80% — зелёный
  MEDIUM: 50,   // 50–79% — янтарный
  // <50% — красный
} as const;

// ── Salary ────────────────────────────────────────────────────

export const CURRENCY_SYMBOLS: Record<string, string> = {
  RUB: '₽',
  USD: '$',
  EUR: '€',
  KZT: '₸',
};

export const DEFAULT_CURRENCY = 'RUB';

// ── Grade colors (CSS var names) ──────────────────────────────

export const GRADE_COLORS: Record<Grade, { bg: string; text: string; border: string; accent: string }> = {
  intern:    { bg: 'var(--bg-intern, #f1f5f9)', text: 'var(--tx-intern, #475569)', border: '#e2e8f0', accent: '#94a3b8' },
  junior:    { bg: 'var(--bg-jun)',             text: 'var(--tx-jun)',             border: 'var(--bd-jun)', accent: 'var(--c-jun)' },
  middle:    { bg: 'var(--bg-mid)',             text: 'var(--tx-mid)',             border: 'var(--bd-mid)', accent: 'var(--c-mid)' },
  senior:    { bg: 'var(--bg-sen)',             text: 'var(--tx-sen)',             border: 'var(--bd-sen)', accent: 'var(--c-sen)' },
  lead:      { bg: 'var(--bg-lea)',             text: 'var(--tx-lea)',             border: 'var(--bd-lea)', accent: 'var(--c-lea)' },
  principal: { bg: 'var(--bg-pri, #f3e8ff)',   text: 'var(--tx-pri, #581c87)',   border: '#d8b4fe', accent: '#9333ea' },
  staff:     { bg: 'var(--bg-pri, #f3e8ff)',   text: 'var(--tx-pri, #581c87)',   border: '#d8b4fe', accent: '#9333ea' },
};

// ── Position category icons (Lucide) ──────────────────────────

export const POSITION_CATEGORY_ICONS: Record<PositionCategory, string> = {
  developer: 'Code2',
  qa:        'Bug',
  analyst:   'BarChart2',
  devops:    'GitBranch',
  designer:  'Palette',
  manager:   'Target',
  data:      'Database',
};

// ── Navigation ────────────────────────────────────────────────

export const NAV_HEIGHT = 52;  // px
export const SIDEBAR_WIDTH = 220;  // px
export const SCROLL_HIDE_THRESHOLD = 80;  // px — через сколько прятать nav

// ── TreePicker ────────────────────────────────────────────────

export const TREE_PICKER_MAX_VISIBLE_TOOLS = 50;  // до поиска

// ── Cards ────────────────────────────────────────────────────

export const CARD_MAX_TOOLS_SHOWN = 8;   // иконки на карточке; остальные → "+N"

// ── Salary chart ──────────────────────────────────────────────

export const SALARY_CHART_MIN_POINTS = 3;  // не рисовать линию если меньше 3 точек

// ── Pipeline ─────────────────────────────────────────────────

export const PIPELINE_TERMINAL_STAGES = ['Принят', 'Отказ'] as const;

// ── Vacancy status labels ─────────────────────────────────────

export const VACANCY_STATUS_LABELS = {
  open:       'Открыта',
  closed:     'Закрыта',
  offer_made: 'Оффер сделан',
  hired:      'Принят',
} as const;

// ── Work format labels ────────────────────────────────────────

export const WORK_FORMAT_LABELS = {
  office:  'Офис',
  remote:  'Удалённо',
  hybrid:  'Гибрид',
  any:     'Любой',
} as const;

// ── Employment type labels ────────────────────────────────────

export const EMPLOYMENT_TYPE_LABELS = {
  full:      'Полная занятость',
  part:      'Частичная',
  contract:  'Контракт',
  freelance: 'Фриланс',
} as const;

// ── Subcategory → Positions mapping ──────────────────────────
// Используется в TopNav для фильтрации подкатегорий

export const SUBCATEGORY_BY_CATEGORY: Record<PositionCategory, string[]> = {
  developer: ['Frontend', 'Backend', 'Fullstack', 'iOS', 'Android', 'Mobile Cross-Platform', '1С', 'GameDev'],
  qa:        ['QA Manual', 'QA Automation', 'Performance'],
  analyst:   ['Systems Analysis', 'Business Analysis', 'Product Analysis'],
  devops:    ['DevOps', 'SRE', 'Platform Engineering', 'Cloud'],
  designer:  ['Product Design', 'UX Research', 'Motion Design'],
  manager:   ['Product Management', 'Project Management', 'Engineering Management'],
  data:      ['Data Analysis', 'Data Engineering', 'Machine Learning', 'Data Science'],
};
