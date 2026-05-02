# Schema Audit: hh.ru × LinkedIn × Habr Career → Recruit canonical model

Задача — расширить наш `entities/index.ts` так, чтобы он принимал данные с трёх ведущих job board'ов без потери информации, готов к OpenClaw + DeepSeek pipeline и поддерживал эволюцию канона без перезаписи уже импортированных записей.

## Принятые решения

| # | Решение | Почему |
|---|---|---|
| 1 | **Multi-role: вариант B** — `positionId: string` (primary, остаётся как было) + опциональный `alternatePositionIds: string[]` | Реальный multi-role почти всегда иерархичен (первая роль — primary). Не ломает `matchScore` и существующие записи. Миграция в полный массив позже — тривиальна. |
| 2 | **Versioning** — каждая запись несёт `extractionMeta` блок с `source`, `externalId`, `maskVersion`, `ontologyVersion`, `extractionModel`, `extractedAt` | Без этого нельзя безопасно мутировать tool tree после массовой загрузки. То, на чём настаивал DeepSeek в архитектурной дискуссии. |
| 3 | **Сырой исходник** — `descriptionHtml` хранится рядом со структурными полями | Позволяет пересчитать структуру, когда улучшится промпт или маска. Удвоение размера БД приемлемо. |
| 4 | **Education / Certifications / Languages** — first-class сущности (массивы объектов), не теги | Это структурные данные с датами и уровнями, теги их не выразят. |

## Матрица полей: Vacancy

`✓` — есть в источнике, маппится к нашему полю напрямую
`◐` — есть, но требует нормализации/коэрсии
`—` — нет в источнике, не используем
`+` — добавляем в канон

### Существующие поля

| Поле в `Vacancy` | hh.ru | LinkedIn | Habr | Статус |
|---|---|---|---|---|
| `companyName` | `employer.name` ✓ | `hiringOrganization.name` ✓ | имя компании ✓ | OK |
| `companyLogoUrl` | `employer.logo_urls.240` ◐ | `hiringOrganization.logo` ✓ | — | OK |
| `grade` | `experience` ◐ | `experienceRequirements.MonthsOfExperience` ◐ | derived ◐ | OK через `coerceGrade` |
| `salaryFrom`/`salaryTo` | `salary.from/to` ✓ | `baseSalary.minValue/maxValue` ✓ | парсинг строки ◐ | OK |
| `currency` | `salary.currency` ◐ | `baseSalary.currency` ✓ | парсинг строки ◐ | OK через `coerceCurrency` |
| `publishedAt` | `published_at` ✓ | `datePosted` ✓ | — | OK |
| `status` | `archived` ◐ | computed | computed | OK |
| `sourceUrl` | `alternate_url` ✓ | URL поста ✓ | URL вакансии ✓ | OK |
| `minRequirements[]` / `maxRequirements[]` | `key_skills[].name` ◐ | `skills[]` ◐ | `Профессиональные навыки` ◐ | OK через `resolveToolId` |
| `location` (string) | `area.name` ✓ | `jobLocation.address.locality` ◐ | город ✓ | **расширяем — см. ниже** |
| `workFormat` | `schedule` ◐ | `workplaceType` ✓ | derived ◐ | OK через `coerceWorkFormat` |
| `employmentType` | `employment` ◐ | `employmentType` ✓ | derived ◐ | OK через `coerceEmploymentType` |
| `notes` | — | — | — | Внутреннее, не из источников |
| `positionId` | `professional_roles[0]` ◐ | `occupationalCategory` ◐ | первый из `Стек` ◐ | OK |

### Добавляем в канон

