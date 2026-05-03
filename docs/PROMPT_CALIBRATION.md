# PROMPT_CALIBRATION.md — пайплайн калибровки на 333k Habr Career

Спецификация подсистемы калибровки. Задача — превратить непрозрачный по провенансу xlsx-датасет в три надёжных продукта:

1. **Скилл-онтология**, валидированная на реальных русскоязычных профилях.
2. **Бенчмарк качества DeepSeek-экстракции** — измеримая цифра до и после изменений промпта.
3. **Семечко для shadow registry** — что реально присутствует в рынке, чего нет в нашем tool tree.

Калибровочный корпус **никогда** не используется как живые кандидаты, никогда не попадает в UI рекрутера, никогда не используется для outreach. Удаляется после завершения калибровки.

---

## 1. Принципы

| # | Правило | Почему |
|---|---|---|
| 1 | Сырой xlsx — `.gitignored` и хранится только локально | Провенанс непрозрачный, любое распространение = риск 152-ФЗ / GDPR |
| 2 | Анонимизация — на этапе импорта, до сохранения в БД | Потом откатить нельзя |
| 3 | Калибровочные данные живут в отдельной Postgres schema `calibration.*` | Изоляция от production-таблиц на уровне DB role |
| 4 | Из 333k не делается outreach **никогда** | Лиды берутся только из честных источников (бот, hh.ru API, открытый Telegram) |
| 5 | Только агрегаты коммитятся в репозиторий | Анонимизированные строки тоже коммитить нельзя — реверс-деаноним возможен по ник + локация + стек |
| 6 | После калибровки сырой файл удаляется, факт удаления документируется | Уменьшение поверхности риска |

---

## 2. Что в исходном датасете

**Формат:** `.xlsx`, 333 000 строк, ~30 колонок. Структура (с упрощением):

| Группа | Колонки в файле | Что с ними делаем |
|---|---|---|
| **Identity (PII)** | ФИО, Ссылка Хабр, Ссылка Профиль, Личный сайт | **DROP** |
| **Контакты (PII)** | Email, Телефон, Telegram, ICQ, Skype, Jabber, AOL, Yahoo, Live messenger, Google Talk, Mail.ru Агент, Я.Онлайн, Bitbucket, GitHub | **DROP** |
| **Стек / роли** | Стек (multi-role строка через ` - `) | parse: `headline`, `primary_position`, `alternate_positions[]` |
| **Доход** | Зарплата (`«От 50 000 ₽ - Не ищу работу»`) | parse: `salary_amount`, `salary_currency`, `salary_period`, `open_to_work` |
| **Опыт** | Опыт работы (`«11 лет 5 месяцев»`) | parse: `experience_months` |
| **Возраст (PII)** | Возраст | bucket по 5 лет (`«25-30»`, `«30-35»`) |
| **Активность (PII)** | Дата регистрации, Дата визита | загрубить до месяца |
| **Локация** | Локация (`«Россия, Москва»`) | parse через `parseAddressString` |
| **Готовность** | Дополнительная Информация (`«готов к удалённой работе»` etc.) | parse: `relocate`, `work_format` |
| **Навыки (полу-PII)** | Профессиональные Навыки (через ` - `) | parse: `skills_raw[]`, `skills_resolved[]` через resolveToolId |
| **About (PII-нагруженный)** | Обо мне | прогнать через PII-санитайзер |
| **История работы (PII)** | Опыт работы 1, …, 6 (текстовые описания) | прогнать через PII-санитайзер |

---

## 3. Структура пайплайна

