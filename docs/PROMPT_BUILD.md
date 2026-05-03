# PROMPT_BUILD.md — полный промпт разработки Recruit

Единый промпт для перехода от текущего SPA-прототипа к боевой системе с фронтендом, бэкендом, БД, виртуальным ассистентом OpenClaw и Telegram-ботом.

Документ — **мастер**. Все детали по слоям вынесены в отдельные спеки и линкуются по тексту.

| Спека | Что внутри |
|---|---|
| [PROMPT_BACKEND.md](./PROMPT_BACKEND.md) | FastAPI, SQLAlchemy, миграции, API v1 |
| [PROMPT_FRONTEND.md](./PROMPT_FRONTEND.md) | React → tanstack-query, миграция со SPA |
| [SCHEMA.md](./SCHEMA.md) | Postgres схема, индексы, RLS |
| [SCHEMA_AUDIT.md](./SCHEMA_AUDIT.md) | Расширение канонической модели под hh / LinkedIn / Habr |
| [PROMPT_CALIBRATION.md](./PROMPT_CALIBRATION.md) | Пайплайн калибровки на 333k Habr |
| [PROMPT_OPENCLAW.md](./PROMPT_OPENCLAW.md) | Виртуальный ассистент: агент + скиллы + контракты |
| [PROMPT_TELEGRAM_BOT.md](./PROMPT_TELEGRAM_BOT.md) | Боты: приём резюме, выдача вакансий, аналитика |
| [ROADMAP.md](./ROADMAP.md) | Фазы, таймлайн |
| [OPTIMIZATION.md](./OPTIMIZATION.md) | Перфоманс по слоям |

---

## 0. Принцип MVP-first

Любая фича строится в три захода:

1. **Простейший рабочий контур end-to-end.** Без ML, без асинхронных очередей, без оптимизаций. Цель — данные проходят сквозь систему и возвращаются обратно.
2. **Функциональная полнота.** Покрытие реальных сценариев, обработка ошибок, валидация, нормальный UX.
3. **Перфоманс/масштаб.** Только когда замеры показывают реальное узкое место.

Запрещено в Phase 1:

- Celery / RQ workers (`BackgroundTasks` достаточно)
- pgvector, embeddings, ML-ranking
- WebSocket / SSE (поллинг с `staleTime: 30s` хватит)
- Materialized views, partitioning, RLS (workspace_id фильтрация в репах)
- Виртуализация списков (включаем при 200+ карточек)
- Optimistic updates (включаем когда поллинг становится узким местом)
- Sentry / OpenTelemetry / Prometheus (default logging достаточно)

Всё это легально появляется в Phase 3-4 — но не раньше.

---

## 1. Бизнес-контекст

**Что:** B2B-сервис подбора IT-специалистов и сопровождения воронки найма.

**Кто пользователи:**

| Роль | Что делает | Через что |
|---|---|---|
| Рекрутер / HR | CRUD вакансий и кандидатов, ручной матчинг, ведение пайплайна, аналитика | Web SPA |
| Нанимающий менеджер | Ревью кандидатов в воронке, оставляет фидбэк | Web SPA |
| Кандидат (внешний) | Загружает резюме, получает рассылку вакансий, спрашивает аналитику | Telegram бот |
| Виртуальный ассистент | Сканирует Telegram-каналы, классифицирует посты, конвертирует резюме/вакансии, предлагает обновления маски | OpenClaw + DeepSeek |

**Источники данных:**

1. **Внутренние** — то, что рекрутеры заводят руками или импортируют через UI.
2. **Внешние через виртуального ассистента** — Telegram-каналы (вакансии, резюме, прожарки, проф-ориентация, проектные посты, тимы).
3. **Калибровочный корпус** — 333k анонимизированных профилей с Habr Career, **только для калибровки экстракции и онтологии**, никогда не отображается как живые кандидаты.
4. **Будущее (Phase 4+)** — hh.ru API, LinkedIn (если будет легальный канал доступа).

---

## 2. Архитектурный обзор

```
                                ┌─────────────────────────┐
                                │      Web SPA (React)    │
                                │   рекрутерский UI       │
                                └────────────┬────────────┘
                                             │ REST + JWT
                                             ▼
┌──────────────┐  REST + API key    ┌─────────────────────┐
│   OpenClaw   │ ────────────────▶  │   FastAPI backend   │  ◀── Postgres + Redis
│   (агент)    │                    │   /api/v1, /webhook │
│   + DeepSeek │  ◀──────────────── │                     │
└──────┬───────┘   GET /masks       └──────────┬──────────┘
       │                                       │ webhook
       │ MTProto                               │
       ▼                                       ▼
┌──────────────┐                    ┌─────────────────────┐
│   Telegram   │  ◀──── webhook ─── │   Telegram Bot      │
│   (каналы +  │                    │   (BotFather API)   │
│    DM боту)  │ ────── DM ───────▶ └─────────────────────┘
└──────────────┘
```

**Сервисы:**

