import type { Grade, PositionCategory } from '@/entities';

// ── Matching thresholds ──────────────────────────────────────

export const MATCH_THRESHOLDS = {
  HIGH:   80,
  MEDIUM: 50,
} as const;

// ── Salary ────────────────────────────────────────────────────

export const CURRENCY_SYMBOLS: Record<string, string> = {
  RUB: '₽',
  USD: '$',
  EUR: '€',
  KZT: '₸',
};

export const DEFAULT_CURRENCY = 'RUB';

// ── Grade colors ─────────────────────────────────────────────

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

export const NAV_HEIGHT = 52;
export const SIDEBAR_WIDTH = 220;
export const SCROLL_HIDE_THRESHOLD = 80;

// ── TreePicker ────────────────────────────────────────────────

export const TREE_PICKER_MAX_VISIBLE_TOOLS = 50;

// ── Cards ────────────────────────────────────────────────────

export const CARD_MAX_TOOLS_SHOWN = 8;

// ── Salary chart ──────────────────────────────────────────────

export const SALARY_CHART_MIN_POINTS = 3;

// ── Pipeline ─────────────────────────────────────────────────

export const PIPELINE_TERMINAL_STAGES = ['Принят', 'Отказ'] as const;

// ── Labels ───────────────────────────────────────────────────

export const VACANCY_STATUS_LABELS = {
  open:       'Открыта',
  closed:     'Закрыта',
  offer_made: 'Оффер сделан',
  hired:      'Принят',
} as const;

export const WORK_FORMAT_LABELS = {
  office:  'Офис',
  remote:  'Удалённо',
  hybrid:  'Гибрид',
  any:     'Любой',
} as const;

export const EMPLOYMENT_TYPE_LABELS = {
  full:      'Полная занятость',
  part:      'Частичная',
  contract:  'Контракт',
  freelance: 'Фриланс',
} as const;

// ── Subcategory → Positions mapping ──────────────────────────

export const SUBCATEGORY_BY_CATEGORY: Record<PositionCategory, string[]> = {
  developer: ['Frontend', 'Backend', 'Fullstack', 'iOS', 'Android', 'Mobile Cross-Platform', '1С', 'GameDev'],
  qa:        ['QA Manual', 'QA Automation', 'Performance'],
  analyst:   ['Systems Analysis', 'Business Analysis', 'Product Analysis'],
  devops:    ['DevOps', 'SRE', 'Platform Engineering', 'Cloud'],
  designer:  ['Product Design', 'UX Research', 'Motion Design'],
  manager:   ['Product Management', 'Project Management', 'Engineering Management'],
  data:      ['Data Analysis', 'Data Engineering', 'Machine Learning', 'Data Science'],
};
