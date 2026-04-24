# Дорожная карта разработки

**Базовый стек:** Vite + React (SPA) · FastAPI (Python 3.12) · PostgreSQL 16 · Redis 7

**Горизонт:** ~6 месяцев от прототипа до production-ready v1.0 с 50+ активными пользователями.

---

## Принципы

1. **Прототип → продукт, а не переписывание.** Сохраняем всю доменную модель (`src/entities/index.ts`), утилиты матчинга, TreePicker, zustand-сторы для UI-состояния. Заменяем только слой данных (Dexie → HTTP API).
2. **Вертикальные срезы.** Каждая фаза даёт работающую end-to-end функциональность, а не отдельный горизонтальный слой.
3. **Параллелизация fullstack.** Pydantic-схемы → генерация TypeScript-типов через `openapi-typescript`. Единый источник истины — бэкенд.
4. **Backwards compatibility.** До phase 2 фронт умеет работать И с Dexie, И с API (через флаг) — миграция постепенная.

---

## Phase 0 · Инфраструктура (2 недели)

### Цель
Рабочее dev-окружение: `docker compose up` запускает весь стек.

### Задачи

**Реструктуризация репозитория → монорепо**
```
recruit/
├── apps/
│   ├── frontend/        ← текущий src/
│   └── backend/         ← новый FastAPI
├── packages/
│   └── shared-types/    ← генерируемые из OpenAPI TS-типы
├── infra/
│   ├── docker/
│   │   ├── Dockerfile.frontend
│   │   ├── Dockerfile.backend
│   │   └── docker-compose.yml
│   ├── postgres/
│   │   └── init.sql
│   └── nginx/
│       └── nginx.conf
├── docs/
├── domens/              ← оставляем как есть, это бизнес-реестр
└── .github/workflows/
    ├── ci.yml
    └── deploy.yml
```

**Docker Compose для dev**
- `postgres:16-alpine` с volume
- `redis:7-alpine`
- `backend` (hot reload через uvicorn --reload)
- `frontend` (vite dev server)
- `pgadmin` (опционально, для отладки)
- `mailhog` для локального email

**CI/CD**
- GitHub Actions: lint → typecheck → test → build
- Pre-commit hooks: `ruff` (backend), `eslint` (frontend), `prettier`
- Conventional Commits + `commitlint`

**Инструментарий**
- `uv` вместо `pip` для бэкенда (в 10–100× быстрее)
- `pnpm` вместо `npm` для фронта (монорепо + workspace)
- `direnv` для env-файлов

### Критерии готовности
- [ ] `docker compose up` поднимает всё за < 30 сек
- [ ] CI зелёный на пустом PR
- [ ] `uv run pytest` и `pnpm test` работают

---

## Phase 1 · Backend core (3 недели)

### Цель
Backend умеет CRUD основных сущностей + авторизация.

### Задачи

**Схема БД (Alembic + SQLAlchemy 2.0 async)**

Переносим `src/entities/index.ts` → SQLAlchemy модели. Ключевые таблицы:
- `users`, `roles`, `refresh_tokens`
- `tool_categories`, `tool_subcategories`, `tools` (иерархия)
- `positions`, `position_required_categories`
- `vacancies`, `vacancy_requirements` (min/max уровни в одной таблице с enum)
- `candidates`, `work_entries`, `work_entry_tools`
- `pipelines`, `pipeline_stages`, `pipeline_cards`
- `response_events`, `recruitment_tasks`

Подробнее — в `docs/SCHEMA.md`.

**Структура FastAPI**
```
backend/
├── app/
│   ├── main.py
│   ├── core/
│   │   ├── config.py        ← pydantic-settings
│   │   ├── security.py       ← JWT, bcrypt
│   │   ├── db.py             ← async engine, session
│   │   └── deps.py           ← DI (get_current_user и т.п.)
│   ├── models/              ← SQLAlchemy
│   ├── schemas/             ← Pydantic (request/response)
│   ├── repositories/        ← data access layer
│   ├── services/            ← бизнес-логика
│   ├── api/
│   │   └── v1/
│   │       ├── auth.py
│   │       ├── positions.py
│   │       ├── vacancies.py
│   │       ├── candidates.py
│   │       ├── tools.py
│   │       ├── pipelines.py
│   │       └── match.py
│   └── workers/             ← Celery задачи
├── alembic/
├── tests/
└── pyproject.toml
```

