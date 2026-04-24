# Промпт для разработки backend

**Назначение:** полное ТЗ для старта разработки FastAPI-бэкенда. Передаётся AI-агенту (Claude/GPT) или живому разработчику как самодостаточная спецификация.

---

## Промпт

> Ты — senior Python backend-разработчик. Реализуй бэкенд для рекрутинговой платформы "Recruit" — B2B SaaS для подбора технических специалистов с движком матчинга кандидатов и вакансий по дереву инструментов с учётом опыта в годах.
>
> **Бизнес-контекст.** Рекрутеры ведут базу вакансий и кандидатов. Каждая вакансия состоит из набора требуемых инструментов (React, PostgreSQL, Kafka...) на двух уровнях: MIN (жёсткие требования) и MAX (желательные). Каждый кандидат — из набора мест работы (work entries) с использованными инструментами и длительностью. Система автоматически вычисляет match-score между вакансией и кандидатом. Пользователи ведут кандидатов по pipeline'у (Kanban) с этапами «Скрининг → Интервью → Оффер → Принят/Отказ». Полная история взаимодействий и задачи по подбору.
>
> **Что уже есть.** Прототип на Vite+React с полной доменной моделью в IndexedDB (файл `src/entities/index.ts` описывает все типы). Твоя задача — перенести эту модель на PostgreSQL + FastAPI, сохранив и усилив функциональность.
>
> ### Технический стек
>
> - **Python 3.12**, **FastAPI**, **SQLAlchemy 2.0** (async), **Pydantic v2**
> - **PostgreSQL 16** с расширениями `pgcrypto`, `pg_trgm`, `btree_gin`, `unaccent`, `vector` (pgvector)
> - **Alembic** для миграций
> - **Redis 7** для кэша, сессий, pub/sub
> - **Celery** + Redis-broker для фоновых задач
> - **uv** для управления зависимостями (не pip/poetry)
> - **orjson** как JSON encoder
> - **argon2-cffi** для паролей
> - **structlog** для логирования
> - **pytest-asyncio** для тестов
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
> 4. **Multitenant через RLS.** Каждая сущность workspace-scoped. Session-dependency устанавливает `app.current_workspace_id` в PostgreSQL.
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
> ### Матчинг (ядро бизнес-логики)
>
> Портируем `src/utils/matchScore.ts` в `app/services/matching.py`. Алгоритм:
>
> 1. Для пары (vacancy, candidate):
>    - Собрать инструменты вакансии (min + max) с required years
>    - Собрать инструменты кандидата (из work_entries) с суммированными годами по каждому tool_id
>    - Разбить на matched / gaps / extras
>    - score_min = %требований MIN, полностью закрытых с достаточным опытом
>    - score_max = score_min + бонус за совпадения MAX
> 2. Для массового матчинга (все кандидаты на вакансию):
>    - Один SQL-запрос поднимает все work_entry_tools по кандидатам workspace'а
>    - NumPy матрица инструментов × кандидатов
>    - Векторное сравнение с требованиями вакансии
>    - Результаты пишутся в `match_scores` батчем
>
> Инвалидация: триггер PostgreSQL на INSERT/UPDATE/DELETE в `vacancy_requirements`, `work_entry_tools` → `pg_notify('match_invalidate', ...)` → listener в отдельном воркере → Celery job пересчитывает затронутые пары.
>
> **Кэш в Redis:** `match:{vacancy_id}:{candidate_id}` с TTL 1 час. Инвалидируется по событию.
>
> ### Фоновые задачи (Celery)
>
> - `recompute_match(vacancy_id, candidate_id)` — по событию
> - `recompute_match_bulk(vacancy_id)` — при массовом изменении вакансии
> - `refresh_roadmap_mv()` — ежечасно
> - `import_hh_candidates(workspace_id, token)` — по расписанию или вручную
> - `send_notification_email(user_id, notification_id)` — по событию
> - `daily_digest(user_id)` — celery-beat ежедневно
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
> ### Наблюдаемость
>
> - `structlog` JSON-логи в stdout
> - Каждый запрос — middleware с `request_id`
> - Integration с Sentry (backend DSN в env)
> - OpenTelemetry auto-instrumentation для FastAPI, SQLAlchemy, httpx, redis
> - Prometheus metrics endpoint `/metrics` (prometheus-fastapi-instrumentator)
> - Health checks: `/healthz` (liveness), `/readyz` (readiness = DB + Redis доступны)
>
> ### Порядок реализации
>
> 1. Скелет проекта, pyproject.toml, docker-compose.yml
> 2. Alembic init, модели, первая миграция
> 3. Auth (register/login/refresh/me)
> 4. Tool tree CRUD + seed из YAML
> 5. Positions, vacancies, candidates CRUD (без матчинга)
> 6. Work entries + work entry tools
> 7. Матчинг: сервис + денормализация + воркер
> 8. Pipeline + SSE
> 9. Search, filters, analytics
> 10. Response events, tasks, notifications
> 11. Audit log, RLS
> 12. Интеграции (phase 7)
>
> Каждый шаг — отдельный PR с тестами и работающим swagger.
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

- [ ] `docker compose up` поднимает весь backend + db + redis
- [ ] `alembic upgrade head` → `curl localhost:8000/healthz` → 200
- [ ] Swagger UI отображает все эндпоинты с примерами
- [ ] `pytest` проходит на чистой тестовой БД
- [ ] OpenAPI схема генерируется и импортируется в TypeScript без warnings
- [ ] Нагрузка: matching 1000 кандидатов на одну вакансию < 500 мс
- [ ] Нагрузка: 100 RPS на список вакансий < 100 мс p95
- [ ] Миграции обратимы (downgrade работает)
- [ ] `pytest-cov` > 80% на `services/`
