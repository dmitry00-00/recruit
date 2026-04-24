# Дорожная карта разработки

**Базовый стек:** Vite + React (SPA) · FastAPI (Python 3.12) · PostgreSQL 16 · Redis 7

**Подход:** MVP-first. Делаем работающий продукт простейшим способом, потом улучшаем по мере реальной нагрузки и обратной связи от пользователей.

---

## ⚠️ Принцип итеративности

Каждая фича реализуется **в 3 этапа**:

1. **Простая версия** — работает, но не оптимальна
2. **Улучшение UX** — оптимистичные апдейты, loading states, кэш
3. **Масштабирование** — real-time, precompute, ML

**К этапу 2 переходим только когда этап 1 готов и ощущается медленным.**
**К этапу 3 — только по реальной потребности.**

---

## 🚀 Фаза 1 · Рабочий продукт (1–2 недели)

**Цель:** end-to-end MVP, который можно показать первым пользователям.

### Что входит

**Инфраструктура (2–3 дня)**
- Монорепо: `apps/frontend`, `apps/backend`
- `docker-compose.yml`: postgres + redis + backend + frontend
- Базовый CI (lint + typecheck + test)

**Backend**
- FastAPI + SQLAlchemy 2.0 async + Alembic
- Auth: register + login + me (JWT, без refresh rotation)
- CRUD:
  - positions
  - vacancies + vacancy_requirements (min/max)
  - candidates + work_entries + work_entry_tools
- Tool tree:
  - seed из JSON при старте
  - GET всё дерево (кэш в Redis с TTL, ручная инвалидация)
  - CRUD для редактирования
- Matching **on-demand**: `GET /match/vacancy/{id}` → чистый Python, без NumPy
- Pipeline: простой CRUD карточек (без realtime)

**Frontend**
- Подключение `@tanstack/react-query`
- Генерация TS-типов из OpenAPI
- `ky` как HTTP-клиент, auth через localStorage + headers
- Миграция всех страниц с Dexie на useQuery
- Mutations → `invalidateQueries` (**БЕЗ optimistic updates**)
- Удаление `src/db/`, Dexie

### 🚫 Чего НЕ делаем на этой фазе

- ❌ Celery / RQ — используем FastAPI `BackgroundTasks`
- ❌ SSE / WebSockets — refetch при навигации + опциональный polling
- ❌ Row-Level Security — фильтрация через `WHERE workspace_id = ?`
- ❌ Optimistic updates — только `invalidateQueries`
- ❌ Materialized views — обычные SQL-запросы
- ❌ pgvector / embeddings / ML
- ❌ NumPy batch-матчинг — чистый Python
- ❌ Structured logging (structlog) — обычный `logging` + JSON formatter
- ❌ Sentry / OpenTelemetry / Prometheus
- ❌ Refresh token rotation — обычный long-lived JWT пока
- ❌ Email verification — на MVP не нужна
- ❌ Advanced RBAC — только базовые роли (`admin`, `user`)
- ❌ Виртуализация списков — пагинация достаточна
- ❌ Service Worker, bundle optimization, prefetch на hover

### Критерий выхода

- Пользователь регистрируется, создаёт вакансию, добавляет кандидата, видит match-score, двигает кандидата по pipeline
- Тесты покрывают happy-path
- `docker compose up` поднимает всё

---

## ⚡ Фаза 2 · Нормальный UX (2–3 недели)

**Цель:** продукт приятно использовать, не раздражает.

### Что добавляем

**Backend**
- Search и фильтры (WHERE, `pg_trgm` для fuzzy-имён)
- Response events, tasks, notifications (CRUD + список)
- Refresh token rotation + logout
- Email verification (опционально)
- Базовая аналитика: funnel, salary distribution — простые SQL

**Frontend**
- Optimistic updates для Kanban drag-and-drop
- Skeleton screens вместо spinner'ов
- Prefetch детальных страниц на hover
- Debounce 300 мс на поиске
- Code splitting по роутам (lazy imports)
- Toast-уведомления через sonner
- React.memo на горячих компонентах (TreePicker)

**Cache (MVP-версия)**
- Redis с TTL для tool_tree
- Опционально: Redis для match-результатов (TTL 1 час, без умной инвалидации)

### 🚫 Чего НЕ делаем

- ❌ SSE / LISTEN/NOTIFY
- ❌ Precompute матчинга в фоне
- ❌ Cache invalidation по events
- ❌ Celery
- ❌ Виртуализация (если списки < 100 элементов)

### Критерий выхода

- Клик "создать/удалить" ощущается мгновенным (optimistic)
- Типовые операции < 300 мс
- Lighthouse Performance > 85

---

## 🔄 Фаза 3 · Real-time и скорость (3–4 недели)

**Цель:** несколько рекрутеров одновременно работают с данными без конфликтов.

### Что добавляем

**Realtime**
- SSE для pipeline: `LISTEN/NOTIFY` в PostgreSQL + SSE-endpoint
- SSE для уведомлений
- Автоматический reconnect через `@microsoft/fetch-event-source`

**Precompute матчинга**
- При обновлении vacancy/candidate → `BackgroundTask` пересчитывает match
- Результаты в таблицу `match_scores`
- Клиент читает из таблицы, не пересчитывает on-demand

**Cache invalidation**
- По событию изменения — инвалидация Redis в коде сервиса
- Версионирование tool_tree через ETag