```
data/raw/habr_333k.xlsx
        │  (off-repo, .gitignored, на локалке)
        ▼
scripts/calibration/anonymize.ts
        │  (Node, читает xlsx через `exceljs`)
        │   • drop PII columns
        │   • parse multi-role headlines
        │   • parse salary / openToWork
        │   • parse experience to months
        │   • parse address
        │   • bucket age
        │   • coarsen dates to month
        │   • run PII-sanitizer on free-text fields
        ▼
data/processed/habr_anon.jsonl
        │  (333k JSONL, .gitignored, локально)
        ▼
POST /api/v1/calibration/import (admin only, batch=10000)
        │
        ▼
calibration.candidates (Postgres schema)
        │
        ├── scripts/calibration/run-extraction.ts
        │   sample 1000 → DeepSeek extract → compare with raw → quality.json
        │
        ├── scripts/calibration/aggregate-skills.ts
        │   group by primary_position → skill counts → skill_frequency.json
        │
        ├── scripts/calibration/aggregate-cooccurrence.ts
        │   pairwise within role → stack_cooccurrence.json
        │
        └── scripts/calibration/grade-experience.ts
            distribution by grade × months → grade_experience.json
        │
        ▼
data/calibration/                    (committed)
  ├── skill_frequency.json
  ├── stack_cooccurrence.json
  ├── grade_experience.json
  ├── extraction_quality.json
  └── README.md
        │
        ▼
shadow_registry_entries (Postgres) ← seeded from skill_frequency
        │
        ▼
[Phase 3: рекрутер просматривает в UI /registry, принимает в канон]
```

---

## 4. Скрипт `anonymize.ts`

**Расположение:** `scripts/calibration/anonymize.ts`

**Запуск:** `npm run calibration:anonymize -- --input ./data/raw/habr_333k.xlsx --output ./data/processed/habr_anon.jsonl`

**Псевдокод:**

```typescript
import ExcelJS from 'exceljs';
import { createWriteStream } from 'fs';
import {
  parseSalaryString,
  parseAddressString,
  parseExperienceMonths,
  parseOpenToWorkString,
  resolveToolIdFromAliases,
} from '../../apps/web/src/utils';
import { sanitizePII } from './piiSanitizer';
import { hashStable } from './hashUtil';

// Колонки, которые игнорируем полностью
const PII_COLUMNS = new Set([
  'ФИО', 'Ссылка Хабр', 'Ссылка Профиль', 'Email', 'Почта', 'Телефон',
  'Telegram', 'ICQ', 'Skype', 'Jabber', 'AOL', 'Yahoo', 'Live messenger',
  'Google Talk', 'Mail.ru Агент', 'Я.Онлайн', 'Bitbucket', 'GitHub',
  'Другой', 'Личный сайт',
]);

interface AnonRecord {
  pseudonym: string;
  headline?: string;
  primary_position?: string;
  alternate_positions?: string[];
  skills_raw?: string[];
  skills_resolved?: string[];
  experience_months?: number;
  salary_amount?: number;
  salary_currency?: string;
  salary_period?: string;
  open_to_work?: string;
  age_bucket?: string;
  registered_month?: string;
  last_active_month?: string;
  country?: string;
  city?: string;
  summary?: string;        // PII-санитайзер прошёл
  work_history?: WorkEntryAnon[];
  source: 'habr_calibration';
}

const workbook = new ExcelJS.stream.xlsx.WorkbookReader('./data/raw/habr_333k.xlsx');
const out = createWriteStream('./data/processed/habr_anon.jsonl');

let processed = 0;
let dropped = 0;

for await (const worksheet of workbook) {
  let headerRow: string[] = [];
  for await (const row of worksheet) {
    if (row.number === 1) {
      headerRow = row.values as string[];
      continue;
    }
    const raw: Record<string, unknown> = {};
    headerRow.forEach((col, i) => {
      if (col && !PII_COLUMNS.has(col)) raw[col] = row.values[i];
    });

    // Псевдоним: hash от Habr URL (стабильный, но необратимый)
    const habrUrl = String(row.values[headerRow.indexOf('Ссылка Хабр')] ?? '');
    const pseudonym = `cand_${hashStable(habrUrl).slice(0, 12)}`;

    // Стек: "DevOps - Sysadmin - Network Engineer"
    const stackRaw = String(raw['Стек'] ?? '');
    const roles = stackRaw.split(' - ').map((s) => s.trim()).filter(Boolean);
    const primaryPosition = roles[0] ? resolveToolIdFromAliases(roles[0]) : undefined;
    const alternates = roles.slice(1).map(resolveToolIdFromAliases).filter(Boolean) as string[];

    // Зарплата
    const salaryRaw = String(raw['Зарплата'] ?? '');
    const salaryParsed = parseSalaryString(salaryRaw);
    const openToWork = parseOpenToWorkString(salaryRaw);

    // Опыт
    const expMonths = parseExperienceMonths(String(raw['Опыт работы'] ?? ''));

    // Возраст
    const ageNum = Number(String(raw['Возраст'] ?? '').match(/\d+/)?.[0] ?? '');
    const ageBucket = Number.isFinite(ageNum) ? bucketAge(ageNum) : undefined;

    // Локация
    const addr = parseAddressString(String(raw['Локация'] ?? ''));

    // Профессиональные навыки
    const skillsRaw = String(raw['Профессиональные Навыки'] ?? '')
      .split(' - ')
      .map((s) => s.trim())
      .filter(Boolean);
    const skillsResolved = skillsRaw
      .map(resolveToolIdFromAliases)
      .filter((id): id is string => !!id);

    // Обо мне — обязательно через PII-санитайзер
    const summary = sanitizePII(String(raw['Обо Мне'] ?? ''));

    // Опыт работы 1-6
    const workHistory: WorkEntryAnon[] = [];
    for (let i = 1; i <= 6; i++) {
      const text = String(raw[`Опыт работы ${i}`] ?? '').trim();
      if (text) {
        workHistory.push({
          description: sanitizePII(text),
          // company name остаётся, но через санитайзер — он чистит "ООО Иван Петров"-style
        });
      }
    }

    const record: AnonRecord = {
      pseudonym,
      headline: roles[0] || undefined,
      primary_position: primaryPosition,
      alternate_positions: alternates,
      skills_raw: skillsRaw,
      skills_resolved: skillsResolved,
      experience_months: expMonths,
      salary_amount: salaryParsed.salaryFrom,
      salary_currency: salaryParsed.currency,
      salary_period: salaryParsed.salaryPeriod,
      open_to_work: openToWork,
      age_bucket: ageBucket,
      registered_month: coarsenToMonth(String(raw['Дата Регистрации'] ?? '')),
      last_active_month: coarsenToMonth(String(raw['Дата Визита'] ?? '')),
      country: addr?.country,
      city: addr?.city,
      summary: summary || undefined,
      work_history: workHistory,
      source: 'habr_calibration',
    };

    out.write(JSON.stringify(record) + '\n');
    processed++;
    if (processed % 10000 === 0) console.log(`processed ${processed}, dropped ${dropped}`);
  }
}

console.log(`Final: processed=${processed}, dropped=${dropped}`);
out.end();

function bucketAge(n: number): string | undefined {
  if (n < 18 || n > 80) return undefined;
  const lo = Math.floor(n / 5) * 5;
  return `${lo}-${lo + 5}`;
}
```