| Сервис | Технология | Где живёт | Зачем |
|---|---|---|---|
| `recruit-api` | FastAPI 3.12 + SQLAlchemy 2.0 async | Docker | API + бизнес-логика + источник истины |
| `recruit-web` | Vite 6 + React 19 + tanstack-query | nginx статика | UI рекрутера |
| `recruit-bot` | aiogram 3.x | внутри recruit-api или отдельный контейнер | Telegram-бот для кандидатов и подписчиков |
| `recruit-openclaw` | OpenClaw + DeepSeek API | локально на машине рекрутера или на отдельном VPS | Виртуальный ассистент для harvesting |
| `recruit-db` | Postgres 16 + pg_trgm + unaccent + pgvector (Phase 4) | Docker volume | Источник истины |
| `recruit-cache` | Redis 7 | Docker | tool_tree cache, rate limiter, RQ-очередь (Phase 3+) |

**Принципы коммуникации:**

- Web SPA ↔ API: REST + JWT (15 мин access, 30 дней refresh, HttpOnly cookies)
- OpenClaw ↔ API: REST + API key в заголовке `X-Recruit-Api-Key` (отдельный канал auth, scoped права на ingest + read masks)
- Telegram ↔ API: webhook на `/webhook/telegram/<bot_token>`, валидация по `X-Telegram-Bot-Api-Secret-Token`
- OpenClaw ↔ DeepSeek: HTTPS REST с DeepSeek API key, prompt caching включён по умолчанию
- OpenClaw ↔ Telegram: MTProto через telethon/pyrogram (нужно для чтения каналов; bot API не даёт `channel.messages`)

**Изоляция:**

- OpenClaw **никогда не пишет в БД напрямую** — только через API.
- OpenClaw **не имеет доступа** к таблицам `users`, `auth_*`, `audit_*`. Только `/api/v1/ingest/*`, `/api/v1/masks/*`, `/api/v1/shadow-registry/*`.
- API key OpenClaw rate-limited (60 запросов/мин) и scoped к одному workspace.
- Telegram bot **не получает прямой доступ** к БД — только через FastAPI router.

---

## 3. Технологический стек

### Backend

| Слой | Технология | Версия |
|---|---|---|
| Язык | Python | 3.12+ |
| Web | FastAPI | 0.115+ |
| ORM | SQLAlchemy | 2.0 (async) |
| Migrations | Alembic | latest |
| Validation | Pydantic | v2 |
| HTTP client | httpx | latest |
| Auth | python-jose, passlib[bcrypt] | latest |
| Telegram | aiogram | 3.x |
| Tests | pytest-asyncio + factory_boy | latest |
| DB | PostgreSQL | 16+ |
| Cache | Redis | 7+ |

### Frontend

| Слой | Технология | Версия |
|---|---|---|
| Build | Vite | 6 |
| UI | React + TypeScript | 19 + 5.9 |
| Server state | @tanstack/react-query | 5+ |
| Client state | zustand | 5 |
| HTTP | ky + openapi-typescript | latest |
| Forms | react-hook-form + zod | latest |
| Routing | react-router | 7 |
| Charts | recharts (Phase 1), visx (Phase 3+) | 2 / latest |
| DnD | @dnd-kit | latest |
| Icons | lucide-react | latest |
| Styles | CSS Modules | — |
| Tests | Vitest + Testing Library + Playwright + MSW | latest |

### Инфраструктура

| Слой | Технология |
|---|---|
| Container | Docker + docker-compose (local), k8s или nomad (prod) |
| CI/CD | GitHub Actions |
| Logs | stdout JSON → Loki / Grafana (Phase 3+) |
| Errors | Sentry (Phase 3+) |
| Reverse proxy | nginx (TLS, статика) |

### Виртуальный ассистент

| Компонент | Технология |
|---|---|
| Агент-фреймворк | OpenClaw self-hosted gateway |
| LLM extraction | DeepSeek V4 Flash (массовая экстракция, классификация) |
| LLM consolidation | DeepSeek V4 Pro (раз в сутки — обновления shadow registry) |
| Telegram чтение | telethon (MTProto user-API, требует регистрации app + телефонной авторизации) |
| Локальный state | SQLite (последний обработанный message_id, watch list каналов) |

---

## 4. Структура репозитория

```
recruit/
├── apps/
│   ├── backend/              # FastAPI приложение
│   │   ├── app/
│   │   │   ├── main.py
│   │   │   ├── core/         # config, security, db, deps
│   │   │   ├── models/       # SQLAlchemy модели
│   │   │   ├── schemas/      # Pydantic схемы
│   │   │   ├── repos/        # data access слой
│   │   │   ├── services/     # бизнес-логика (matching, masks, ingest)
│   │   │   ├── api/v1/       # роутеры
│   │   │   ├── webhooks/     # /webhook/telegram, /webhook/...
│   │   │   ├── bots/         # aiogram handlers
│   │   │   └── workers/      # background tasks (RQ — Phase 3+)
│   │   ├── alembic/
│   │   ├── tests/
│   │   └── pyproject.toml
│   ├── web/                  # React SPA (наследник текущего src/)
│   │   ├── src/
│   │   ├── vite.config.ts
│   │   └── package.json
│   └── openclaw/             # spec + конфиги для OpenClaw агента
│       ├── skills/           # JSON/YAML описания скиллов
│       ├── prompts/          # системные промпты по типу контента
│       └── README.md
├── packages/
│   └── shared-types/         # OpenAPI-сгенерированные TS-типы для фронта
├── data/
│   ├── raw/                  # .gitignored — сырой Habr xlsx и подобное
│   ├── processed/            # .gitignored — анонимизированный jsonl
│   └── calibration/          # коммитимые агрегаты (skill_frequency.json и т. д.)
├── scripts/
│   └── calibration/          # одноразовые скрипты обработки корпуса
├── docs/                     # эта папка
├── docker-compose.yml
├── docker-compose.prod.yml
├── .github/workflows/
└── README.md
```

