# Мастер-промпт (полная спецификация проекта)

**Назначение:** единый, самодостаточный документ для AI-агента или команды, берущейся за разработку с нуля или доведение прототипа до production. Содержит всё: контекст, архитектуру, план, стандарты, критерии приёмки.

---

## ⚠️ ГЛАВНЫЙ ПРИНЦИП: MVP-first

**Это самое важное. Читай внимательно и применяй ВО ВСЁМ.**

### Как ты должен мыслить

```
Ты НЕ должен реализовывать всё сразу.

Твоя задача — делать минимально достаточную реализацию (MVP), которая:
- работает end-to-end
- покрывает основной пользовательский сценарий
- может быть расширена позже без переписывания

Всегда выбирай:
- простое решение > идеальное решение
- синхронное > асинхронное (если нет нагрузки)
- один источник правды > несколько уровней кэша
- встроенные инструменты фреймворка > дополнительные зависимости
```

### 🚫 Анти-паттерны — жёстко запрещены на ранних этапах

**НЕ ДЕЛАЙ, пока не попросят явно:**

- Celery / RQ / сложные очереди задач (используй `BackgroundTasks` FastAPI)
- PostgreSQL materialized views
- pgvector / embeddings / ML-матчинг
- Batch-алгоритмы с NumPy (чистый Python справится)
- msgspec / ручную сериализацию (Pydantic достаточно)
- Многоуровневое кэширование с умной инвалидацией (TTL + один слой — достаточно)
- PostgreSQL Row-Level Security (фильтрация по `workspace_id` в WHERE — достаточно)
- LISTEN/NOTIFY + SSE (refetch + invalidateQueries — достаточно)
- Triggers на инвалидацию кэша (инвалидируй в коде сервиса)
- PgBouncer, партиционирование, read replicas
- Прекомпилированные регулярки, JIT, C-расширения

**Если хочешь что-то из этого списка — опиши в "Future improvements" и НЕ реализуй.**

### Принцип итеративности

```
Каждая фича реализуется в 3 этапа:

1. Простая версия  — работает, но не оптимальна
2. Улучшение UX   — оптимистичные апдейты, loading states, кэш
3. Масштабирование — real-time, precompute, ML

Сначала — ВСЕГДА этап 1. К этапу 2 переходишь только когда этап 1 готов
и начинает ощущаться медленным на реальных данных.
```

### Правило выбора

```
Если есть выбор между:
- сложной архитектурой
- простой реализацией

ВСЕГДА выбирай простую реализацию,
если она не ломает будущую масштабируемость.
```

### Примеры решений в духе MVP-first

| Сложный подход (НЕ делаем) | MVP-подход (делаем) |
|---|---|
| Celery для пересчёта матчинга | Sync-запрос на клик "Пересчитать" или background task |
| Материализованная вьюха для RoadMap | Обычный SQL с агрегацией по запросу |
| RLS + security context | `WHERE workspace_id = current_user.workspace_id` в каждом репозитории |
| SSE + EventSource для pipeline | Refetch каждые 30 сек или manual refresh |
| NumPy матрица для bulk-матчинга | Цикл по кандидатам, один SQL на каждого |
| Redis + lock + cache stampede | In-memory `@lru_cache` или простой Redis TTL |
| Optimistic updates с rollback | Loading spinner, после mutation — `invalidateQueries` |
| `orjson` + кастомный serializer | Дефолтный FastAPI (переходим на orjson когда > 100 RPS) |

---

## 0. Как использовать этот документ

### Для AI-агента (Claude/GPT/Copilot)

1. Вводишь весь файл как системный контекст
2. Добавляешь файлы-артефакты из репозитория:
   - `src/entities/index.ts` (доменная модель)
   - `src/utils/matchScore.ts`, `computeRoadmap.ts` (референсные алгоритмы)
   - `src/data/toolTree.json` (seed для справочников)
   - `domens/` (бизнес-справочник по доменам)
3. Ставишь задачу: "Реализуй Phase X полностью согласно мастер-промпту"
4. После каждой фазы — проверяешь по чек-листу приёмки

### Для команды