**Аутентификация**
- JWT access (15 мин) + refresh (30 дней, rotation)
- Хранение refresh в HttpOnly cookie
- Argon2 для паролей (быстрее и безопаснее bcrypt)
- Роли: `admin`, `recruiter`, `hiring_manager`, `viewer`, `candidate`
- RBAC через `Depends(require_role("recruiter"))`

**Генерация TS-типов**
Скрипт `generate-types.sh`:
```bash
curl http://localhost:8000/api/openapi.json \
  | pnpm openapi-typescript - -o packages/shared-types/api.ts
```
Запускается в CI и pre-commit.

### Критерии готовности
- [ ] Все эндпоинты CRUD покрыты интеграционными тестами (pytest-asyncio)
- [ ] Swagger UI доступен на `/api/docs`
- [ ] Миграции накатываются с нуля без ошибок
- [ ] TS-типы автоматически генерируются

---

## Phase 2 · Миграция фронтенда на API (3 недели)

### Цель
Фронт полностью работает через HTTP API. Dexie удалён.

### Задачи

**Слой данных: tanstack-query**
- Устанавливаем `@tanstack/react-query` v5
- Каждый zustand-стор, который держал entity-данные, заменяется на query-ключи:
  - `useVacancyStore.vacancies` → `useQuery(['vacancies'], api.vacancies.list)`
  - `useCandidateStore.add()` → `useMutation(api.candidates.create, { onSuccess: invalidate(['candidates']) })`
- **zustand остаётся** для: auth, UI-state (тема, активные модалки, scroll position), фильтров, toolTreeStore

**Что убрать / заменить**
- `src/db/` → удалить целиком
- `src/services/` → HTTP клиент (`apiClient.ts` на fetch + interceptors)
- `seedIfEmpty` → на бэкенде через `alembic seed` или Docker `init.sql`

**Оптимистичные обновления**
- Create vacancy → сразу добавить в список с `_optimistic: true`, откатить при ошибке
- Drag-and-drop в Kanban → оптимистично переместить, rollback + toast при 4xx

**Error handling**
- Global Error Boundary для React rendering errors
- Query error handling через `onError` + toast
- Retry logic только для 5xx / network (не для 4xx)