Ноды apps/ — независимые деплоимые юниты.
Контракты между ними — OpenAPI (бэкенд → клиент-типы) и API key (OpenClaw → бэкенд).

---

## 5. Доменная модель

См. [SCHEMA_AUDIT.md](./SCHEMA_AUDIT.md) — там матрица полей hh × LinkedIn × Habr и расширенный канон. Краткая сводка:

**Сущности:**

- `Workspace` — изоляция тенантов
- `User` — рекрутеры / нанимающие менеджеры с ролями
- `Tool`, `ToolSubcategory`, `ToolCategory` — иерархия инструментов
- `Position` — шаблон/маска должности (динамические группы подкатегорий)
- `Vacancy` — конкретная вакансия с min/max requirements
- `Candidate` — кандидат + `WorkEntry[]`
- `Pipeline` + `PipelineStage` + `PipelineCard` — воронка найма
- `MatchScore` — кэш матчинга (Phase 3+; Phase 1 — on-demand)
- `ResponseEvent` — хроника откликов
- `RecruitmentTask` — задачи воронки

**Новые сущности (введены этим документом):**

- `InboxItem` — пост из Telegram-канала, ещё не проконвертированный (статус: `raw` / `classified` / `extracted` / `imported` / `skipped` / `error`)
- `LeadItem` — пост типа `roast_request` / `career_advice` / `project_post` / `team_search` (накапливается без обработки, для будущего outreach)
- `ShadowRegistryEntry` — кандидаты на пополнение онтологии («вижу `langchain` в 12 % backend-вакансий — добавить в маску?»)
- `ProjectTemplate` — типовой состав команды для проекта (Phase 4+)
- `CalibrationCandidate` / `CalibrationVacancy` — анонимизированные записи из корпуса (изолированные таблицы, **не** показываются в UI рекрутера)
- `TelegramSubscription` — подписка пользователя бота на digest вакансий
- `TelegramChannel` — список каналов, которые сканирует OpenClaw
- `AssistantConversation` — история чатов рекрутера с виртуальным ассистентом (Phase 4)

Каждая запись (`Vacancy`, `Candidate`, `WorkEntry`, `InboxItem`) несёт `extraction_meta`:

```json
{
  "source": "hh|linkedin|habr|telegram|manual|llm",
  "external_id": "73512891",
  "extracted_at": "2026-05-03T12:34:56Z",
  "extraction_model": "deepseek-v4-flash",
  "mask_version": "pos_backend@1.3",
  "ontology_version": "tooltree@2.1",
  "extraction_quality": 0.87
}
```

Это нужно для пересчёта матчинга и shadow registry без потери провенанса.

---

## 6. БД-схема

См. [SCHEMA.md](./SCHEMA.md) — основа.

**Дополнения этого документа:**