| Новое поле | Тип | hh.ru | LinkedIn | Habr | Зачем |
|---|---|---|---|---|---|
| `title` | `string` | `name` ✓ | `title` ✓ | derived от Стек ◐ | Исходный заголовок для дедупа, поиска, отображения |
| `descriptionHtml` | `string?` | `description` ✓ | `description` ✓ | `Обо мне`-аналог ✓ | Сырой исходник, для re-extraction |
| `description` | `string?` | strip(html) ◐ | strip(html) ◐ | как есть ✓ | Plain-text версия |
| `responsibilities[]` | `string[]?` | LLM из description ◐ | `responsibilities` ✓ | LLM ◐ | Отдельно от skills, не валится в notes |
| `qualifications[]` | `string[]?` | LLM ◐ | `qualifications` ✓ | LLM ◐ | Не-инструментальные требования (образование, языки, права) |
| `industry` | `string?` | — | `industry` ✓ | — | Финтех/ритейл/геймдев — для проектной аналитики |
| `benefits[]` | `string[]?` | LLM ◐ | `jobBenefits` ✓ | LLM из текста ◐ | ДМС, опционы, спортзал |
| `educationLevel` | `EducationLevel?` | — | `educationRequirements` ✓ | — | LinkedIn активно фильтрует |
| `salaryPeriod` | `'hour'\|'month'\|'year'` | implicit `month` | `unitText` ✓ | derived из строки ◐ | Хабр пишет «$2000» без периода |
| `salaryGross` | `boolean?` | `salary.gross` ✓ | implicit | — | gross/net путается, важно для РФ |
| `address` | `Address?` (объект) | `address` ✓ | `jobLocation.address` ✓ | — | Структурно: country, city, street, lat, lng |
| `applyUrl` | `string?` | `apply_alternate_url` ✓ | `directApply` ✓ | URL вакансии ✓ | Куда откликаться |
| `recruiterContact` | `RecruiterContact?` | `contacts` ✓ | — | — | Кто связь, его телефон/email |
| `validThrough` | `Date?` | implicit | `validThrough` ✓ | — | Когда вакансия истекает |
| `alternatePositionIds[]` | `string[]?` | `professional_roles[1..]` ◐ | derived ◐ | парсинг Стека ✓ | **Решение #1** — мульти-роль |
| `extractionMeta` | `ExtractionMeta` | — | — | — | **Решение #2** — versioning |

## Матрица полей: Candidate

### Существующие поля

| Поле в `Candidate` | hh.ru | LinkedIn | Habr | Статус |
|---|---|---|---|---|
| `firstName`/`lastName`/`middleName` | resume фрагменты ✓ | `firstName`/`lastName` ✓ | ФИО ✓ | OK |
| `email` | `contact.email` ✓ | `email` ✓ | `Почта` ✓ | OK |
| `phone` | `contact.phone` ✓ | — | `Телефон` ✓ | OK |
| `telegramHandle` | — | — | `Telegram` ✓ | OK |
| `linkedinUrl` | — | profile URL ✓ | — | OK |
| `city`/`country` | `area` ◐ | `location` ◐ | `Локация` ✓ | OK |
| `citizenship` | `citizenship` ✓ | — | — | OK |
| `positionId` | `title` ◐ | `headline` ◐ | первый из Стек ◐ | OK |
| `workFormat` | — | — | derived ◐ | OK |
| `relocate` | `relocation` ✓ | `openToWork` ◐ | `Готов к переезду` ✓ | OK |
| `salaryExpected` | `salary` ✓ | — | `Зарплата` ◐ | OK |

### Добавляем в канон

| Новое поле | Тип | hh.ru | LinkedIn | Habr | Зачем |
|---|---|---|---|---|---|
| `headline` | `string?` | resume title | `headline` ✓ | первая строка Стек ✓ | Multi-role самопрезентация |
| `summary` | `string?` | `skills` блок resume | `summary` ✓ | `Обо мне` ✓ | Свободный текст, отдельно от `notes` |
| `summaryHtml` | `string?` | resume HTML | — | — | Сырой исходник |
| `education[]` | `Education[]` | `education` ✓ | `education` ✓ | — | **Решение #4** — first-class |
| `certifications[]` | `Certification[]` | `certificate` ✓ | `certifications` ✓ | — | **Решение #4** |
| `languages[]` | `Language[]` | `language` ✓ | `languages` ✓ | — | Русский B2, английский C1 |
| `profileUrls` | `ProfileUrls?` | — | LinkedIn URL ✓ | github, bitbucket ✓ | Не messenger'ы — публичные репозитории |
| `lastActiveAt` | `Date?` | `last_active` ✓ | `lastActive` ✓ | `Дата визита` ✓ | Сигнал активности |
| `registeredAt` | `Date?` | — | — | `Дата регистрации` ✓ | Стаж на платформе |
| `openToWork` | `'looking'\|'considering'\|'not_looking'` | `job_search_status` ◐ | `openToWork` ✓ | `Зарплата` парсится ◐ | Habr: «Не ищу работу»/«Ищу»/«Рассмотрю предложения» |
| `salaryPeriod` | `'hour'\|'month'\|'year'` | implicit | `unit` ✓ | derived ◐ | См. Vacancy |
| `salaryGross` | `boolean?` | `gross` | — | — | См. Vacancy |
| `alternatePositionIds[]` | `string[]?` | — | headline parsing ◐ | парсинг Стека ✓ | **Решение #1** |
| `extractionMeta` | `ExtractionMeta` | — | — | — | **Решение #2** |

