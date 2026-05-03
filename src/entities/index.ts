// ============================================================
// Recruiting Intelligence System — Entity Types
// ============================================================

// ── Tool Tree ────────────────────────────────────────────────

export interface ToolCategory {
  id: string;
  name: string;
  icon?: string;
  subcategories: ToolSubcategory[];
}

export interface ToolSubcategory {
  id: string;
  categoryId: string;
  /** Optional internal grouping label within a category (e.g. "Языки разработки") */
  group?: string;
  name: string;
  tools: Tool[];
}

export interface Tool {
  id: string;
  subcategoryId: string;
  name: string;
  logoUrl?: string | null;
  aliases?: string[];
  /** Optional nested tools — used for frameworks/libraries under a parent language. */
  children?: Tool[];
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
  data:      'Разное',
};

export type Currency = 'RUB' | 'USD' | 'EUR' | 'KZT';
export type WorkFormat = 'office' | 'remote' | 'hybrid';
export type EmploymentType = 'full' | 'part' | 'contract' | 'freelance';
export type VacancyStatus = 'open' | 'closed' | 'offer_made' | 'hired';

// ── Extended enums (SCHEMA_AUDIT.md) ─────────────────────────

export type ExtractionSource = 'hh' | 'linkedin' | 'habr' | 'manual' | 'llm';

export type EducationLevel =
  | 'secondary'        // среднее
  | 'vocational'       // СПО
  | 'bachelor'
  | 'master'
  | 'phd'
  | 'self_taught';

export type LanguageLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2' | 'native';

export type OpenToWorkStatus = 'looking' | 'considering' | 'not_looking';

export type SalaryPeriod = 'hour' | 'month' | 'year';

// ── Common embedded types (SCHEMA_AUDIT.md) ─────────────────

export interface ExtractionMeta {
  source: ExtractionSource;
  /** ID на платформе-источнике, для дедупа и обратных ссылок. */
  externalId?: string;
  /** Когда экстрагировано (импортировано), не путать с createdAt. */
  extractedAt: Date;
  /** Имя модели, если экстракцию делала LLM (например 'deepseek-v4-flash'). */
  extractionModel?: string;
  /** Версия маски-должности, например 'pos_backend@1.3'. */
  maskVersion?: string;
  /** Версия дерева инструментов, например 'tooltree@2.1'. */
  ontologyVersion?: string;
  /** Confidence экстрактора, 0..1. */
  extractionQuality?: number;
}

export interface Address {
  country?: string;
  city?: string;
  street?: string;
  postalCode?: string;
  lat?: number;
  lng?: number;
  /** Свободная строка-исходник, если структуру разобрать не удалось. */
  raw?: string;
}

export interface Education {
  institution: string;
  faculty?: string;
  specialty?: string;
  level?: EducationLevel;
  startYear?: number;
  endYear?: number;
  isCurrent?: boolean;
}

export interface Certification {
  name: string;
  issuer?: string;
  issuedAt?: Date;
  expiresAt?: Date;
  credentialUrl?: string;
}

export interface Language {
  /** ISO 639-1 (например 'ru', 'en'). */
  code: string;
  level: LanguageLevel;
}

export interface ProfileUrls {
  github?: string;
  gitlab?: string;
  bitbucket?: string;
  stackoverflow?: string;
  habrCareer?: string;
  linkedin?: string;
  /** Личный сайт. */
  personal?: string;
  portfolio?: string;
}

export interface RecruiterContact {
  name?: string;
  email?: string;
  phone?: string;
  telegramHandle?: string;
}

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
  isLocked?: boolean;
}

export interface Vacancy {
  id: string;
  positionId: string;
  companyName: string;
  companyLogoUrl?: string;
  grade: Grade;
  salaryFrom?: number;
  salaryTo?: number;
  currency: Currency;
  publishedAt: Date;
  closedAt?: Date;
  status: VacancyStatus;
  sourceUrl?: string;
  minRequirements: VacancyRequirement[];
  maxRequirements: VacancyRequirement[];
  location?: string;
  workFormat: WorkFormat;
  employmentType: EmploymentType;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;