```sql
-- ── OpenClaw / Telegram inbox ─────────────────────────────
CREATE TABLE telegram_channels (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    handle          TEXT NOT NULL,                -- @some_jobs_channel
    title           TEXT,
    discovered_via  TEXT,                          -- 'manual' | 'recommendation' | 'crawl'
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    last_message_id BIGINT,                        -- для инкрементальной выгрузки
    expected_kind   TEXT,                          -- 'vacancies' | 'resumes' | 'mixed' | 'projects'
    quality_score   NUMERIC(3,2),                  -- 0..1, обновляется по доле полезных постов
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (workspace_id, handle)
);

CREATE TABLE inbox_items (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id     UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    channel_id       UUID REFERENCES telegram_channels(id) ON DELETE SET NULL,
    source           TEXT NOT NULL,                -- 'telegram' | 'bot_dm' | 'manual'
    external_id      TEXT,                         -- channel_msg_id или dm_msg_id
    raw_text         TEXT NOT NULL,
    raw_html         TEXT,
    received_at      TIMESTAMPTZ NOT NULL,
    classified_as    TEXT,                          -- 'vacancy' | 'resume' | 'project_post' | 'team_search' | 'roast_request' | 'career_advice' | 'other'
    classified_role  TEXT,                          -- 'pos_backend' | 'pos_frontend' | ...
    classification_confidence NUMERIC(3,2),
    status           TEXT NOT NULL DEFAULT 'raw',  -- 'raw' | 'classified' | 'extracted' | 'imported' | 'skipped' | 'error'
    error_text       TEXT,
    imported_id      UUID,                          -- Vacancy.id или Candidate.id, если status='imported'
    extraction_meta  JSONB,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_inbox_workspace_status ON inbox_items (workspace_id, status, received_at DESC);
CREATE INDEX idx_inbox_classified ON inbox_items (workspace_id, classified_as, classified_role);

-- ── Shadow registry ───────────────────────────────────────
CREATE TABLE shadow_registry_entries (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id     UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    term             TEXT NOT NULL,                -- 'langchain', 'svelte', 'rust' и т. п.
    proposed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    frequency        INT NOT NULL DEFAULT 1,        -- сколько раз встретилось за окно
    sample_role_ids  TEXT[],                        -- из каких ролей пришло
    sample_examples  JSONB,                          -- 5-10 фрагментов текста
    confidence       NUMERIC(3,2),                  -- LLM consolidator подтверждает на пер. этапе
    status           TEXT NOT NULL DEFAULT 'incubating', -- 'incubating' | 'proposed' | 'accepted' | 'rejected'
    decided_at       TIMESTAMPTZ,
    decided_by       UUID REFERENCES users(id),
    canonical_tool_id UUID REFERENCES tools(id),    -- если accepted — ссылка на канон
    UNIQUE (workspace_id, term)
);

-- ── Калибровочный корпус (изолирован от прода) ─────────────
CREATE SCHEMA calibration;

CREATE TABLE calibration.candidates (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- никаких имён, контактов, профильных URL
    pseudonym         TEXT NOT NULL,                -- 'cand_<hash>', deterministic
    headline          TEXT,                          -- "DevOps / Sysadmin / Network Engineer"
    summary           TEXT,                          -- "Обо мне" — пропущено через PII-санитайзер
    primary_position  TEXT,                          -- 'pos_devops'
    alternate_positions TEXT[],
    skills_raw        TEXT[],                        -- из «Профессиональные навыки»
    skills_resolved   TEXT[],                        -- canonical tool ids
    experience_months INT,
    salary_amount     NUMERIC,
    salary_currency   TEXT,
    salary_period     TEXT,
    open_to_work      TEXT,
    age_bucket        TEXT,                          -- '20-25', '25-30', ...
    country           TEXT,
    city              TEXT,
    work_history      JSONB,                         -- массив work_entries (анонимизированные)
    extraction_meta   JSONB NOT NULL,
    imported_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE calibration.skill_frequency (
    role_id          TEXT NOT NULL,
    skill_id         TEXT NOT NULL,
    occurrences      INT NOT NULL,
    pct_of_role      NUMERIC(5,2) NOT NULL,
    snapshot_date    DATE NOT NULL,
    PRIMARY KEY (role_id, skill_id, snapshot_date)
);

CREATE TABLE calibration.stack_cooccurrence (
    role_id          TEXT NOT NULL,
    skill_a          TEXT NOT NULL,
    skill_b          TEXT NOT NULL,
    cooccurrences    INT NOT NULL,
    snapshot_date    DATE NOT NULL,
    PRIMARY KEY (role_id, skill_a, skill_b, snapshot_date)
);

-- ── Telegram bot ──────────────────────────────────────────
CREATE TABLE telegram_subscriptions (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id     UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    telegram_user_id BIGINT NOT NULL,
    telegram_handle  TEXT,
    candidate_id     UUID REFERENCES candidates(id) ON DELETE SET NULL,
    subscribed_to_roles TEXT[],
    digest_frequency TEXT NOT NULL DEFAULT 'weekly',  -- 'daily' | 'weekly' | 'monthly'
    last_sent_at     TIMESTAMPTZ,
    is_active        BOOLEAN NOT NULL DEFAULT TRUE,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (workspace_id, telegram_user_id)
);

CREATE TABLE telegram_messages_log (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id     UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    direction        TEXT NOT NULL,                  -- 'in' | 'out'
    telegram_user_id BIGINT,
    chat_id          BIGINT,
    text             TEXT,
    file_id          TEXT,                            -- Telegram file_id для вложений
    handler          TEXT,                            -- 'resume_upload' | 'vacancy_digest' | 'analytics_query'
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Виртуальный ассистент (Phase 4+) ──────────────────────
CREATE TABLE assistant_conversations (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id     UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title            TEXT,
    messages         JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Лиды (накапливаются, не обрабатываются автоматически) ─
CREATE TABLE lead_items (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id     UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    inbox_item_id    UUID NOT NULL REFERENCES inbox_items(id) ON DELETE CASCADE,
    kind             TEXT NOT NULL,                  -- 'roast_request' | 'career_advice' | 'project_post' | 'team_search'
    author_telegram  TEXT,                            -- @handle
    author_user_id   BIGINT,
    snapshot_text    TEXT NOT NULL,
    captured_at      TIMESTAMPTZ NOT NULL,
    outreach_status  TEXT NOT NULL DEFAULT 'untouched', -- 'untouched' | 'queued' | 'contacted' | 'converted'
    notes            TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Все таблицы с `workspace_id` имеют индекс `(workspace_id, created_at DESC)`. Подробности — [SCHEMA.md](./SCHEMA.md).

---

## 7. Backend (FastAPI)

Полная спека — [PROMPT_BACKEND.md](./PROMPT_BACKEND.md). Здесь — что добавляется к ней.

### 7.1 Новые роутеры

| Роут | Auth | Назначение |
|---|---|---|
| `POST /api/v1/ingest/inbox` | API key | OpenClaw сюда шлёт сырые посты |
| `POST /api/v1/ingest/vacancy` | API key | Готовая `NormalizedVacancy` от OpenClaw |
| `POST /api/v1/ingest/candidate` | API key | Готовая `NormalizedCandidate` от OpenClaw |
| `GET /api/v1/masks/{position_id}` | API key или JWT | Возвращает плоский Domain Dictionary для роли |
| `POST /api/v1/shadow-registry/proposed` | API key | OpenClaw предлагает новые навыки |
| `GET /api/v1/shadow-registry` | JWT (admin) | Рекрутер просматривает кандидатов на пополнение онтологии |
| `POST /api/v1/shadow-registry/{id}/accept` | JWT (admin) | Принимает / отклоняет |
| `POST /webhook/telegram/{bot_token}` | secret token check | Telegram присылает апдейты |
| `GET /api/v1/inbox` | JWT | Рекрутер видит сырые посты |
| `POST /api/v1/inbox/{id}/import` | JWT | Подтверждает импорт в `vacancies`/`candidates` |
| `GET /api/v1/leads` | JWT | Лиды (project/team/roast/career-advice) |
| `POST /api/v1/calibration/run` | JWT (admin) | Запускает прогон калибровочного корпуса |
| `GET /api/v1/calibration/aggregates/skill-frequency` | JWT (admin) | Графики |
| `POST /api/v1/assistant/chat` | JWT | Рекрутер пишет ассистенту |

### 7.2 Сервис масок

`MaskService.build_dictionary(position_id, ontology_version)` — раскрывает `Position.requiredCategories` (динамические подкатегории) в плоский словарь:

```python
{
  "position_id": "pos_backend",
  "version": "pos_backend@1.3",
  "ontology_version": "tooltree@2.1",
  "canonical_skills": {
    "python":   ["python", "python3", "asyncio", "typing"],
    "django":   ["django", "drf"],
    "fastapi":  ["fastapi"],
    "postgres": ["postgresql", "psql", "sql"],
    "docker":   ["docker", "containers"]
  },
  "anti_dictionary": ["1c", "salesforce", "sap"],
  "preferred_grades": ["middle", "senior", "lead"],
  "domain_hints": {
    "industry_likely": ["fintech", "saas", "ecommerce"]
  }
}
```

OpenClaw подсовывает этот словарь в системный промпт DeepSeek — модель экстрактит **только в рамках канона**, не придумывает свои навыки.

### 7.3 Сервис ingest

`IngestService.create_vacancy(payload, source, api_key)`:

1. Валидирует `extraction_meta.mask_version` совпадает с текущей.
2. Дедупит по `(source, external_id)`.
3. Прогоняет `resolve_tool_id` для каждого требования.
4. Сохраняет в БД, возвращает `vacancy_id` и список `_warnings` (нерезолвленные навыки).
5. `_warnings` идут в `shadow_registry_entries` со статусом `incubating`.

### 7.4 Безопасность

- API keys для OpenClaw хранятся как `argon2`-хеши, выдаются через UI рекрутера.
- Webhook Telegram проверяет `X-Telegram-Bot-Api-Secret-Token` (secret настраивается при `setWebhook`).
- Rate limiting: API key — 60 rpm, JWT — 600 rpm.
- Все ingest-эндпоинты возвращают только `id` записи, никаких чужих данных.

---

## 8. Frontend (React SPA)

Полная спека — [PROMPT_FRONTEND.md](./PROMPT_FRONTEND.md). Здесь — что добавляется.

### 8.1 Новые страницы

| Маршрут | Что показывает |
|---|---|
| `/inbox` | Список сырых постов из Telegram, статус классификации, кнопки «импортировать»/«отметить как спам» |
| `/leads` | Лиды (проф-консультации, прожарки, проекты, тимы) с фильтром по типу и статусом outreach |
| `/calibration` | Дашборд калибровочного корпуса: распределение скилл-частот по ролям, growth новых терминов |
| `/registry` | Shadow registry: «предлагаются к добавлению», UI принять/отклонить |
| `/assistant` | Чат с виртуальным ассистентом (Phase 4) |
| `/admin/channels` | Управление списком Telegram-каналов |
| `/admin/api-keys` | Выдача API keys для OpenClaw |
| `/admin/bots` | Конфигурация Telegram-ботов (token, webhook url, повторная регистрация webhook) |

### 8.2 Расширение существующих страниц

- **VacancyCard / CandidateCard** — добавить badge `source` (hh / linkedin / habr / telegram / manual), expandable блоки `responsibilities`, `qualifications`, `benefits`, `languages`, `education`, `certifications`.
- **VacancyForm / CandidateForm** — поля для всех новых атрибутов из [SCHEMA_AUDIT.md](./SCHEMA_AUDIT.md). Сворачиваемые секции, чтобы не пугать пустыми formами.
- **Аналитика** — добавить виджет «Тренды skill registry» (что предлагается к добавлению).

### 8.3 Контракты

`packages/shared-types` собирается из OpenAPI бэкенда:

```bash
npm run gen:types  # внутри: openapi-typescript ../backend/openapi.json -o ./src/api/generated.ts
```

Хуки tanstack-query на каждый эндпоинт типизированы автоматически.

---

## 9. Виртуальный ассистент (OpenClaw)

Полная спека — [PROMPT_OPENCLAW.md](./PROMPT_OPENCLAW.md). Краткое:

**Запуск:** локально на машине рекрутера (Docker compose) или на отдельном VPS. OpenClaw — gateway, который запускает скиллы в sandbox.

**Скиллы:**

1. `watch_telegram_channels` — раз в `N` минут pull новых сообщений из подписанных каналов через telethon.
2. `classify_post` — DeepSeek Flash определяет `vacancy / resume / project / team / roast / career / other`.
3. `extract_vacancy` — fetch mask dictionary → DeepSeek Flash extract → POST в Recruit.
4. `extract_candidate` — то же для резюме.
5. `discover_channels` — раз в неделю предложить новые каналы на основе репостов и упоминаний.
6. `consolidate_shadow_registry` — раз в сутки DeepSeek Pro прогоняет накопленный shadow registry, кластеризует новые термины, помечает confidence.
7. `serve_assistant_chat` — обрабатывает запросы рекрутера (Phase 4).

**Каждый скилл получает:**

- API key Recruit (через env)
- DeepSeek API key (через env)
- Локальный SQLite для idempotency (не обработать одно сообщение дважды)

**OpenClaw → Recruit контракт:**

```http
POST /api/v1/ingest/inbox
Content-Type: application/json
X-Recruit-Api-Key: <key>

