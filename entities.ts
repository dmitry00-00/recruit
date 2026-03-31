// ============================================================
// Recruiting Intelligence System — Entity Types
// ============================================================

// ── Tool Tree ────────────────────────────────────────────────

export interface ToolCategory {
  id: string;
  name: string;
  icon?: string;  // Lucide icon name
  subcategories: ToolSubcategory[];
}

export interface ToolSubcategory {
  id: string;
  categoryId: string;
  name: string;
  tools: Tool[];
}

export interface Tool {
  id: string;
  subcategoryId: string;
  name: string;
  logoUrl?: string | null;
  aliases?: string[];
}

// ── Grades & Enums ───────────────────────────────────────────

export type Grade =
  | 'intern'
  | 'junior'
  | 'middle'
  | 'senior'
  | 'lead'
  | 'principal'
  | 'staff';

export const GRADE_ORDER: Grade[] = [
  'intern', 'junior', 'middle', 'senior', 'lead', 'principal', 'staff',
];

export const GRADE_LABELS: Record<Grade, string> = {
  intern:    'Intern',
  junior:    'Junior',
  middle:    'Middle',
  senior:    'Senior',
  lead:      'Lead',
  principal: 'Principal',
  staff:     'Staff',
};

export type PositionCategory =
  | 'developer'
  | 'qa'
  | 'analyst'
  | 'devops'
  | 'designer'
  | 'manager'
  | 'data';

export const POSITION_CATEGORY_LABELS: Record<PositionCategory, string> = {
  developer: 'Разработчик',
  qa:        'Тестировщик',
  analyst:   'Аналитик',
  devops:    'DevOps',
  designer:  'Дизайнер',
  manager:   'Менеджер',
  data:      'Data',
};

export type Currency = 'RUB' | 'USD' | 'EUR' | 'KZT';
export type WorkFormat = 'office' | 'remote' | 'hybrid';
export type EmploymentType = 'full' | 'part' | 'contract' | 'freelance';
export type VacancyStatus = 'open' | 'closed' | 'offer_made' | 'hired';

// ── Position (шаблон/маска) ───────────────────────────────────

export interface PositionRequiredCategory {
  categoryId: string;
  subcategoryIds: string[];
  minYears?: number;
}

export interface Position {
  id: string;
  name: string;
  category: PositionCategory;
  subcategory: string;
  icon?: string;
  grades: Grade[];
  description?: string;
  requiredCategories: PositionRequiredCategory[];
  createdAt: Date;
  updatedAt: Date;
}

// ── Vacancy (вакансия) ────────────────────────────────────────

export interface VacancyRequirement {
  toolId: string;
  minYears?: number;
  isLocked?: boolean;  // true = скопировано из MIN, нельзя снять в MAX
}

export interface Vacancy {
  id: string;
  positionId: string;

  // Компания
  companyName: string;
  companyLogoUrl?: string;

  // Параметры
  grade: Grade;
  salaryFrom?: number;
  salaryTo?: number;
  currency: Currency;

  // Период
  publishedAt: Date;
  closedAt?: Date;
  status: VacancyStatus;

  // Источник
  sourceUrl?: string;

  // Требования
  minRequirements: VacancyRequirement[];
  maxRequirements: VacancyRequirement[];  // содержит все из min + доп.

  // Условия
  location?: string;
  workFormat: WorkFormat;
  employmentType: EmploymentType;

  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ── Candidate (кандидат) ──────────────────────────────────────

export interface WorkEntryTool {
  toolId: string;
  years: number;  // автовычисляется из периода, можно скорректировать вручную
}

export interface WorkEntry {
  id: string;
  candidateId: string;

  companyName: string;
  companyLogoUrl?: string;
  positionId: string;
  grade: Grade;

  startDate: Date;
  endDate?: Date;        // undefined = по настоящее время
  isCurrent: boolean;

  tools: WorkEntryTool[];

  salary?: number;
  currency: Currency;

  responsibilities?: string;
}

export interface Candidate {
  id: string;

  // Личные данные
  firstName: string;
  lastName: string;
  middleName?: string;
  photoUrl?: string;

  // Контакты
  email?: string;
  phone?: string;
  telegramHandle?: string;
  linkedinUrl?: string;