  // ── Extended fields (SCHEMA_AUDIT.md) ─────────────────────
  /** Исходный заголовок с платформы-источника. Для дедупа и поиска. */
  title?: string;
  /** Дополнительные роли — multi-role вакансии «Backend / Fullstack / Lead». */
  alternatePositionIds?: string[];
  /** Сектор: финтех, e-com, геймдев, edtech, … */
  industry?: string;
  /** Plain-text описание (с платформы-источника). */
  description?: string;
  /** Сырой HTML описания — для re-extraction при смене канона. */
  descriptionHtml?: string;
  responsibilities?: string[];
  qualifications?: string[];
  benefits?: string[];
  educationLevel?: EducationLevel;
  /** Период оплаты — час/месяц/год. Если не задан — month для РФ-площадок, year для LinkedIn. */
  salaryPeriod?: SalaryPeriod;
  /** До налогов или после. По умолчанию — net. */
  salaryGross?: boolean;
  /** Структурированный адрес (заполняется при импорте из источников, у которых он есть). */
  address?: Address;
  /** URL для отклика, если отличается от sourceUrl. */
  applyUrl?: string;
  recruiterContact?: RecruiterContact;
  /** Когда вакансия истекает / закрывается автоматически. */
  validThrough?: Date;
  /** Метаданные экстракции — источник, версия маски, версия онтологии. */
  extractionMeta?: ExtractionMeta;
}

// ── Candidate (кандидат) ──────────────────────────────────────

export interface WorkEntryTool {
  toolId: string;
  years: number;
}

export interface WorkEntry {
  id: string;
  candidateId: string;
  companyName: string;
  companyLogoUrl?: string;
  positionId: string;
  grade: Grade;
  startDate: Date;
  endDate?: Date;
  isCurrent: boolean;
  tools: WorkEntryTool[];
  salary?: number;
  currency: Currency;
  /** Свободный текст: чем занимался на этой работе. */
  responsibilities?: string;

  // ── Extended fields (SCHEMA_AUDIT.md) ─────────────────────
  /** Сырой HTML описания работы — для re-extraction при смене канона. */
  descriptionHtml?: string;
  /** Дополнительные роли в этом периоде (редко: Backend + DevOps в одной должности). */
  alternatePositionIds?: string[];
  /** Сектор работодателя — финтех, e-com, … (для аналитики «бэкенд в финтехе vs геймдеве»). */
  industry?: string;
  /** Тип проекта: e-com, b2b-saas, gamedev, … (для project templates). */
  projectType?: string[];
  /** Размер команды — сигнал о грейде/типе компании. */
  teamSize?: number;
}

export interface Candidate {
  id: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  photoUrl?: string;
  email?: string;
  phone?: string;
  telegramHandle?: string;
  linkedinUrl?: string;
  city?: string;
  country?: string;
  citizenship?: string;
  positionId?: string;
  workFormat: WorkFormat | 'any';
  relocate: boolean;
  salaryExpected?: number;
  currency: Currency;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;

  // ── Extended fields (SCHEMA_AUDIT.md) ─────────────────────
  /** Дополнительные роли — multi-role профили «DevOps / Sysadmin / Network Engineer». */
  alternatePositionIds?: string[];
  /** Одностроковая самопрезентация. У LinkedIn — `headline`, у Habr — первая строка `Стек`. */
  headline?: string;
  /** Plain-text «Обо мне» / summary. */
  summary?: string;
  /** Сырой HTML «Обо мне» — для re-extraction. */
  summaryHtml?: string;
  education?: Education[];
  certifications?: Certification[];
  languages?: Language[];
  /** Публичные профили (GitHub, Bitbucket, Stack Overflow и т. п.) — НЕ messenger'ы. */
  profileUrls?: ProfileUrls;
  /** Когда последний раз был активен на платформе-источнике. Сигнал актуальности профиля. */
  lastActiveAt?: Date;
  /** Когда зарегистрировался на платформе-источнике. */
  registeredAt?: Date;
  /** Статус поиска: ищет / рассмотрит / не ищет. */
  openToWork?: OpenToWorkStatus;
  /** Период оплаты ожидаемой зарплаты — час/месяц/год. */
  salaryPeriod?: SalaryPeriod;
  /** До или после налогов. */
  salaryGross?: boolean;
  /** Структурированный адрес (если есть). `city` / `country` остаются для обратной совместимости. */
  address?: Address;
  /** Метаданные экстракции — источник, версия маски, версия онтологии. */
  extractionMeta?: ExtractionMeta;
}

// ── Aggregated Candidate Profile (computed) ──────────────────