**Loading UX**
- Skeleton screens (не spinner'ы) для карточек и списков
- Suspense boundaries по роутам

### Критерии готовности
- [ ] IndexedDB удалён из bundle
- [ ] Все страницы работают с пустой БД корректно
- [ ] E2E тест (Playwright): регистрация → создание должности → вакансия → кандидат → матч

---

## Phase 3 · Доменные фичи и матчинг (4 недели)

### Цель
Перенос и усиление бизнес-логики на бэкенд.

### Задачи

**Движок матчинга (Python)**
- Портируем `src/utils/matchScore.ts` → `app/services/matching.py`
- Используем NumPy для векторных операций (кандидат × вакансия)
- Кэш результатов в Redis: `match:{vacancy_id}:{candidate_id}` с TTL 1 час
- Инвалидация при изменении vacancy или work_entry кандидата
- Bulk matching: «все кандидаты для этой вакансии» — один SQL-запрос + numpy

**RoadMap вычисления**
- Бэкграунд-задача через Celery: пересчёт раз в сутки для каждой позиции
- Материализованное представление `position_roadmap_mv`
- `REFRESH MATERIALIZED VIEW CONCURRENTLY` по расписанию

**Pipeline / Kanban**
- PostgreSQL `LISTEN/NOTIFY` для realtime
- SSE endpoint `/api/v1/pipelines/{id}/events`
- На фронте — `EventSource` с reconnect

**Response Timeline + Tasks**
- Перенос из prototype
- Добавляем дедлайны, напоминания (Celery-beat)

**Import/Export**
- CSV импорт кандидатов из HH.ru, LinkedIn (ручной экспорт)
- JSON экспорт для бэкапов
- Миграция seedVacancies/seedCandidates в seed-скрипт бэкенда

### Критерии готовности
- [ ] Pipeline обновляется в реальном времени между двумя вкладками
- [ ] Матчинг 1000 кандидатов × 1 вакансия < 500 мс
- [ ] RoadMap не блокирует UI

---

## Phase 4 · Поиск и фильтрация (3 недели)

### Цель
Быстрый продвинутый поиск по вакансиям/кандидатам.

### Задачи

**Full-text search**
- `tsvector` колонки на `candidates.search_vector`, `vacancies.search_vector`
- GIN индексы
- `pg_trgm` для fuzzy (поиск по имени)
- Веса: имя > должность > навыки > заметки

**Структурированные фильтры**
- Query-builder: `{ tools: ['t_react', 't_ts'], minYears: 3, grade: 'senior' }`
- На бэке — SQL с `ALL(ARRAY[...])` для инструментов
- Sorting по match_score, salary, дате

**Faceted search**
- Счётчики по граням: «+23 по React», «+12 senior», «+8 в Москве»
- Вычисляются одним CTE-запросом

**Сохранённые фильтры**
- Таблица `saved_filters`: имя + JSON-условия + user_id
- UI: закрепить фильтр в навигации

### Критерии готовности
- [ ] Поиск по 10k кандидатов < 200 мс
- [ ] Фасетные счётчики обновляются без задержки

---

## Phase 5 · Многопользовательский режим (3 недели)

### Цель
Команда рекрутеров работает в одном пространстве.

### Задачи

**Workspaces**
- Таблица `workspaces` (компания/агентство)
- Все сущности получают `workspace_id`
- Row-level security в PostgreSQL: `CREATE POLICY ... USING (workspace_id = current_workspace())`

**Приглашения**
- Invite-ссылки с токеном
- Email через SMTP (Mailhog → продакшн MAILGUN/SES)

**Audit log**
- Таблица `audit_events`: actor, action, entity, before/after JSON
- Триггеры в PostgreSQL или middleware в FastAPI

**Уведомления**
- In-app (таблица `notifications` + SSE)
- Email digest (Celery-beat daily)
- Позже: Telegram-бот (Phase 7)

**Комментарии и @упоминания**
- Таблица `comments` с polymorphic (`entity_type`, `entity_id`)
- Упоминания парсятся регулярным выражением, триггерят notification

### Критерии готовности
- [ ] Два пользователя одного workspace видят одних кандидатов
- [ ] Пользователь из другого workspace не может прочитать чужие данные (e2e тест на RLS)
- [ ] Audit log покрывает 100% мутаций

---

## Phase 6 · ML-матчинг (4 недели) · *опционально*

### Цель
Заменить ручное правило-основанное совпадение на векторный поиск.

### Задачи

**Embeddings для описаний**
- `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`
- Эмбеддим `vacancy.description` и `work_entry.responsibilities`
- Храним в `pgvector` (расширение PostgreSQL)

**Гибридное скоринг**
- `score = 0.5 * tools_match + 0.3 * embedding_cosine + 0.2 * salary_fit`
- Веса настраиваются в admin UI

**Recommender**
- «Похожие кандидаты» — ANN search по эмбеддингам
- «Рекомендованные вакансии кандидату» — аналогично

**Career path**
- Анализ карьерных траекторий → типичные переходы
- «Чтобы стать senior React — добавь TypeScript, NextJS, Jest»
- Уже есть в прототипе (`computeCareerRecommendations.ts`), переносим и усиливаем

### Критерии готовности
- [ ] Матчинг по эмбеддингам < 100 мс на 10k кандидатов
- [ ] A/B-тест: новый алгоритм vs старый на исторических данных

---

## Phase 7 · Интеграции (4 недели)

### Задачи

**Источники кандидатов**
- HH.ru API (требует регистрации партнёра) — синхронизация резюме
- LinkedIn (парсинг публичных профилей — с осторожностью по ToS)
- Telegram-бот: `/start` → кандидат создаёт мини-профиль через бота

**Календарь**
- Google Calendar / Outlook интеграция для scheduled events
- OAuth2 для доступа к календарю рекрутера

**Email**
- IMAP sync для входящих откликов
- Транзакционный SMTP (SES/Mailgun) для исходящих

**Webhooks**
- Исходящие: `vacancy.created`, `candidate.hired` — для внешних CRM
- Входящие: приём данных из форм на сайтах компаний

**Telegram-бот для рекрутеров**
- Уведомления о новых откликах
- Быстрое перемещение кандидата по пайплайну из чата
- Создание задач голосовым сообщением (через Whisper)

### Критерии готовности
- [ ] HH.ru-кандидат появляется в системе через 1 мин после отклика
- [ ] Telegram-бот работает в group chat команды

---

## Phase 8 · Production-ready (2 недели)

### Задачи

**Observability**
- Sentry для ошибок (backend + frontend)
- OpenTelemetry → Grafana Tempo для трейсов
- Prometheus + Grafana для метрик
- Логирование: `structlog` → Loki

**Performance**
- Load testing через k6: 100 RPS, 1000 одновременных пользователей
- Query performance: все запросы < 100 мс p95
- Profiling узких мест (py-spy, React DevTools Profiler)

**Security audit**
- OWASP ZAP scan
- Dependency audit: `pnpm audit`, `uv pip audit`
- Penetration testing (внешний подрядчик)
- Rate limiting: `slowapi` на критичных эндпоинтах
- CSP headers, HSTS, X-Frame-Options

**Backups**
- `pg_dump` ежедневно, 30 дней хранения
- WAL-shipping в S3 для point-in-time recovery
- Тестовый restore раз в неделю

**Documentation**
- User guide (Notion/Docusaurus)
- API reference (автогенерация из OpenAPI)
- ADR (Architecture Decision Records) для крупных решений
- Runbook для инцидентов

**Deployment**
- Kubernetes (managed: Yandex Cloud / Scaleway / Hetzner) или docker-compose + systemd
- Blue-green deployment
- Feature flags через LaunchDarkly / Unleash
- Staging среда, идентичная prod

### Критерии готовности
- [ ] SLO: 99.5% uptime, p95 < 300 мс
- [ ] Disaster recovery тестирование пройдено
- [ ] Security audit отчёт без critical/high issues

---

## Timeline summary

| Фаза | Длительность | Накоплено |
|------|-------------|-----------|
| 0. Инфраструктура | 2 нед | 2 нед |
| 1. Backend core | 3 нед | 5 нед |
| 2. Миграция фронта | 3 нед | 8 нед |
| 3. Доменные фичи | 4 нед | 12 нед |
| 4. Поиск | 3 нед | 15 нед |
| 5. Многопользовательский | 3 нед | 18 нед |
| 6. ML-матчинг *(опц.)* | 4 нед | 22 нед |
| 7. Интеграции | 4 нед | 26 нед |
| 8. Production | 2 нед | 28 нед |

**MVP для первых пользователей** — конец phase 3 (12 недель).
**Commercial v1.0** — конец phase 5 (18 недель).
**Full platform** — 28 недель.

---

## Команда (рекомендация)

Минимально жизнеспособная:
- 1 tech-lead / fullstack senior (архитектура, ревью)
- 1 backend (Python)
- 1 frontend (React/TS)
- 0.5 DevOps (инфра, CI/CD)
- 0.3 QA (ручное + e2e автоматизация)
- 0.2 продакт-оунер

На phase 6 (ML) — добавить ML-инженера на 1 месяц.
На phase 7 — при необходимости +1 backend под интеграции.