**PII-санитайзер (`scripts/calibration/piiSanitizer.ts`):**

Двухуровневая санитизация free-text полей:

1. **Regex-passes** для обязательных удалений:
   - email-адреса → `[email]`
   - телефоны RU/MD/UA/KZ → `[phone]`
   - URL → `[url]`
   - Telegram-handle (`@username`) → `[handle]`
   - длинные подряд-числа (потенциально ИНН/паспорт) → `[number]`

2. **Опционально DeepSeek-pass** для именованных сущностей:
   - имена коллег (без названий должностей)
   - точные имена компаний с ФИО («Иван Петров и партнёры» → `[company]`)
   
   Только для `summary` и `work_history`. Не для остальных полей — там regex хватает.

```typescript
const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
const PHONE_RE = /(?:\+7|7|8)\s*\(?\d{3}\)?\s*\d{3}[\s-]?\d{2}[\s-]?\d{2}/g;
const URL_RE = /https?:\/\/[^\s]+/g;
const HANDLE_RE = /@[a-zA-Z0-9_]{3,32}/g;
const LONG_NUM_RE = /\b\d{8,}\b/g;

export function sanitizePII(text: string): string {
  if (!text) return '';
  return text
    .replace(EMAIL_RE,    '[email]')
    .replace(PHONE_RE,    '[phone]')
    .replace(URL_RE,      '[url]')
    .replace(HANDLE_RE,   '[handle]')
    .replace(LONG_NUM_RE, '[number]')
    .trim();
}

// Optional second pass — DeepSeek removes named entities.
// Run only on summary and work_history. Batch 10 records per request to amortize.
export async function deepseekSanitize(texts: string[]): Promise<string[]> { /* ... */ }
```