1. Tech-lead проходит весь документ с командой на kick-off
2. ROADMAP разбивается на эпики в Jira/Linear
3. Каждая фаза получает отдельную ветку и PR-серию
4. Код-ревью сверяется с разделом "Стандарты качества"

---

## 1. Бизнес-контекст

**Recruit** — B2B SaaS-платформа для внутренних рекрутинговых команд и кадровых агентств. Специализация — подбор технических специалистов.

**Ключевые сценарии:**

1. **Рекрутер ведёт пайплайн.** Создаёт вакансию с требуемыми инструментами (min — обязательные, max — желательные), ведёт список кандидатов, двигает их по этапам (скрининг → интервью → оффер → принят/отказ).

2. **Система матчит автоматически.** При обновлении вакансии или кандидата пересчитывается match-score. Рекрутер видит топ-N релевантных кандидатов на вакансию.

3. **Анализ портфеля.** RoadMap показывает какие инструменты нужны для каждого грейда на позиции. Salary chart — распределение зарплат. Dashboard — воронка найма.

4. **Кандидат в системе.** Может иметь собственный аккаунт (role=candidate), видеть релевантные вакансии, редактировать профиль.

5. **Командная работа.** Несколько рекрутеров в одном workspace видят общие данные, комментируют кандидатов, назначают задачи друг другу.

6. **Интеграции.** Импорт из HH.ru, LinkedIn. Telegram-бот. Календарь. Email.

**Главная ценность:** точный матчинг по навыкам (не по ключевым словам резюме), видимость реальных требований рынка (через RoadMap).

---

## 2. Технический стек

### Frontend
- **Vite 6** (SPA режим, без Next.js)
- **React 19** + **TypeScript 5.9**
- **@tanstack/react-query v5** — серверное состояние
- **zustand v5** — клиентское состояние (UI, auth, фильтры)
- **react-router-dom v7**
- **react-hook-form** + **zod**
- **@dnd-kit** (Kanban)
- **@tanstack/react-virtual** (виртуализация)
- **lucide-react** (иконки, tree-shaken)
- **sonner** (toasts)
- **ky** (HTTP клиент)

### Backend (MVP)
- **Python 3.12**
- **FastAPI** + **uvicorn** (`BackgroundTasks` для фоновых задач)
- **SQLAlchemy 2.0 async** + **asyncpg**
- **Alembic**
- **Pydantic v2** + **pydantic-settings**
- **argon2-cffi**, **PyJWT**
- **structlog** (дефолтный JSON-logger FastAPI)
- **pytest-asyncio** + **httpx** + **factory_boy**
- **uv** (package manager)

**Добавляется позже (по мере роста нагрузки):**
- Celery + Redis-broker — когда фоновые задачи становятся длиннее 30 сек
- orjson — когда JSON-сериализация становится узким местом
- PgBouncer — когда > 100 одновременных соединений
- pgvector — для ML-матчинга (phase 4)

### Database (MVP)
- **PostgreSQL 16** + расширения: `pgcrypto`, `pg_trgm` (для fuzzy-поиска имён)
- **Redis 7** — только для tool_tree кэша и опционально match-результатов

**Добавляется позже:**
- `btree_gin`, `unaccent`, `vector` — по мере необходимости конкретных фич
- Row-Level Security — когда появится >1 workspace с реальными данными
- Materialized views — когда аналитические запросы станут > 1 сек
- Партиционирование `audit_events` — через год эксплуатации

### Infra
- **Docker** + **Docker Compose** (dev)
- **Kubernetes** или **docker-compose + systemd** (prod, зависит от масштаба)
- **GitHub Actions** (CI/CD)
- **nginx** (reverse proxy, static serving)
- **Sentry** (error tracking)
- **Prometheus** + **Grafana** + **Loki** (observability)

### Выбор обоснован
- SPA вместо Next.js — внутренний инструмент, SEO не нужен, сложный клиентский стейт. См. `docs/OPTIMIZATION.md`.
- FastAPI вместо Django/Flask — async из коробки, OpenAPI auto-gen, производительность.
- PostgreSQL вместо NoSQL — связные данные, JOIN'ы, аналитические запросы, pgvector на перспективу.

