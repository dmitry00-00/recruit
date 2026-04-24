# Мастер-промпт (полная спецификация проекта)

**Назначение:** единый, самодостаточный документ для AI-агента или команды, берущейся за разработку с нуля или доведение прототипа до production. Содержит всё: контекст, архитектуру, план, стандарты, критерии приёмки.

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

### Backend
- **Python 3.12**
- **FastAPI** + **uvicorn**
- **SQLAlchemy 2.0 async** + **asyncpg**
- **Alembic**
- **Pydantic v2** + **pydantic-settings**
- **Celery** + **Redis-broker**
- **argon2-cffi**, **PyJWT**
- **structlog** + **orjson**
- **pytest-asyncio** + **httpx** + **factory_boy**
- **uv** (package manager)

### Database
- **PostgreSQL 16** + расширения: `pgcrypto`, `pg_trgm`, `btree_gin`, `unaccent`, `vector`
- **Redis 7** (cache, pub/sub, celery broker)
- **PgBouncer** (connection pooling)

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

## 7. Порядок разработки (TL;DR)

1. **Phase 0 (2 нед).** Скелет монорепо, docker-compose, CI. → `docs/ROADMAP.md#phase-0`
2. **Phase 1 (3 нед).** Backend core: auth, модели, базовый CRUD. → `docs/PROMPT_BACKEND.md`
3. **Phase 2 (3 нед).** Frontend миграция с Dexie на API. → `docs/PROMPT_FRONTEND.md`
4. **Phase 3 (4 нед).** Матчинг на бэке, pipeline SSE, imports.
5. **Phase 4 (3 нед).** FTS, фильтры, аналитика.
6. **Phase 5 (3 нед).** Мультитенантность, RLS, audit.
7. **Phase 6 (опц. 4 нед).** ML: embeddings, pgvector, гибридный матчинг.
8. **Phase 7 (4 нед).** Интеграции: HH, Telegram, Google Calendar.
9. **Phase 8 (2 нед).** Production-readiness: observability, security audit, docs.

**MVP (для первых клиентов):** конец Phase 3 — 12 недель.
**Commercial v1.0:** конец Phase 5 — 18 недель.

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

- ❌ **Next.js "потому что модно".** SPA подходит лучше — см. OPTIMIZATION.md.
- ❌ **GraphQL ради GraphQL.** REST + OpenAPI + tanstack-query покрывают всё.
- ❌ **Микросервисы на старте.** Монолит → модульный монолит → извлечение по необходимости.
- ❌ **MongoDB / Firebase.** Связные данные, сложные запросы — только PostgreSQL.
- ❌ **Django вместо FastAPI.** Нужен async, нужна OpenAPI-first разработка.
- ❌ **Server-side rendering.** SEO не нужен, first-paint не критичен для внутреннего инструмента.
- ❌ **ORM magic ("auto-CRUD" из моделей).** Явные слои repository/service.
- ❌ **Сериализация ORM-объектов напрямую.** Только через Pydantic схемы.
- ❌ **Кэш без инвалидации.** Правило Фила Карлтона помним.
- ❌ **Полная переделка прототипа.** Сохраняем UX, переезжаем на API.

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