## Матрица полей: WorkEntry

| Новое поле | Тип | hh.ru | LinkedIn | Habr | Зачем |
|---|---|---|---|---|---|
| `descriptionHtml` | `string?` | `description` HTML ✓ | description ✓ | `Опыт работы N` ✓ | Сырой исходник для re-extraction |
| `industry` | `string?` | derived ◐ | `industry` ✓ | derived ◐ | Бэкенд в финтехе vs геймдеве |
| `projectType[]` | `string[]?` | LLM ◐ | LLM ◐ | LLM ◐ | e-com, fintech, saas, gamedev — для project templates |
| `teamSize` | `number?` | LLM ◐ | — | LLM ◐ | Сигнал о грейде |
| `alternatePositionIds[]` | `string[]?` | — | derived ◐ | derived ◐ | **Решение #1** |

## Новые типы

### `ExtractionMeta`

```ts
export type ExtractionSource = 'hh' | 'linkedin' | 'habr' | 'manual' | 'llm';

export interface ExtractionMeta {
  source: ExtractionSource;
  /** ID на платформе-источнике, для дедупа и обратных ссылок. */
  externalId?: string;
  /** Когда экстрагировано (импортировано), не путать с createdAt. */
  extractedAt: Date;
  /** Имя модели, если экстракцию делала LLM. */
  extractionModel?: string;
  /** Версия маски, по которой делалась экстракция. Например 'pos_backend@1.3'. */
  maskVersion?: string;
  /** Версия онтологии (tool tree). Например 'tooltree@2.1'. */
  ontologyVersion?: string;
  /** Confidence от экстрактора (0..1). */
  extractionQuality?: number;
}
```

### `Address`

```ts
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
```

### `Education`, `Certification`, `Language`

```ts
export type EducationLevel =
  | 'secondary'        // среднее
  | 'vocational'       // СПО
  | 'bachelor'
  | 'master'
  | 'phd'
  | 'self_taught';

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

export type LanguageLevel = 'A1'|'A2'|'B1'|'B2'|'C1'|'C2'|'native';

export interface Language {
  code: string;       // ISO 639-1, e.g. 'ru', 'en'
  level: LanguageLevel;
}
```

### `ProfileUrls`

```ts
export interface ProfileUrls {
  github?: string;
  gitlab?: string;
  bitbucket?: string;
  stackoverflow?: string;
  habrCareer?: string;
  linkedin?: string;       // дублируется с Candidate.linkedinUrl на верхнем уровне для обратной совместимости
  personal?: string;       // личный сайт
  portfolio?: string;
}
```

### `RecruiterContact`

```ts
export interface RecruiterContact {
  name?: string;
  email?: string;
  phone?: string;
  telegramHandle?: string;
}
```

### Расширенный `Salary` (вариант)

Можно либо плоско добавить `salaryPeriod`/`salaryGross` рядом с существующими `salaryFrom`/`salaryTo`/`currency`, либо собрать в объект `salary`. Предпочтителен **плоский** подход — обратная совместимость, минимум миграций.