---

## 3. Структура репозитория

```
recruit/                            # монорепо
├── apps/
│   ├── frontend/                   # Vite SPA
│   │   ├── src/
│   │   ├── package.json
│   │   └── vite.config.ts
│   └── backend/                    # FastAPI
│       ├── app/
│       ├── alembic/
│       ├── tests/
│       └── pyproject.toml
├── packages/
│   └── shared-types/               # генерируемые TS-типы из OpenAPI
│       └── api.ts
├── infra/
│   ├── docker/
│   │   ├── Dockerfile.frontend
│   │   ├── Dockerfile.backend
│   │   └── docker-compose.yml
│   ├── postgres/
│   │   └── init.sql
│   ├── nginx/
│   │   └── nginx.conf
│   └── k8s/                        # helm charts (prod)
├── docs/                           # вся документация
│   ├── ROADMAP.md
│   ├── OPTIMIZATION.md
│   ├── SCHEMA.md
│   ├── PROMPT_BACKEND.md
│   ├── PROMPT_FRONTEND.md
│   └── PROMPT_MASTER.md (этот файл)
├── domens/                         # бизнес-справочник (не трогаем)
├── scripts/                        # утилиты CI/CD
│   ├── generate-types.sh
│   └── seed-dev.sh
├── .github/workflows/
├── package.json                    # pnpm workspace
├── pnpm-workspace.yaml
└── README.md
```

---

## 4. Подробные спецификации

| Документ | Содержание |
|---|---|
| `docs/ROADMAP.md` | 8 фаз разработки с критериями готовности |
| `docs/SCHEMA.md` | Полная схема PostgreSQL: таблицы, индексы, RLS, триггеры |
| `docs/OPTIMIZATION.md` | Рекомендации по perf: frontend, backend, DB |
| `docs/PROMPT_BACKEND.md` | Детальный промпт для разработки FastAPI |
| `docs/PROMPT_FRONTEND.md` | Детальный промпт для миграции фронтенда |

Этот мастер-промпт ссылается на них — **не дублирует**.

---

## 5. Стандарты качества

### Коммиты
- Conventional Commits: `feat:`, `fix:`, `refactor:`, `chore:`, `docs:`, `test:`
- Scope опционально: `feat(pipeline): add SSE`
- Тело — почему, не что (код покажет что)
- Максимум 72 символа в заголовке

### Ветки
- `main` — всегда deployable
- `develop` — интеграционная, merge в main раз в спринт
- `feature/<jira-id>-<slug>` — фичи
- `fix/<jira-id>-<slug>` — баги
- `hotfix/<slug>` — срочные фиксы прод-багов в обход develop

### PR
- Шаблон: Summary → Changes → Test plan → Screenshots (если UI)
- Обязательное ревью 1 sr+ разработчиком
- CI должен быть зелёным
- Squash merge (кроме release-веток)
- После merge — удалить ветку

### Код
- **TypeScript strict** на фронте (`strict: true`, `noUncheckedIndexedAccess: true`)
- **mypy strict** на бэке (`disallow_untyped_defs`, `warn_return_any`)
- **Ruff** (Python) + **ESLint + Prettier** (TS) в CI
- **Пути импортов** через алиасы (`@/`), без `../../../`
- **Максимальная длина функции** 50 строк, класса — 200 строк (soft-limit, не hard)
- **Cyclomatic complexity** < 10

### Тесты
- Unit coverage > 70%
- Integration tests для каждого API endpoint
- E2E тесты для критических сценариев (регистрация, матчинг, pipeline)
- Flaky-тесты — 0 (quarantine и фикс в течение дня)

### Документация
- ADR (Architecture Decision Records) для крупных решений в `docs/adr/`
- API docs — автогенерация из OpenAPI
- User guide — в отдельном репо или Notion
- Runbook для инцидентов — в `docs/runbook/`

### Секьюрити
- Никаких секретов в коде/коммитах (git-secrets в pre-commit)
- Dependency audit в CI (`pnpm audit`, `uv pip-audit`)
- Auto-update через Dependabot
- Security review перед каждым мажором

---

## 6. DevOps / деплой