{
  "source": "telegram",
  "channel_handle": "@some_dev_jobs",
  "external_id": "msg_12345",
  "raw_text": "...",
  "received_at": "2026-05-03T12:34:56Z"
}
```

Recruit отвечает `inbox_item_id`. После классификации + экстракции:

```http
POST /api/v1/ingest/vacancy
{
  "inbox_item_id": "<uuid>",
  "normalized": { ... NormalizedVacancy ... },
  "extraction_meta": {
    "source": "telegram",
    "extracted_at": "...",
    "extraction_model": "deepseek-v4-flash",
    "mask_version": "pos_backend@1.3",
    "ontology_version": "tooltree@2.1",
    "extraction_quality": 0.92
  }
}
```

---

## 10. Telegram бот

Полная спека — [PROMPT_TELEGRAM_BOT.md](./PROMPT_TELEGRAM_BOT.md). Краткое:

**Один бот, четыре сценария:**

| Команда / событие | Что делает |
|---|---|
| `/start` | Регистрирует подписку, спрашивает: вы кандидат, рекрутер или просто наблюдатель? |
| Document (PDF/DOCX) | Принимает резюме, шлёт через OpenClaw в DeepSeek extract → создаёт `Candidate` со `source='bot_dm'` |
| `/find` | Поиск по последним вакансиям из БД |
| `/analytics` | «Где я нахожусь на рынке?» — берёт ваше последнее резюме, прогоняет через `computeCareerRecommendations` |
| `/digest` | Подписка на еженедельный digest вакансий по ролям |
| `/feedback` | Свободная форма — попадает в `lead_items` как `roast_request`/`career_advice` для будущей обработки |

**Интеграция с FastAPI:**

```python
# apps/backend/app/bots/handlers/resume.py
@router.message(F.document)
async def handle_resume(msg: Message, ingest: IngestService):
    file = await msg.bot.get_file(msg.document.file_id)
    content = await msg.bot.download_file(file.file_path)
    # Отправляем в OpenClaw на extract
    candidate_id = await ingest.from_telegram_file(content, msg.from_user)
    await msg.answer(f"Резюме принято. ID: {candidate_id}. Для подписки на вакансии — /digest")