  // Демография
  city?: string;
  country?: string;
  citizenship?: string;
  workFormat: WorkFormat | 'any';
  relocate: boolean;

  // Зарплатные ожидания
  salaryExpected?: number;
  currency: Currency;

  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ── Aggregated Candidate Profile (computed, не хранится в DB) ──

export interface ToolExperience {
  toolId: string;
  months: number;
  years: number;  // rounded to 0.5
}

export interface CandidateAggregation {
  candidateId: string;
  totalMonths: number;
  totalYears: number;
  toolsExperience: ToolExperience[];
  currentSalary?: number;
  averageSalary: number;
  primaryPositionId?: string;
  grades: Grade[];
  topGrade: Grade;
}

// ── Match Result (computed) ────────────────────────────────────

export interface MatchedTool {
  toolId: string;
  required: number;  // years required
  actual: number;    // years candidate has
}

export interface GapTool {
  toolId: string;
  required: number;
  actual: number;    // 0 = нет совсем, >0 = есть, но меньше нужного
}

export interface ExtraTool {
  toolId: string;
  actual: number;
}

export interface MatchResult {
  vacancyId: string;
  candidateId: string;
  scoreMin: number;   // 0–100, % совпадения с MIN требованиями
  scoreMax: number;   // 0–100, % совпадения с MAX требованиями
  matched: MatchedTool[];
  gaps: GapTool[];
  extras: ExtraTool[];
}

// ── Pipeline (воронка подбора) ────────────────────────────────

export interface Pipeline {
  id: string;
  vacancyId: string;
  stages: PipelineStage[];
  createdAt: Date;
}

export interface PipelineStage {
  id: string;
  pipelineId: string;
  name: string;
  order: number;
  color?: string;
}

export const DEFAULT_PIPELINE_STAGES: Omit<PipelineStage, 'id' | 'pipelineId'>[] = [
  { name: 'Новые',           order: 0, color: '#94a3b8' },
  { name: 'Скрининг',        order: 1, color: '#5b9cf6' },
  { name: 'Тех. интервью',   order: 2, color: '#f0a030' },
  { name: 'HR-интервью',     order: 3, color: '#a78bfa' },
  { name: 'Оффер',           order: 4, color: '#E8920A' },
  { name: 'Принят',          order: 5, color: '#22c55e' },
  { name: 'Отказ',           order: 6, color: '#ef4444' },
];

export interface PipelineCard {
  id: string;
  pipelineId: string;
  stageId: string;
  candidateId: string;
  matchScore?: number;
  addedAt: Date;
  movedAt: Date;
  notes?: string;
}

// ── UI State types ────────────────────────────────────────────

export type ViewMode = 'gallery' | 'table';
export type RecordType = 'vacancies' | 'candidates';
export type RequirementLevel = 'min' | 'max';
export type AppSection = 'list' | 'analytics';

export interface FilterState {
  positionCategory: PositionCategory | null;
  positionSubcategory: string | null;
  language1: string | null;
  framework1: string | null;
  language2: string | null;
  framework2: string | null;
  viewMode: ViewMode;
  section: AppSection;
  recordType: RecordType;
  requirementLevel: RequirementLevel;
  showDiff: boolean;
  // Дополнительные фильтры
  gradeFilter: Grade[];
  salaryMin?: number;
  salaryMax?: number;
  workFormatFilter: WorkFormat[];
}

// ── RoadMap ───────────────────────────────────────────────────

export interface RoadMapCell {
  toolIds: string[];  // инструменты, встречающиеся в этой ячейке
  count: number;      // сколько вакансий упоминают эти инструменты
}

// roadmap[subcategoryId][grade] = RoadMapCell
export type RoadMapMatrix = Record<string, Record<Grade, RoadMapCell>>;

export interface RoadMapData {
  positionId: string;
  generatedAt: Date;
  vacanciesCount: number;
  matrix: RoadMapMatrix;
  salaryByGrade: Record<Grade, { min: number; max: number; median: number; count: number }>;
}

// ── Salary Chart ──────────────────────────────────────────────

export interface SalaryDataPoint {
  date: Date;
  salary: number;
  source: 'vacancy' | 'candidate';
  label?: string;
}