### Среды

| Среда | Назначение | Данные |
|---|---|---|
| `dev` | Локальная разработка | Seed + синтетика |
| `staging` | Интеграционное тестирование, демо | Анонимизированный дамп prod |
| `prod` | Продакшн | Реальные данные |

### Deployment strategy

- **Blue-green** для backend (zero-downtime)
- **Canary** для frontend (5% → 50% → 100%)
- **Rollback** в 1 клик через CI
- **Migrations** применяются **до** деплоя новой версии (backwards-compatible только)

### Observability stack

- **Logs:** structlog JSON → stdout → Loki → Grafana
- **Metrics:** Prometheus → Grafana; ключевые: RPS, latency p50/p95/p99, error rate, DB connections, Redis hit rate
- **Traces:** OpenTelemetry → Tempo → Grafana
- **Errors:** Sentry (sourcemaps для фронта)
- **Uptime:** UptimeRobot / BetterStack на публичные endpoints

### SLO

- Uptime: **99.5%** (≈ 3.6 часа простоя в месяц)
- Latency p95: **< 300 мс** на API
- Latency p95: **< 2 сек** на первую загрузку SPA
- Error rate: **< 0.5%**

### Backups

- Ежедневный `pg_dump` в S3, 30 дней хранения
- WAL archiving в S3 для PITR
- Еженедельный restore-тест в отдельной среде

### Disaster recovery

- RTO (recovery time objective): 4 часа
- RPO (recovery point objective): 1 час
- Runbook для каждого типа инцидента (DB corrupted, Redis down, DDoS, ...)

---

## 7. Порядок разработки (TL;DR, MVP-first)

1. **Фаза 1 (1–2 нед).** Рабочий MVP end-to-end: монорепо, auth, CRUD, простой матчинг, pipeline без realtime, миграция фронта с Dexie. → `docs/ROADMAP.md#phase-1`
2. **Фаза 2 (2–3 нед).** Нормальный UX: optimistic updates для Kanban, skeleton screens, поиск/фильтры, прочие доменные фичи. → `docs/ROADMAP.md#phase-2`
3. **Фаза 3 (3–4 нед).** Real-time и масштабирование: SSE, precompute match, RLS, базовая observability.
4. **Фаза 4 (4+ нед, опционально).** Умная система: ML-матчинг с pgvector, Celery, MV, интеграции, security audit.

**MVP в продакшене:** конец фазы 1 — **2 недели.**
**Commercial-ready:** конец фазы 2 — 5 недель.
**Enterprise-ready:** конец фазы 3 — 9 недель.

---

## 8. Критерии успеха продукта

### Technical
- [ ] Все 8 фаз реализованы
- [ ] SLO выполняется 3 месяца подряд
- [ ] Test coverage > 75% на критичном коде
- [ ] Нет critical/high уязвимостей (Snyk/Sentry)

### Business
- [ ] 10 команд-рекрутеров в боевой эксплуатации
- [ ] NPS > 40 по опросам пользователей
- [ ] Время-до-найма снижается на 20% у активных пользователей
- [ ] Ретенция week-4 > 60%

### Operational
- [ ] On-call rotation налажена (2+ инженера)
- [ ] Инциденты закрываются < 4 часов (p95)
- [ ] MTTR < 1 час

---

## 9. Чеклист перед началом разработки

Перед кодом убедиться, что готово:

- [ ] Команда согласна со стеком
- [ ] Репозиторий создан, доступы розданы
- [ ] CI/CD настроен на пустом проекте (тест "hello world" деплоится)
- [ ] Staging-среда развёрнута
- [ ] Sentry, Grafana, PostgreSQL managed/self-hosted — провайдеры выбраны
- [ ] Домены, SSL, DNS — готовы
- [ ] Политика безопасности подписана
- [ ] Бюджет на внешние сервисы (SES, Sentry, domain, hosting) выделен
- [ ] Tech-lead читал все 6 документов в `docs/`
- [ ] Первый эпик Phase 0 разбит на задачи

---

## 10. Контекст прототипа (что не переписывать)

Прототип уже содержит сложные и выверенные компоненты. **Их код портируется как есть**, меняется только слой данных:

### Компоненты UI (не трогаем визуально)
- `TreePicker` — основной компонент выбора инструментов, 7 режимов, domain-grid, группы
- `KanbanBoard` — drag-and-drop pipeline
- `Spine`, `SpinePopover` — унифицированный отображатель вакансии/кандидата
- `Tablet` — полноэкранное view с tabs
- `RoadMap` — матрица grade × tool с цветовой индикацией
- `SalaryChart` — recharts (заменить на visx при оптимизации)
- `CompareSheet` — сравнение вакансии и кандидата
- `MatchBadge` — компактный индикатор матча

### Алгоритмы (портируем на Python на бэкенд)
- `matchScore.ts` → `app/services/matching.py`
- `aggregateCandidate.ts` → `app/services/candidate_aggregation.py`
- `computeRoadmap.ts` → `app/services/roadmap.py` + materialized view
- `computeCareerRecommendations.ts` → `app/services/career.py`
- `computeVacancyOptimization.ts` → `app/services/vacancy_optimization.py`
- `salaryStats.ts` → SQL агрегаты в views

### Данные (seed в бэкенде)
- `toolTree.json` → `scripts/seed.py` загружает в PostgreSQL
- `defaultPositions.json` → seed только для dev/demo workspace
- `seedVacancies.json`, `seedCandidates.json` → только для dev-среды

### Что остаётся **только** на фронте
- Роутинг (`App.tsx`)
- `ProtectedRoute`, `ErrorBoundary`
- UI-сторы (`uiStore`, `filterStore`)
- Вся локализация и темизация
- Vite-конфиг, Tailwind-подобные CSS-переменные

---

## 11. Anti-patterns (чего не делать)

### Стратегические
- ❌ **Next.js "потому что модно".** SPA подходит лучше — см. OPTIMIZATION.md.
- ❌ **GraphQL ради GraphQL.** REST + OpenAPI + tanstack-query покрывают всё.
- ❌ **Микросервисы на старте.** Монолит → модульный монолит → извлечение по необходимости.
- ❌ **MongoDB / Firebase.** Связные данные, сложные запросы — только PostgreSQL.
- ❌ **Django вместо FastAPI.** Нужен async, нужна OpenAPI-first разработка.
- ❌ **Server-side rendering.** SEO не нужен, first-paint не критичен для внутреннего инструмента.
- ❌ **Полная переделка прототипа.** Сохраняем UX, переезжаем на API.

### Тактические (MVP-first)
- ❌ **Celery на Phase 1.** BackgroundTasks FastAPI достаточно до масштаба > 100 RPS.
- ❌ **RLS на старте.** `WHERE workspace_id = ?` в репозиториях — надёжнее для MVP.
- ❌ **Materialized views для RoadMap.** SQL-агрегация on-demand быстрее на малых данных.
- ❌ **NumPy batch-матчинг.** Чистый Python до десятков тысяч кандидатов — ok.
- ❌ **SSE + LISTEN/NOTIFY сразу.** Polling через `refetchInterval` в react-query — достаточно.
- ❌ **3-уровневый кэш.** Один слой Redis с TTL — достаточно.
- ❌ **Optimistic updates везде.** Начни с `invalidateQueries` на mutation.
- ❌ **pgvector на MVP.** Table FTS + фильтры по инструментам закрывают 90% сценариев.
- ❌ **ORM magic ("auto-CRUD" из моделей).** Явные слои repository/service.
- ❌ **Сериализация ORM-объектов напрямую.** Только через Pydantic схемы.
- ❌ **Кэш без инвалидации.** Правило Фила Карлтона помним. TTL = инвалидация MVP-уровня.

---

## 12. Ресурсы

- Прототип: `github.com/dmitry00-00/recruit` (ветка `main`)
- Мастер-ветка разработки: `develop`
- Issue tracker: Jira / Linear / GitHub Projects
- Документация: `/docs/`
- Коммуникация: Slack #recruit-dev
- On-call: PagerDuty

---

**Этот документ — точка истины. Если что-то в коде противоречит ему — меняем код или документ, но не оставляем расхождение.**