```ts
// Vacancy
salaryFrom?: number;
salaryTo?: number;
currency: Currency;
salaryPeriod?: 'hour' | 'month' | 'year';   // default: month
salaryGross?: boolean;                       // default: false (net)

// Candidate
salaryExpected?: number;
currency: Currency;
salaryPeriod?: 'hour' | 'month' | 'year';
salaryGross?: boolean;
```

## Версионирование канона

Каждая мутация tool tree или маски-должности увеличивает версию. Простая семантика:

- **`ontologyVersion`** — мажорная версия дерева инструментов. Bump при любом удалении/переименовании tool. Patch при добавлении.
- **`maskVersion`** — версия конкретной должности (`pos_backend`, `pos_frontend`...). Bump при изменении `requiredCategories`. Хранится как `<positionId>@<semver>`.

Версии генерируются и хранятся в `localStorage` (на этапе SPA) или в БД (после Phase 2). Для калибровочных корпусов (Habr 333k) фиксируется одна версия на весь батч.

## Миграция существующих записей

Текущие записи в IndexedDB надо обновить **без потери данных**. Backfill:

```ts
extractionMeta: {
  source: 'manual',
  extractedAt: createdAt,
  maskVersion: 'legacy@0',
  ontologyVersion: 'legacy@0',
}
```

`alternatePositionIds`, `responsibilities`, `qualifications`, `education`, `certifications`, `languages` — backfill пустыми массивами/`undefined`. UI должен корректно отображать отсутствие этих полей (пустое состояние).

`title` для `Vacancy` — backfill из `getPositionName(positionId)` если есть, иначе `companyName`.

`headline`/`summary` для `Candidate` — backfill из `notes` (выделить первую строку как headline).

`location` остаётся как `string` для обратной совместимости. `address` опционален, заполняется только при импорте из новых источников.

## План имплементации

| # | Шаг | Файлы |
|---|---|---|
| 1 | Расширить типы | `src/entities/index.ts` |
| 2 | Версии в localStorage | `src/utils/versioning.ts` (новый) |
| 3 | Helpers для новых типов | `src/utils/normalizeAddress.ts`, `parseEducation.ts`, etc. |
| 4 | Dexie schema bump + миграция | `src/db/schema.ts` (новая версия) |
| 5 | Stores: добавить методы для новых полей | `src/stores/vacancyStore.ts`, `candidateStore.ts` |
| 6 | LLM промпты: добавить новые поля | `src/utils/llmExtractor.ts`, `promptComposer.ts` |
| 7 | Importers: расширить `NormalizedVacancy`/`NormalizedCandidate` | `src/utils/importNormalizer.ts` |
| 8 | hhConverter: заполнять новые поля | `src/utils/hhConverter.ts` |
| 9 | linkedinConverter (новый) | `src/utils/linkedinConverter.ts` |
| 10 | habrConverter (новый) | `src/utils/habrConverter.ts` |
| 11 | UI карточки: отображать новые поля | `src/components/VacancyCard/`, `CandidateCard/` |
| 12 | UI формы: редактировать новые поля | `src/pages/Vacancies/VacancyForm.tsx`, и т.д. |
| 13 | Preview cards в импортере | `src/pages/Admin/PreviewCards.tsx` |

Шаги 1–4 — фундамент, нельзя пропустить и нельзя растянуть на этапы (миграция должна быть атомарной).
Шаги 5–7 — функциональная база.
Шаги 8–10 — адаптеры под источники.
Шаги 11–13 — UI, может идти параллельно с 8–10.

## Что осознанно опускаем

- **Сетевые/мессенджер поля Habr** (ICQ, Skype, Jabber, AOL, Yahoo, Live, Google Talk, Mail.ru Agent, Я.Онлайн) — устаревшее, PII-нагруженное, бесполезное. Не сохраняем даже для калибровки.
- **`accept_handicapped`, `accept_kids`** (hh.ru) — слишком специфично для РФ, в LinkedIn/Habr нет аналога. Если понадобится — через `benefits`.
- **`premium`, `boostedAt`** — маркетинговые поля платформ, не наша забота.
- **`negotiations_url` без `apply_alternate_url`** — дублирующая информация.
- **`age` кандидата** — не сохраняем как поле (HR-дискриминация). Только bucket для калибровочной статистики, не на запись.
