# Промпт для разработки backend

**Назначение:** полное ТЗ для старта разработки FastAPI-бэкенда. Передаётся AI-агенту (Claude/GPT) или живому разработчику как самодостаточная спецификация.

---

## ⚠️ Режим разработки: MVP-first

Ты работаешь в режиме **MVP-first**. Это НЕ production-grade система для scale — это рабочий MVP, который:
- запускается end-to-end
- обслуживает основные пользовательские сценарии
- может быть расширен позже БЕЗ переписывания

**Приоритеты (строго в этом порядке):**
1. Рабочий API
2. Простота кода и читаемость
3. Быстрая доставка фич

**Оптимизации, асинхронные воркеры, сложные кэши — добавляются ТОЛЬКО после того, как базовая версия готова и есть реальная нагрузка, подтверждающая необходимость.**

Правило выбора: если есть два пути — сложный и простой — всегда выбирай простой, если он не ломает будущую масштабируемость.

---

## Промпт

> Ты — senior Python backend-разработчик. Реализуй бэкенд для рекрутинговой платформы "Recruit" — B2B SaaS для подбора технических специалистов с движком матчинга кандидатов и вакансий по дереву инструментов с учётом опыта в годах.
>
> **Бизнес-контекст.** Рекрутеры ведут базу вакансий и кандидатов. Каждая вакансия состоит из набора требуемых инструментов (React, PostgreSQL, Kafka...) на двух уровнях: MIN (жёсткие требования) и MAX (желательные). Каждый кандидат — из набора мест работы (work entries) с использованными инструментами и длительностью. Система автоматически вычисляет match-score между вакансией и кандидатом. Пользователи ведут кандидатов по pipeline'у (Kanban) с этапами «Скрининг → Интервью → Оффер → Принят/Отказ». Полная история взаимодействий и задачи по подбору.
>
> **Что уже есть.** Прототип на Vite+React с полной доменной моделью в IndexedDB (файл `src/entities/index.ts` описывает все типы). Твоя задача — перенести эту модель на PostgreSQL + FastAPI, сохранив и усилив функциональность.
>
> ### Технический стек (MVP)
>
> - **Python 3.12**, **FastAPI**, **SQLAlchemy 2.0** (async), **Pydantic v2**
> - **PostgreSQL 16** с расширениями `pgcrypto`, `pg_trgm`
> - **Alembic** для миграций
> - **Redis 7** только для `tool_tree` кэша (опционально для match)
> - **uv** для управления зависимостями (не pip/poetry)
> - **argon2-cffi** для паролей
> - **pytest-asyncio** для тестов
> - **Фоновые задачи:** FastAPI `BackgroundTasks`, НЕ Celery
> - **JSON encoder:** дефолтный FastAPI, НЕ orjson
> - **Логирование:** дефолтный + `logging.config`, structlog — позже
>
> **Не добавлять в MVP:** Celery, pgvector, btree_gin, unaccent, msgspec, структурное логирование, OpenTelemetry.
> Эти компоненты описаны в разделе "Future improvements" каждой фичи, но НЕ реализуются сейчас.
>
> ### Структура проекта
>
> ```
> apps/backend/
> ├── pyproject.toml           # uv-проект
> ├── app/
> │   ├── main.py               # FastAPI app factory
> │   ├── core/
> │   │   ├── config.py         # pydantic-settings из env
> │   │   ├── security.py       # JWT, argon2
> │   │   ├── db.py             # async engine, session
> │   │   ├── redis.py          # Redis client
> │   │   └── deps.py           # DI: current_user, workspace_scope, db session
> │   ├── models/               # SQLAlchemy ORM классы
> │   ├── schemas/              # Pydantic (In/Out) для каждого endpoint
> │   ├── repositories/         # сырой SQL / ORM, никакой бизнес-логики
> │   ├── services/             # бизнес-логика (matching, roadmap, ...)
> │   ├── api/v1/
> │   │   ├── __init__.py       # router aggregator
> │   │   ├── auth.py, positions.py, vacancies.py, candidates.py,
> │   │   ├── tools.py, pipelines.py, tasks.py, events.py,
> │   │   ├── match.py, analytics.py
> │   ├── workers/              # Celery tasks
> │   │   ├── matching.py, import.py, notifications.py, scheduled.py
> │   ├── events/               # LISTEN/NOTIFY handlers → Celery
> │   └── utils/
> ├── alembic/
> │   ├── env.py (async)
> │   └── versions/
> ├── tests/
> │   ├── conftest.py           # fixtures: db, client, factory_boy
> │   ├── integration/          # API endpoint тесты
> │   ├── unit/                 # services, utils
> │   └── e2e/                  # полные сценарии
> └── scripts/
>     ├── seed.py               # загрузка tool_tree из YAML
>     └── generate_openapi.py   # для TS-генерации
> ```
>
> ### Архитектурные правила
>
> 1. **Разделение слоёв** (строго):
>    - `api/` — только HTTP-мэппинг, валидация через Pydantic, вызов `services/`
>    - `services/` — бизнес-логика; работают с `repositories/`
>    - `repositories/` — только запросы к БД; не знают про HTTP
>    - `models/` — SQLAlchemy ORM, без логики
> 2. **Dependency Injection** — только через `Annotated[Foo, Depends(...)]`
> 3. **Async everywhere.** Никакого sync-IO. Blocking-операции — через `run_in_executor` или Celery.
> 4. **Multitenant через WHERE workspace_id.** Каждая сущность workspace-scoped. Фильтрация делается явно в каждом репозитории: `WHERE workspace_id = :current_workspace_id`. Тесты проверяют изоляцию. **RLS НЕ используем в MVP** — добавим, когда появятся реальные workspace'ы с данными.
> 5. **Explicit > implicit.** Pydantic-схемы для каждого endpoint отдельные: `VacancyCreate`, `VacancyUpdate`, `VacancyRead`, `VacancyReadDetail`.
> 6. **Никаких глобалов.** Engine, redis, celery получаются через DI.
> 7. **Error handling.** Кастомные исключения в `app/core/exceptions.py` → перехватываются в `main.py` → единообразные JSON-ответы `{ error: { code, message, details } }`.
> 8. **Логирование.** Каждый request logger с `request_id`, `workspace_id`, `user_id`.
>
> ### Модели БД
>
> Полная схема — в `docs/SCHEMA.md`. Ключевые принципы:
>
> - Все PK — UUID через `pgcrypto.gen_random_uuid()`
> - Все таблицы с мультитенантностью имеют `workspace_id uuid NOT NULL`
> - RLS-политики для изоляции данных
> - Денормализованная таблица `match_scores` для кэша результатов матчинга
> - `search_tsv tsvector GENERATED` для FTS на `vacancies`, `candidates`
> - `pgvector` поля на `candidates.embedding`, `work_entries.embedding` (фаза 6)
>
> ### API-контракт (v1)
>
> **Auth**
> - `POST /api/v1/auth/register` → создание workspace + admin-user
> - `POST /api/v1/auth/login` → access (body) + refresh (HttpOnly cookie)
> - `POST /api/v1/auth/refresh` → новый access, rotation refresh
> - `POST /api/v1/auth/logout` → revoke refresh
> - `GET  /api/v1/auth/me` → текущий пользователь + список workspaces
> - `POST /api/v1/auth/workspace/switch` → сменить активный workspace
>
> **Tools**
> - `GET  /api/v1/tools/tree` → полное дерево (кэш в Redis, ETag)
> - `POST /api/v1/tools/subcategories` → создание (admin/recruiter)
> - `PATCH /api/v1/tools/subcategories/{id}`
> - `DELETE /api/v1/tools/subcategories/{id}`
> - `POST /api/v1/tools` → создание инструмента
> - `PATCH /api/v1/tools/{id}`, `DELETE /api/v1/tools/{id}`
>
> **Positions** — стандартный CRUD + `GET /{id}/roadmap` (возвращает из materialized view).
>
> **Vacancies** — CRUD + вложенный ресурс `requirements` (bulk put: заменяем все требования массивом).
>
> **Candidates** — CRUD + `work_entries` как вложенный. `POST /{id}/work_entries`, `PUT /{id}/work_entries/{we_id}`.
>
> **Pipelines**
> - `GET  /api/v1/vacancies/{id}/pipeline` → stages + cards
> - `PATCH /api/v1/pipeline_cards/{id}` → перемещение (stage_id, sort_order)
> - `GET  /api/v1/pipelines/{id}/events` — **SSE**, подписка на LISTEN/NOTIFY
>
> **Matching**
> - `GET  /api/v1/match/vacancy/{vacancy_id}` → список кандидатов с match_score (пагинация, сортировка, фильтры)
> - `GET  /api/v1/match/candidate/{candidate_id}` → список вакансий
> - `POST /api/v1/match/recompute` → enqueue Celery job
>
> **Search**
> - `POST /api/v1/search/candidates` → `{ filters, text, sort, page, per_page }`
> - `POST /api/v1/search/vacancies` → аналогично
>
> **Analytics**
> - `GET /api/v1/analytics/funnel` → воронка подбора по статусам
> - `GET /api/v1/analytics/salary` → распределение зарплат по грейдам/позициям
> - `GET /api/v1/analytics/time-to-hire` → средняя скорость найма
>
> **Events & tasks** — CRUD для `response_events` и `recruitment_tasks`.
>
> **Notifications** — `GET /api/v1/notifications` (с пагинацией, filter по `read_at`), `POST /{id}/read`, SSE на новые.
>
> **Audit** — `GET /api/v1/audit` (только admin).
>
> **Integrations & webhooks** (phase 7) — CRUD.
>
> Все ответы списочных эндпоинтов — формат:
> ```json
> { "items": [...], "total": 123, "page": 1, "per_page": 20 }
> ```
>
> Все мутации возвращают полный обновлённый объект (для удобства optimistic updates на фронте).
>
> ### Матчинг (MVP-версия)
>
> Портируем `src/utils/matchScore.ts` в `app/services/matching.py`. Алгоритм простой:
>
> Для каждой пары (vacancy, candidate):
> 1. Собрать инструменты вакансии (min + max) с required years — один SQL-запрос
> 2. Собрать инструменты кандидата из work_entries, суммировать годы по tool_id — один SQL-запрос
> 3. Разбить на matched / gaps / extras циклом в чистом Python
> 4. score_min = % требований MIN, полностью закрытых с достаточным опытом
> 5. score_max = score_min + бонус за совпадения MAX
>
> **Реализация:**
> - Чистый Python, без NumPy
> - Два простых SQL-запроса (или один с JOIN) на пару
> - Считается **on-demand** при запросе клиента (`GET /match/...`)
> - Если список кандидатов большой (> 50) — обёртываем в FastAPI `BackgroundTasks` и возвращаем task_id, результаты пишем в таблицу `match_scores`
> - Без батч-оптимизаций, без NumPy, без параллелизации
>
> **Что НЕ делаем в MVP:**
> - Celery / очереди задач
> - NumPy матрицы
> - Prewarming кэша
> - Триггеры PostgreSQL с LISTEN/NOTIFY
> - Автоматическая инвалидация при изменении данных
>
> **Future improvements (описать в ADR, НЕ реализовывать сейчас):**
> - Batch-матчинг с NumPy при росте базы кандидатов
> - Celery + Redis broker при длинных пересчётах
> - Триггерная инвалидация при реальном трафике
>
> ### Кэширование (MVP)
>
> Используй Redis **только для двух вещей**:
> 1. `tool_tree` — одна большая структура, читается часто, меняется редко. Ключ `tool_tree:{workspace_id}`, TTL 1 час, сбрасывается вручную при edit.
> 2. `match:{vacancy_id}:{candidate_id}` — опционально, TTL 1 час. Без умной инвалидации — просто TTL.
>
> **Никаких** multi-layer кэшей, cache stampede protection, cashews, lock'ов. Простой `redis.get` / `redis.setex`.
>
> ### Фоновые задачи (MVP)
>
> Используй FastAPI `BackgroundTasks` или `asyncio.create_task` для:
> - Отправка email (SMTP) после регистрации / оффера
> - Пересчёт матчинга при обновлении вакансии (если > 50 кандидатов)
> - Сохранение audit-события
>
> **Celery НЕ использовать** на этом этапе. Если задача дольше 30 секунд — разбивай на более мелкие или выноси в отдельный endpoint, который клиент запускает явно.
>
> ### Безопасность
>
> - JWT access: 15 мин, HS256 с секретом в env
> - Refresh: 30 дней, rotation (старый revoked при использовании), хранится hash в БД
> - CORS: разрешён только FRONTEND_URL из env
> - Rate limiting: `slowapi`, 100 req/min на аутентифицированного, 10/min на `/auth/*` по IP
> - Password policy: min 10 chars, проверка через `zxcvbn`
> - SQL injection: никаких `f"SELECT ... {x}"`, только parameterized
> - RLS как второй слой защиты после application-level проверок
> - Секреты через env, в dev — `.env.example`, в prod — vault
>
> ### Тестирование
>
> - `pytest-asyncio` для async-тестов
> - `factory_boy` / `polyfactory` для fixtures
> - Тестовая БД: отдельная schema, `pytest-postgresql` или testcontainers
> - Coverage > 80% для `services/` и `repositories/`
> - Каждый API endpoint — минимум: happy path, auth fail, validation fail, not-found
> - Integration-тесты: httpx.AsyncClient против в памяти-FastAPI
> - E2E тесты: docker-compose + `requests` в отдельном процессе
>
> ### Наблюдаемость (MVP)
>
> - Дефолтный Python `logging` + JSON-форматтер, логи в stdout
> - Каждый запрос — middleware с `request_id` (UUID)
> - Health check: `/healthz` — пинг БД и Redis
>
> **Future improvements (НЕ реализовывать сейчас):**
> - structlog с контекстом
> - Sentry integration
> - OpenTelemetry auto-instrumentation
> - Prometheus metrics endpoint
>
> ### Порядок реализации (MVP-first)
>
> **Фаза 1 — Рабочий backend (целевая скорость: 1–2 недели)**
> 1. Скелет проекта, pyproject.toml, docker-compose.yml (postgres + redis + backend)
> 2. Alembic init, модели **минимального набора**: users, workspaces, positions, vacancies, candidates, work_entries, tools
> 3. Auth: register + login + me (без refresh rotation, без email verification)
> 4. Tool tree: GET целиком из Redis (seed из JSON при старте)
> 5. CRUD vacancies, candidates, positions (без fancy фильтров, простая пагинация)
> 6. Work entries + work_entry_tools
> 7. Матчинг on-demand: `GET /match/vacancy/{id}` возвращает список кандидатов со score. Чистый Python, без NumPy.
> 8. Pipeline — простой CRUD без realtime
>
> **Критерий выхода из Фазы 1:** фронт работает end-to-end через API, все основные сценарии пользователя проходят.
>
> **Фаза 2 — Нормальный UX**
> 9. Search и фильтры (SQL WHERE, pg_trgm для fuzzy-имён)
> 10. Response events, tasks, notifications
> 11. Refresh tokens, email verification
> 12. Базовая аналитика (funnel, salary distribution) — простыми SQL
>
> **Фаза 3 — Real-time и скорость (только если реально нужно)**
> 13. SSE для pipeline
> 14. Precompute матчинга в BackgroundTasks
> 15. Cache invalidation на events
> 16. RLS (если workspace'ов > 10)
>
> **Фаза 4 — Умная система (опционально)**
> 17. pgvector, embeddings, рекомендации
> 18. Celery (если задачи стали длинными)
> 19. Materialized views для тяжёлой аналитики
> 20. Audit log, advanced security
>
> Каждый шаг — отдельный PR с тестами и работающим swagger. Никогда не делай шаги из фазы N+1, пока не закончил фазу N.
>
> ### Deliverables
>
> - `apps/backend/` с полным кодом
> - `docker-compose.yml` для локального запуска
> - `README.md` с инструкцией (`uv sync`, `alembic upgrade head`, `uv run uvicorn app.main:app`)
> - Swagger UI на `/api/docs`
> - Скрипт `scripts/generate_openapi.py` для TS-типов
> - CI workflow с lint + test + build

---

## Контекст, который нужно дать разработчику дополнительно

Помимо этого промпта, передаются:

1. `src/entities/index.ts` — точная доменная модель прототипа
2. `src/utils/matchScore.ts` — референсный алгоритм матчинга (порт на Python обязателен)
3. `src/utils/computeRoadmap.ts` — алгоритм RoadMap
4. `src/data/toolTree.json` — seed для tool-дерева
5. `src/data/defaultPositions.json` — демо-позиции
6. `domens/` — бизнес-справочник по доменам (контекст для классификации инструментов)
7. `docs/SCHEMA.md` — целевая схема БД
8. `docs/OPTIMIZATION.md` — рекомендации по перформансу

---

## Критерии приёмки

### Фаза 1 (MVP)

- [ ] `docker compose up` поднимает backend + postgres + redis
- [ ] `alembic upgrade head` → `curl localhost:8000/healthz` → 200
- [ ] Swagger UI отображает все эндпоинты
- [ ] Happy-path тесты для каждого API (`pytest`)
- [ ] OpenAPI схема генерируется и импортируется в TypeScript
- [ ] Пользовательский сценарий проходит end-to-end: регистрация → создание вакансии → создание кандидата → получение match → pipeline
- [ ] Изоляция workspace'ов: user из workspace A не видит данные workspace B (тест)

### Не-цели Фазы 1 (оставляем на потом)

- ~~Matching 1000 кандидатов < 500 мс~~ — оптимизируем, когда станет медленно
- ~~100 RPS на список вакансий < 100 мс p95~~ — меряем на реальной нагрузке
- ~~coverage > 80%~~ — достаточно покрытия happy-path + критичных сценариев
- ~~Sentry, OpenTelemetry, Prometheus~~ — добавляем в Фазе 3+