export interface ToolExperience {
  toolId: string;
  months: number;
  years: number;
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
  required: number;
  actual: number;
}

export interface GapTool {
  toolId: string;
  required: number;
  actual: number;
}

export interface ExtraTool {
  toolId: string;
  actual: number;
}

export interface MatchResult {
  vacancyId: string;
  candidateId: string;
  scoreMin: number;
  scoreMax: number;
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
  gradeFilter: Grade[];
  salaryMin?: number;
  salaryMax?: number;
  workFormatFilter: WorkFormat[];
  // ── Non-requirement filter bar ──
  companyFilter: string;
  positionIdFilter: string | null;
  cityFilter: string;
  statusFilter: VacancyStatus | null;
}

// ── RoadMap ───────────────────────────────────────────────────

export interface RoadMapCell {
  toolIds: string[];
  count: number;
}

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

// ── User & Auth ──────────────────────────────────────────────

export type UserRole = 'admin' | 'recruiter' | 'hiring_manager' | 'viewer' | 'candidate';

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  admin:          'Администратор',
  recruiter:      'Рекрутер',
  hiring_manager: 'Нанимающий менеджер',
  viewer:         'Наблюдатель',
  candidate:      'Кандидат',
};

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  avatarUrl?: string;
  phone?: string;
  department?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ── Response History (хроника откликов) ──────────────────────

export type ResponseEventType =
  | 'candidate_applied'     // Кандидат откликнулся
  | 'recruiter_contacted'   // Рекрутер связался
  | 'screening_scheduled'   // Назначен скрининг
  | 'screening_done'        // Скрининг проведён
  | 'interview_scheduled'   // Назначено интервью
  | 'interview_done'        // Интервью проведено
  | 'test_task_sent'        // Тестовое задание отправлено
  | 'test_task_received'    // Тестовое задание получено
  | 'offer_sent'            // Оффер отправлен
  | 'offer_accepted'        // Оффер принят
  | 'offer_declined'        // Оффер отклонён
  | 'candidate_rejected'    // Кандидат отклонён
  | 'candidate_withdrawn'   // Кандидат снял кандидатуру
  | 'note';                 // Заметка / комментарий

export const RESPONSE_EVENT_LABELS: Record<ResponseEventType, string> = {
  candidate_applied:    'Отклик кандидата',
  recruiter_contacted:  'Рекрутер связался',
  screening_scheduled:  'Назначен скрининг',
  screening_done:       'Скрининг проведён',
  interview_scheduled:  'Назначено интервью',
  interview_done:       'Интервью проведено',
  test_task_sent:       'Тестовое отправлено',
  test_task_received:   'Тестовое получено',
  offer_sent:           'Оффер отправлен',
  offer_accepted:       'Оффер принят',
  offer_declined:       'Оффер отклонён',
  candidate_rejected:   'Кандидат отклонён',
  candidate_withdrawn:  'Кандидат снял кандидатуру',
  note:                 'Заметка',
};

export const RESPONSE_EVENT_ICONS: Record<ResponseEventType, string> = {
  candidate_applied:    '📩',
  recruiter_contacted:  '📞',
  screening_scheduled:  '📅',
  screening_done:       '✅',
  interview_scheduled:  '🗓',
  interview_done:       '✅',
  test_task_sent:       '📝',
  test_task_received:   '📥',
  offer_sent:           '💼',
  offer_accepted:       '🎉',
  offer_declined:       '❌',
  candidate_rejected:   '🚫',
  candidate_withdrawn:  '🏳',
  note:                 '📌',
};

export interface ResponseEvent {
  id: string;
  vacancyId: string;
  candidateId: string;
  type: ResponseEventType;
  comment?: string;
  authorId?: string;        // userId of who created the event
  scheduledAt?: Date;       // for scheduled events (interviews, etc.)
  createdAt: Date;
}

// ── Recruitment Tasks (задачи подбора) ──────────────────────

export type TaskStatus = 'pending' | 'in_progress' | 'done' | 'cancelled';

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  pending:     'Ожидает',
  in_progress: 'В работе',
  done:        'Выполнена',
  cancelled:   'Отменена',
};

export interface RecruitmentTask {
  id: string;
  title: string;
  description?: string;
  vacancyId?: string;
  candidateId?: string;
  assigneeId?: string;      // userId
  status: TaskStatus;
  dueDate: Date;
  createdAt: Date;
  updatedAt: Date;
}