**Multitenancy**
- Row-Level Security в PostgreSQL (если workspace'ов > 10 и есть чувствительные данные)
- Audit log

**Виртуализация**
- `@tanstack/react-virtual` для больших списков кандидатов

**Observability**
- structlog с контекстом
- Sentry на backend + frontend
- Базовые метрики Prometheus

### 🚫 Чего НЕ делаем

- ❌ Celery (если задачи не превышают 30 сек — BackgroundTasks достаточно)
- ❌ pgvector, embeddings, ML-матчинг
- ❌ Materialized views (agg-запросы всё ещё < 1 сек)
- ❌ Партиционирование таблиц

### Критерий выхода

- Pipeline синхронизируется между двумя вкладками без F5
- Precompute матчинга — средний лаг < 5 сек после изменения
- SLO: p95 < 300 мс на 100 одновременных пользователях

---

## 🧠 Фаза 4 · Умная система (4+ недели, опционально)

**Цель:** интеллектуальные рекомендации и полная промышленная эксплуатация.

### Что добавляем

**ML-матчинг**
- Embeddings через `sentence-transformers` (мультиязычная модель)
- `pgvector` для хранения
- Гибридный скор: `tools_match × 0.5 + embedding_cosine × 0.3 + salary_fit × 0.2`
- Рекомендации: "похожие кандидаты", "рекомендуемые вакансии"

**Heavy background**
- Celery + Redis-broker (когда задачи стали длиннее 30 сек)
- Celery-beat для регулярных: ежедневный дайджест, еженедельный refresh MV

**Scaling**
- Materialized views для RoadMap и тяжёлой аналитики
- PgBouncer перед PostgreSQL
- Read replicas для аналитики (если нужно)
- Партиционирование `audit_events`, `response_events`

**Advanced analytics**
- Воронка подбора с cohort-анализом
- Time-to-hire по позициям
- Salary benchmarks
- Grafana-дашборды для внутренней команды

**Интеграции**
- HH.ru API — импорт откликов
- Telegram-бот для рекрутеров
- Google Calendar / Outlook для scheduled events
- Email sync (IMAP)
- Webhooks

**Production-readiness**
- Security audit (OWASP ZAP, pen-test)
- Load testing (k6: 100 RPS, 1000 concurrent)
- Backup strategy (pg_dump + WAL + S3)
- Blue-green deployment
- Runbooks для инцидентов
- User documentation

---

## Timeline summary

| Фаза | Длительность | Накоплено | Когда запускать |
|------|-------------|-----------|----------------|
| 1. Рабочий продукт | 1–2 нед | 2 нед | **Старт** |
| 2. Нормальный UX | 2–3 нед | 5 нед | После фидбека от первых пользователей |
| 3. Real-time + scale | 3–4 нед | 9 нед | Когда > 5 активных команд |
| 4. Умная система | 4+ нед | 13+ нед | По реальному спросу |

**MVP в продакшене:** **конец фазы 1 — 2 недели.**
**Commercial-ready:** конец фазы 2 — 5 недель.
**Enterprise-ready:** конец фазы 3 — 9 недель.

> Это НЕ календарный план всей разработки.
> Это *условия*, при которых стоит начинать следующую фазу.
> Если после фазы 1 пользователей хватает и нет жалоб — фазу 2 можно растянуть.

---

## Команда (рекомендация для MVP)

Для фазы 1 хватит:
- 1 fullstack-разработчик (senior)
- либо 1 backend + 1 frontend

Для фаз 2–3:
- +DevOps (0.3 FTE — на инфру и CI/CD)
- +QA (0.3 FTE — ручное + e2e)

Для фазы 4:
- +ML-инженер на 1 месяц (phase 6)
- +backend на интеграции (по мере добавления)

---

## Что брать из прототипа как есть

Прототип уже содержит сложные и выверенные компоненты. **Они портируются без изменений**, меняется только слой данных:

### Компоненты UI
- `TreePicker` — 7 режимов, domain-grid, группы
- `KanbanBoard` — drag-and-drop
- `Spine`, `SpinePopover` — унифицированный показ сущностей
- `Tablet` — полноэкранный view с tabs
- `RoadMap`, `SalaryChart`, `CompareSheet`, `MatchBadge`

### Алгоритмы (портируем на Python в фазе 1)
- `matchScore.ts` → `app/services/matching.py` (**простой цикл, без NumPy**)
- `aggregateCandidate.ts` → `app/services/candidate_aggregation.py`
- `computeRoadmap.ts` → `app/services/roadmap.py` (**обычный SQL, без MV**)
- `computeCareerRecommendations.ts`, `computeVacancyOptimization.ts` → переносим на бэк или оставляем как клиентскую логику до фазы 3

### Данные
- `toolTree.json` → seed-скрипт бэкенда
- `defaultPositions.json` → seed для dev
- `seedVacancies`, `seedCandidates` — только в dev-среде

---

## Anti-patterns (жёстко запрещены на старте)

Если появляется мысль сделать что-то из списка — сначала спроси себя: "это нужно для MVP?"

- ❌ Celery при старте
- ❌ Materialized views
- ❌ pgvector / ML-матчинг
- ❌ Сложные batch-алгоритмы (NumPy и т.п.)
- ❌ msgspec / ручная сериализация
- ❌ Многоуровневые кэши
- ❌ Row-Level Security с нуля
- ❌ SSE на фазе 1
- ❌ Optimistic updates везде

Всё это — **future improvements**. Описываются в ADR, реализуются по факту.