**Acceptance:**

- 333k записей → ровно 333k JSONL строк (или меньше, если есть невалидные/пустые).
- В выходных JSONL ни в одной строке не присутствуют: email, phone, real telegram handle, full URL, ссылка на habr.
- Случайная выборка 100 записей вручную проверяется reviewer'ом перед import'ом.

---

## 5. Postgres schema `calibration.*`

```sql
CREATE SCHEMA calibration;

-- DB role specifically for calibration scripts. Cannot read prod tables.
CREATE ROLE calibration_writer LOGIN PASSWORD '<from-secrets>';
GRANT USAGE ON SCHEMA calibration TO calibration_writer;
GRANT INSERT, SELECT, UPDATE, DELETE ON ALL TABLES IN SCHEMA calibration TO calibration_writer;

-- Main app role: read-only on aggregates, no access to raw candidates.
CREATE ROLE recruit_api_calibration_reader LOGIN PASSWORD '<from-secrets>';
GRANT USAGE ON SCHEMA calibration TO recruit_api_calibration_reader;
GRANT SELECT ON calibration.skill_frequency,
                calibration.stack_cooccurrence,
                calibration.grade_experience,
                calibration.extraction_quality
   TO recruit_api_calibration_reader;
-- NOTE: candidates table NOT granted to reader.

CREATE TABLE calibration.candidates (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pseudonym         TEXT NOT NULL UNIQUE,
    headline          TEXT,
    primary_position  TEXT,
    alternate_positions TEXT[],
    skills_raw        TEXT[],
    skills_resolved   TEXT[],
    experience_months INT,
    salary_amount     NUMERIC,
    salary_currency   TEXT,
    salary_period     TEXT,
    open_to_work      TEXT,
    age_bucket        TEXT,
    country           TEXT,
    city              TEXT,
    summary           TEXT,
    work_history      JSONB,
    extraction_meta   JSONB NOT NULL,
    imported_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_calib_cand_role ON calibration.candidates (primary_position);
CREATE INDEX idx_calib_cand_country ON calibration.candidates (country);
CREATE INDEX idx_calib_cand_skills_gin ON calibration.candidates USING GIN (skills_resolved);

CREATE TABLE calibration.skill_frequency (
    role_id        TEXT NOT NULL,
    skill_id       TEXT NOT NULL,
    occurrences    INT NOT NULL,
    pct_of_role    NUMERIC(5,2) NOT NULL,
    snapshot_date  DATE NOT NULL,
    PRIMARY KEY (role_id, skill_id, snapshot_date)
);

CREATE TABLE calibration.stack_cooccurrence (
    role_id        TEXT NOT NULL,
    skill_a        TEXT NOT NULL,
    skill_b        TEXT NOT NULL,
    cooccurrences  INT NOT NULL,
    snapshot_date  DATE NOT NULL,
    PRIMARY KEY (role_id, skill_a, skill_b, snapshot_date)
);

CREATE TABLE calibration.grade_experience (
    role_id        TEXT NOT NULL,
    grade          TEXT NOT NULL,
    months_p25     INT NOT NULL,
    months_p50     INT NOT NULL,
    months_p75     INT NOT NULL,
    sample_size    INT NOT NULL,
    snapshot_date  DATE NOT NULL,
    PRIMARY KEY (role_id, grade, snapshot_date)
);

CREATE TABLE calibration.extraction_quality (
    snapshot_date     DATE NOT NULL,
    extractor_version TEXT NOT NULL,
    sample_size       INT NOT NULL,
    accuracy_skills   NUMERIC(4,3),     -- доля правильно резолвенных навыков
    accuracy_grade    NUMERIC(4,3),     -- доля правильно определённых грейдов
    accuracy_salary   NUMERIC(4,3),
    notes             TEXT,
    PRIMARY KEY (snapshot_date, extractor_version)
);
```

---

## 6. Эндпоинт импорта

`POST /api/v1/calibration/import` (admin only, JWT с ролью `admin`).

**Тело:**