```

---

## 11. Калибровка на 333k Habr

Полная спека — [PROMPT_CALIBRATION.md](./PROMPT_CALIBRATION.md). Краткое:

**Цели:**

1. Валидировать качество DeepSeek-экстракции на реальном русскоязычном корпусе.
2. Семечко для shadow registry: какие связки навыков существуют в рынке.
3. Бенчмарк matching: вакансия hh → топ-100 из 333k → ручная проверка релевантности.

**НЕ цель:**

- Использовать как лиды
- Отправлять кому-то outreach
- Хранить дольше необходимого

**Пайплайн:**

```
data/raw/habr_333k.xlsx       (.gitignored, удаляется после калибровки)
        ↓
scripts/calibration/anonymize.ts   (Node script)
        ↓
data/processed/habr_anon.jsonl     (.gitignored, без PII)
        ↓
POST /api/v1/calibration/import     (admin only)
        ↓
calibration.candidates              (отдельная схема в Postgres)
        ↓
scripts/calibration/run-extraction.ts  (sample 1000 → DeepSeek → сравнить)
        ↓
data/calibration/                    (коммитится: только агрегаты)
  ├── skill_frequency.json
  ├── stack_cooccurrence.json
  ├── grade_experience.json
  └── extraction_quality.json
```

**Анонимизация (на скрипте):**

| Поле в источнике | Действие |
|---|---|
| ФИО, Telegram, Skype, ICQ, Jabber, AOL, Yahoo, Google Talk, Mail.ru Agent, Я.Онлайн, Email, Phone, Bitbucket, GitHub, профиль Хабра, личный сайт | **drop** |
| Опыт работы 1–6 (текстовое описание) | прогнать через PII-санитайзер (regex + DeepSeek) — удалить имена коллег, точные имена компаний |
| Возраст | bucket по 5 лет |
| Дата регистрации, дата визита | загрубить до месяца |
| Стек, Зарплата, Опыт работы (числа), Локация (страна+город), Профессиональные навыки, Обо мне (после санитайзера) | оставить |

После анонимизации файл попадает в `calibration.candidates` (изолированная Postgres-схема, отдельный role с правами `SELECT` only для основных приложений).

---

## 12. PII и безопасность данных

| Категория | Хранение | Шифрование | Удаление |
|---|---|---|---|
| Логин-пароль рекрутера | `users.password_hash` (argon2) | в покое — disk encryption уровня инфры | по удалению аккаунта |
| Контакты кандидатов (email/phone/telegram) | `candidates.*` | то же | по запросу субъекта |
| Резюме-PDF, прикреплённое к кандидату | object storage (S3-compat) | server-side encryption | по запросу |
| Сырые сообщения Telegram (`inbox_items.raw_text`) | Postgres | то же | retention 90 дней, потом auto-purge |
| Калибровочный корпус | отдельная схема `calibration.*` | то же | удаляется по завершении калибровки |
| Логи Telegram-бота | `telegram_messages_log` | то же | retention 30 дней |
| Логи OpenClaw → Recruit API | application logs | — | retention 14 дней |

**Главные правила:**

1. Калибровочный корпус **никогда не показывается в UI рекрутера**. Он живёт в schema `calibration` с отдельным DB role, у `recruit-api` пользователя только `SELECT` на агрегаты.
2. Inbox-посты автоматически маркируются как `pii_redacted=false` до санитайзера; до санитайзера не отдаются в UI.
3. На каждом ingest-эндпоинте есть лог `audit_events.kind='ingest'` с источником и хешем payload (для расследования инцидентов).

---

## 13. Фазы поставки

### Phase 1 — MVP (3 недели)

Цель: end-to-end внутренний контур.

| Подсистема | Что входит |
|---|---|
| Backend | Auth, CRUD vacancies/candidates/positions, on-demand matching, тонкий API-key слой для будущего OpenClaw |
| Frontend | Миграция со SPA на API: dashboard, vacancy/candidate CRUD, pipeline DnD, базовая аналитика |
| DB | Все Phase 1 таблицы из SCHEMA.md + `inbox_items` (готов к Phase 2) |
| Infra | docker-compose dev, GitHub Actions CI (lint + test + build) |

### Phase 2 — Калибровка + Habr корпус (2 недели)

| Что | Зачем |
|---|---|
| `scripts/calibration/anonymize.ts` | Готовим 333k анонимизированных записей |
| Schema `calibration.*` | Отдельная зона для корпуса |
| `POST /api/v1/calibration/import` | Загрузка батчами по 10k |
| Аггрегаты `skill_frequency`, `stack_cooccurrence` | Семечко для shadow registry |
| Frontend `/calibration` дашборд | Чтобы видеть, как корпус устаканился |

После этой фазы у нас откалиброванная DeepSeek-экстракция и стабильная онтология.

### Phase 3 — OpenClaw + Telegram (3 недели)

| Что | Зачем |
|---|---|
| `apps/openclaw/` | Конфиги OpenClaw, скиллы для harvesting |
| `POST /api/v1/ingest/*` endpoints | Принимают результаты OpenClaw |
| `POST /webhook/telegram/...` + aiogram handlers | Бот для кандидатов и подписчиков |
| Frontend `/inbox`, `/leads`, `/admin/channels`, `/admin/bots` | UI управления |
| Shadow registry workflow | Полный круг: предложение → ревью → принятие |

После этой фазы система самостоятельно собирает данные и предлагает рекрутеру обновления.

### Phase 4 — Виртуальный ассистент чат + project templates (3-4 недели)

| Что | Зачем |
|---|---|
| `assistant_conversations` + `/api/v1/assistant/chat` | Рекрутер говорит с ассистентом по своей базе |
| `project_templates` + анализ накопленных `project_post` | Реверс-матчинг «по проекту → состав команды» |
| Self-improving prompts | OpenClaw анализирует свои ошибки, тюнит prompts (с human-in-the-loop) |

### Phase 5 — Боевая фаза (масштабирование)

| Что | Когда |
|---|---|
| pgvector + ML-ranking | Когда базовая кор. матча перестаёт быть достаточной |
| WebSocket / SSE | Когда поллинг с staleTime 30s начнёт нагружать |
| Materialized views для аналитики | Когда дашборды начнут лагать на 100k+ записях |
| Sentry + OpenTelemetry + Grafana | Когда продакшен начнёт падать |
| RLS | Когда workspaces > 10 |

---

## 14. Стандарты качества

### Бэкенд

- TypeScript-style строгость в Python: `mypy --strict` обязательно для `app/services/*`, `app/repos/*`.
- 80%+ покрытие тестами в `services/`, 60%+ в `api/`.
- Все эндпоинты задокументированы через FastAPI docstrings + OpenAPI.
- Миграции Alembic — атомарные, обратимые.

### Фронтенд

- TypeScript strict, ESLint clean (включая `no-explicit-any`).
- 70%+ покрытие компонентов критического пути (auth, vacancy edit, kanban DnD).
- Bundle size: initial ≤ 250 КБ gzipped.
- A11y: WCAG AA (focus management, semantic HTML, keyboard navigation).

### OpenClaw / Telegram бот

- Idempotency на каждом скилле: один и тот же `external_id` не должен породить двух записей.
- Rate limiting на стороне клиента к DeepSeek: не более 5 RPS.
- Graceful degradation: если DeepSeek недоступен 5 минут — пауза + retry, не паника.
- Логи: каждый skill run логирует (start, success, fail, retry) в JSON.

### Безопасность

- Никаких секретов в коде. `.env` для dev, vault/secrets manager для prod.
- API keys — `argon2`, не plain.
- Телефоны кандидатов — храним в открытом виде только если они в БД, в логах — маскируем.
- Все ingest-эндпоинты дедупят по `(source, external_id)`.

---

## 15. Критерии приёмки

### Phase 1 принят, когда:

- Можно создать workspace + рекрутера, залогиниться.
- CRUD вакансий и кандидатов работает через API + UI.
- Матчинг кандидат×вакансия возвращает разумные `matched/gap/extra`.
- Pipeline drag-and-drop работает.
- CI зелёный (lint + tests + build для обоих apps).

### Phase 2 принят, когда:

- 333k Habr анонимизирован, агрегаты построены, корпус не отображается в UI.
- DeepSeek экстракция на 1000 случайных резюме показывает ≥85% качества по полю `skills_resolved`.
- Shadow registry собирает топ-100 новых терминов с частотой и примерами.

### Phase 3 принят, когда:

- OpenClaw сам приносит 100+ постов в день из подписанных каналов.
- Inbox UI показывает классификацию + позволяет принять/отклонить одной кнопкой.
- Telegram-бот принимает резюме и создаёт `Candidate` за < 30 секунд.
- Telegram-бот рассылает digest вакансий по подписке.

### Phase 4 принят, когда:

- Рекрутер может в чате с ассистентом задать «найди мне backend senior с опытом fintech, удалёнка, до 400k» — получить топ-10 кандидатов.
- Project templates строятся из 100+ накопленных `project_post`.

### Phase 5 — production ready, когда:

- 99.5% uptime за 30 дней.
- p95 latency `/api/v1/*` < 300ms на нагрузке 50 RPS.
- Sentry показывает <0.1% error rate.

---

## 16. Анти-паттерны (не делать)

### Стратегические

- **«Сразу всё ML».** Phase 1 — в принципе без ML. Embedding'и — Phase 5. Сначала стабилизируйте онтологию.
- **«OpenClaw всё сделает».** OpenClaw — диспетчер, не парсер. Бизнес-логика живёт в backend. См. PROMPT_OPENCLAW § «Где OpenClaw НЕ должен быть».
- **«Сольём Habr-корпус в основную базу».** Калибровочный корпус живёт в `calibration.*` schema, отдельный DB role, никогда не пересекается с прод-кандидатами.
- **«Самообновляющаяся онтология без подтверждения».** LLM может только предлагать, человек должен подтверждать. Иначе через месяц получите Python, python, Python3, py — все разные.
- **«Один универсальный промпт».** Промпт под каждую роль (`pos_backend`, `pos_qa_auto`...). Plus prompt caching экономит до 90% на повторах.

### Тактические

- Не использовать Celery в Phase 1. `BackgroundTasks` хватит.
- Не использовать pgvector до калибровки.
- Не делать optimistic updates до Phase 2.
- Не писать миграции, удаляющие колонки на проде, без двухфазного rollout.
- Не коммитить ни сырой Habr-файл, ни анонимизированный — только агрегаты.
- Не делать Telegram outreach без явного opt-in от пользователя.
- Не давать OpenClaw direct DB access — только через API.
- Не писать тесты «для процентов покрытия» — писать тесты на критические инварианты.

---

## 17. Чеклист до старта разработки

- [ ] Зарегистрирован Telegram bot через `@BotFather`, токен сохранён в secrets manager.
- [ ] Зарегистрировано Telegram MTProto application на `my.telegram.org`, `api_id`/`api_hash` сохранены.
- [ ] Куплен/настроен DeepSeek API key с лимитом > 100k запросов/мес.
- [ ] Решено где хостится `recruit-api` и `recruit-db` (Hetzner / DigitalOcean / Yandex Cloud).
- [ ] Решено где хостится `recruit-openclaw` (локально у рекрутера или на отдельном VPS).
- [ ] Domain + TLS-сертификат для webhook'ов Telegram.
- [ ] Backup-стратегия для Postgres (pg_dump раз в сутки + WAL streaming на отдельный диск).
- [ ] План удаления калибровочного корпуса после Phase 2.

---

## 18. Что наследуется из текущего прототипа

Это **не** «начать с нуля». Берём отсюда без изменений:

- `src/components/TreePicker/` — выбор инструментов
- `src/components/KanbanBoard/` — pipeline DnD
- `src/components/Spine/` + `SpinePopover/` + `Tablet/` — UI-паттерн списков
- `src/components/RoadMap/` — матрица инструменты × грейды
- `src/components/SalaryChart/` — аналитика зарплат
- `src/utils/matchScore.ts` — алгоритм матчинга, портируется в `app/services/matching.py`
- `src/utils/aggregateCandidate.ts` — агрегация workEntries, аналогично
- `src/utils/computeRoadmap.ts` — матрица, аналогично
- `src/utils/parseSalary.ts`, `parseAddress.ts`, `parseExperience.ts`, `parseLanguage.ts`, `parseOpenToWork.ts` — парсеры, портируются один-в-один на Python
- `src/utils/versioning.ts` — переезжает в backend как `app/services/versioning.py`
- `src/data/defaultPositions.json` + `src/data/defaultTools.ts` — seed-данные

Удаляем:

- `src/db/` (Dexie) — заменяется tanstack-query
- `src/stores/*.ts` — переезд в zustand UI-only stores
- Прямые вызовы IndexedDB — заменяются на `api/` слой

---

## 19. Полезные ссылки

- DeepSeek API: https://api-docs.deepseek.com/
- OpenClaw docs: https://docs.openclaw.ai/
- aiogram 3: https://docs.aiogram.dev/
- telethon: https://docs.telethon.dev/
- FastAPI: https://fastapi.tiangolo.com/
- @tanstack/react-query: https://tanstack.com/query/

---

**Этот документ — мастер. При любом конфликте между ним и подспеками детальнее всё-таки специализированные.**
**Они нормативные, этот — навигационный.**