```json
{
  "batch": [ /* до 10000 AnonRecord */ ],
  "extraction_meta": {
    "source": "habr",
    "extracted_at": "2026-05-03T...",
    "extraction_model": "anonymize-script-v1",
    "ontology_version": "tooltree@2.1"
  }
}
```

**Поведение:**

1. Валидирует JWT, проверяет роль admin.
2. Пишет в `calibration.candidates` через `calibration_writer` role.
3. Дедупит по `pseudonym`.
4. Возвращает `{ inserted: N, duplicates: M, errors: [...] }`.

**Rate limiting:** 10 запросов/мин (батчи большие, спешить некуда).

---

## 7. Скрипт `run-extraction.ts` (валидация качества)

**Цель:** замерить, насколько качественно DeepSeek восстанавливает структуру из «сырых» полей профиля Хабра, по сравнению с тем, что мы уже распарсили regex'ами.

**Алгоритм:**

```typescript
const sample = await db.query(`
  SELECT pseudonym, headline, summary, work_history, skills_raw, primary_position
  FROM calibration.candidates
  ORDER BY RANDOM()
  LIMIT 1000
`);

const results = [];
for (const cand of sample) {
  // Сначала собираем "сырой текст" — то, что бы прислал OpenClaw до парсинга
  const rawText = [
    cand.headline,
    cand.summary,
    ...cand.work_history.map(w => w.description),
  ].filter(Boolean).join('\n\n');

  // Mask dictionary для роли
  const mask = await fetchMask(cand.primary_position);

  // DeepSeek extract
  const extracted = await deepseekExtract(rawText, mask);

  // Сравниваем с эталоном (skills_raw из исходного парсинга)
  const accuracy = compareSkills(extracted.skills, cand.skills_raw);

  results.push({ pseudonym: cand.pseudonym, accuracy, ... });
}

// Aggregate → extraction_quality.json
```

**Метрики:**

- `accuracy_skills` — Jaccard similarity между `extracted.skills_resolved` и эталонными `skills_resolved`.
- `accuracy_grade` — точное совпадение определённого грейда.
- `accuracy_salary` — попадание в ±20% от диапазона.

**Acceptance Phase 2:** все три метрики ≥ 0.85 на выборке 1000.

---

## 8. Агрегаты

### `skill_frequency.json`

```json
{
  "snapshot_date": "2026-05-03",
  "ontology_version": "tooltree@2.1",
  "sample_size": 333000,
  "by_role": {
    "pos_backend": {
      "sample_size": 45122,
      "top_skills": [
        { "skill_id": "tool_python",   "occurrences": 38104, "pct": 84.4 },
        { "skill_id": "tool_postgres", "occurrences": 29871, "pct": 66.2 },
        { "skill_id": "tool_docker",   "occurrences": 28210, "pct": 62.5 }
      ],
      "unmapped": [
        { "term": "langchain",   "occurrences": 1240, "pct": 2.7 },
        { "term": "starlette",   "occurrences":  870, "pct": 1.9 }
      ]
    },
    "pos_frontend": { ... }
  }
}
```

### `stack_cooccurrence.json`

```json
{
  "snapshot_date": "2026-05-03",
  "by_role": {
    "pos_backend": {
      "tool_python": {
        "tool_django":   { "cooccurrences": 18420, "lift": 2.34 },
        "tool_fastapi":  { "cooccurrences":  7210, "lift": 4.12 },
        "tool_postgres": { "cooccurrences": 22450, "lift": 1.87 }
      }
    }
  }
}
```

`lift` = `P(B|A) / P(B)` — насколько навык B чаще встречается в присутствии A, чем в среднем.

### `grade_experience.json`

```json
{
  "snapshot_date": "2026-05-03",
  "by_role": {
    "pos_backend": {
      "junior":     { "p25":  6,  "p50": 12, "p75": 18, "n": 4521 },
      "middle":     { "p25": 24,  "p50": 36, "p75": 60, "n": 18402 },
      "senior":     { "p25": 60,  "p50": 84, "p75": 120, "n": 17284 }
    }
  }
}
```

Используется для калибровки `coerceGrade(experienceMonths)` — что значит «middle» в реальном рынке.

### `extraction_quality.json`

```json
{
  "snapshot_date": "2026-05-03",
  "extractor_version": "deepseek-v4-flash@2026-04",
  "prompt_version": "extract-vacancy-v3.2",
  "sample_size": 1000,
  "accuracy_skills": 0.87,
  "accuracy_grade":  0.91,
  "accuracy_salary": 0.83,
  "notes": "salary accuracy низкая — модель промахивается на «От N до M $/year» (period detection)"
}
```

Снимок при каждой смене промпта или модели — видим тренд.

---

## 9. Что попадает в shadow registry

После генерации `skill_frequency.json` запускается seed:

```typescript
for (const role of Object.keys(skillFrequency.by_role)) {
  const roleData = skillFrequency.by_role[role];
  for (const unmapped of roleData.unmapped) {
    if (unmapped.pct < 1.0) continue;  // < 1% — шум

    await db.shadow_registry_entries.insert({
      term: unmapped.term,
      frequency: unmapped.occurrences,
      sample_role_ids: [role],
      sample_examples: [/* пример 5-10 фрагментов */],
      confidence: null,  // заполнит DeepSeek Pro в consolidate
      status: 'incubating',
    });
  }
}
```

Дальше Phase 3: OpenClaw consolidator раз в сутки прогоняет это через DeepSeek Pro:

> «Является ли `langchain` синонимом существующего инструмента в нашем дереве? Если нет, к какой подкатегории его логично отнести?»

И помечает с `confidence`. Рекрутер в UI принимает / отклоняет.

---

## 10. Удаление корпуса

Калибровочный корпус живёт **пока проводится калибровка**. После Phase 2 acceptance:

1. `data/raw/habr_333k.xlsx` — `rm -f`.
2. `data/processed/habr_anon.jsonl` — `rm -f`.
3. `calibration.candidates` — `TRUNCATE` (агрегаты остаются).
4. В `data/calibration/README.md` фиксируется дата удаления и agreggates snapshot.
5. Доступ DB role `calibration_writer` отзывается (`DROP ROLE`).

После удаления:

- Воспроизвести нельзя — это и есть цель.
- Агрегаты остаются как «снимок рынка на дату X». Они анонимны, безопасны для коммита.

---

## 11. Acceptance criteria Phase 2

- [ ] `data/raw/habr_333k.xlsx` существует только на локалке, в `.gitignore`.
- [ ] `scripts/calibration/anonymize.ts` запущен, `data/processed/habr_anon.jsonl` собран без PII (verified ручной выборкой 100 строк).
- [ ] Postgres schema `calibration.*` создан с двумя ролями (writer, reader).
- [ ] 333k записей загружены в `calibration.candidates` через `POST /api/v1/calibration/import`.
- [ ] Скрипты `aggregate-skills.ts`, `aggregate-cooccurrence.ts`, `grade-experience.ts` запущены, агрегаты лежат в `data/calibration/*.json`.
- [ ] `run-extraction.ts` показывает все три метрики ≥ 0.85.
- [ ] Shadow registry seeded, в нём ≥ 100 кандидатов на пополнение.
- [ ] Сырой xlsx удалён, факт зафиксирован.
- [ ] `docs/CALIBRATION_RUNBOOK.md` (или README в `data/calibration/`) фиксирует: дата калибровки, версия онтологии на момент калибровки, метрики качества.

---

## 12. Вопросы, которые остаются открытыми

1. **Юридический статус калибровочного использования.** Даже без outreach есть позиция «обработка ПДн = хранение в БД». Юрист должен подтвердить, что:
   - Анонимизация наших регулярок достаточна для снятия с записи статуса ПДн.
   - Изолированная schema + DROP после калибровки укладывается в принципы 152-ФЗ.
2. **Использование DeepSeek-санитайзера.** Шлёт ли он данные на сторонний сервер? Если да — это уже факт передачи третьему лицу. Стоит запустить локальную модель (Ollama + Qwen или DeepSeek-Coder локально) для второго прохода.
3. **Калибровка повторяется?** Если да — каким датасетом заменить Habr 333k? Может, hh.ru API export из-под рекрутерского аккаунта, где провенанс прозрачный.

Эти вопросы фиксируются как ADR в `docs/adr/` перед стартом Phase 2.
