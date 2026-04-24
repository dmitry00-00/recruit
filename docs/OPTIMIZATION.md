# Рекомендации по оптимизации

**Профиль приложения:** B2B рекрутинговая платформа. Малое число пользователей (десятки–сотни одновременно), но тяжёлые клиентские данные (деревья, матрицы матчинга, Kanban-доски), сложная фильтрация и частые пересчёты.

**Из этого вытекают принципы:**
- Оптимизируем latency, а не throughput
- Кэш на всех уровнях, умная инвалидация
- Нагрузка на чтение >> нагрузка на запись
- Данные связные и иерархичные — используем сильные стороны PostgreSQL (JOIN'ы, CTE, JSONB)

---

## Frontend

### Bundle size
Текущий bundle — 1 МБ. Цель — < 250 КБ initial, остальное lazy.

**Code splitting**
```tsx
const PipelinePage = lazy(() => import('./pages/Pipeline'));
const ComparePage  = lazy(() => import('./pages/Compare'));
```
Роуты, которые используются редко (ToolsEditor, VacancyImport, RecruiterDashboard), — строго lazy. Сохраняем чанки в отдельных файлах для долгосрочного кэширования.

**Tree shaking lucide-react**
Замена:
```tsx
import { Code2, Palette } from 'lucide-react';
```
на:
```tsx
import Code2 from 'lucide-react/dist/esm/icons/code-2';
```
Экономит ~100 КБ (lucide тащит все иконки при barrel-импорте).

**recharts → lightweight alternative**
`recharts` весит ~500 КБ. Для SalaryChart и RoadMap достаточно `visx` или ручного SVG/Canvas. На боевой нагрузке с 1000+ точек recharts тормозит.

**Анализ**
```bash
pnpm add -D vite-bundle-visualizer
pnpm dlx vite-bundle-visualizer
```

### Рендер-перформанс

**TreePicker** — главный источник рендера. Оптимизации:
- `useMemo` для `filterSet`, `lockedSet`, `selectedSet` — уже есть, оставляем
- `React.memo` для `renderTool` и `renderSubToggle` с корректным shallow сравнением
- При 500+ инструментах — **виртуализация** через `@tanstack/react-virtual` внутри `toolsPanel`

**Kanban-доска**
- `@dnd-kit` уже используется — хорошо
- При 200+ карточках — виртуализация колонок
- Отдельная память для «перетаскиваемого» состояния, чтобы не триггерить ре-рендер всех карточек

**Filter / search**
- Debounce 300 мс на текстовых инпутах
- AbortController на запросах: новый запрос отменяет предыдущий
- Тренд: ставим `experimental_useEffectEvent` (стабильно после React 19.2) для обработчиков без пересоздания

### Data fetching (tanstack-query)

**Настройки по умолчанию**
```ts
new QueryClient({
  defaultOptions: {
    queries: {
      staleTime:   30_000,       // данные свежие 30 сек
      gcTime:      5 * 60_000,   // храним 5 мин после отписки
      refetchOnWindowFocus: false, // мешает UX
      retry:       (n, err) => n < 2 && err.status >= 500,
    },
  },
});
```

**Кэш-ключи**
```ts
// Плохо: частично-перекрывающиеся ключи
useQuery(['vacancies'], ...)
useQuery(['vacancies', { filter }], ...)

// Хорошо: иерархические
useQuery(['vacancies', 'list'], ...)
useQuery(['vacancies', 'list', { filter }], ...)
useQuery(['vacancies', 'detail', id], ...)
```

**Prefetch на ховер**
В списке вакансий при наведении на карточку:
```tsx
onMouseEnter={() => queryClient.prefetchQuery(['vacancies', 'detail', v.id], ...)}
```
Открытие детали мгновенное.

**Инфинити-скролл вместо пагинации**
`useInfiniteQuery` + IntersectionObserver. Для списков кандидатов лучше UX.

### Сеть

**Serverpush / SSE вместо polling**
Pipeline, уведомления, новые отклики — только через SSE.
EventSource полифилл для перехвата 5xx и переподключения.

**HTTP/2 + gzip/brotli**
На nginx `gzip_types + brotli_types` для JSON и статики.

**Сжатие запросов**
Для import-endpoint'ов (большой JSON от кандидатов из HH) — `Content-Encoding: gzip` с клиента.

**Service Worker**
Для кеширования статики (Workbox). **Не** кэшируем API-ответы — полагаемся на tanstack-query.

---

## Backend

### Async всё

**Все I/O операции — async**
- `asyncpg` (через `SQLAlchemy 2.0 asyncio`)
- `httpx.AsyncClient` для внешних API
- `aioredis` для Redis
- **Никогда** не смешиваем sync и async: blocking-код → `run_in_executor` или выносим в Celery

### SQLAlchemy 2.0 паттерны

**Session-per-request**
```python
async def get_db() -> AsyncIterator[AsyncSession]:
    async with AsyncSessionFactory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
```

**Selectinload вместо lazy**
Для `vacancies.requirements`, `candidates.work_entries`:
```python
query = select(Vacancy).options(
    selectinload(Vacancy.requirements),
    selectinload(Vacancy.position),
)
```
Убирает N+1 сразу.

**Запросы-агрегаторы одним SQL**
Не делаем «5 запросов для дашборда». Один запрос с CTE:
```sql
WITH stats AS (
  SELECT
    COUNT(*) FILTER (WHERE status = 'open')   AS open_count,
    COUNT(*) FILTER (WHERE status = 'hired')  AS hired_count,
    AVG(salary_to)                            AS avg_salary
  FROM vacancies WHERE workspace_id = $1
)
SELECT * FROM stats;
```

### Кэширование

**Redis — 3 слоя**

1. **Hot-data** (токены, сессии, rate limits) — TTL короткий, запись частая
2. **Query-cache** (matching results, analytics) — TTL средний, инвалидация по событию
3. **Static-cache** (tool tree, static lookups) — TTL длинный, ручная инвалидация на admin-endpoint

**Паттерн cache-aside**
```python
async def get_match_score(vacancy_id: UUID, candidate_id: UUID) -> float:
    key = f"match:{vacancy_id}:{candidate_id}"
    if cached := await redis.get(key):
        return float(cached)
    score = await compute_match_score(vacancy_id, candidate_id)
    await redis.set(key, score, ex=3600)
    return score
```

**Cache stampede prevention**
Используем `cashews` или `aiocache` с lock — чтобы при expiry не было 1000 параллельных пересчётов.

### Фоновые задачи

**Celery + Redis-broker** для:
- Матчинг больших множеств
- Пересчёт RoadMap
- Отправка email
- Импорт из HH.ru
- Обновление materialized views

**ARQ** как более лёгкая альтернатива Celery — если задач мало. Но Celery проверен в бою.

**Celery-beat** для периодических: ежесуточный дайджест, еженедельный refresh MV, часовой health-check.

### Pydantic v2

- Использовать `model_config = ConfigDict(from_attributes=True)` — в 5× быстрее v1
- Для hot-path API (match, search) — **не** валидировать ответы через Pydantic, сериализовать вручную (`orjson`)
- `msgspec` для супер-горячих эндпоинтов (в 10× быстрее Pydantic)

### FastAPI

- `orjson` как default JSON encoder: `app = FastAPI(default_response_class=ORJSONResponse)`
- `gzip_middleware` только для ответов > 1 КБ
- Dependency injection через `Annotated[..., Depends(...)]` (быстрее + чище)

---

## PostgreSQL

### Индексы

**Базовые**
```sql
CREATE INDEX idx_vacancies_workspace_status ON vacancies(workspace_id, status) WHERE status = 'open';
CREATE INDEX idx_candidates_workspace       ON candidates(workspace_id);
CREATE INDEX idx_work_entries_candidate     ON work_entries(candidate_id);
CREATE INDEX idx_vacancy_reqs_vacancy       ON vacancy_requirements(vacancy_id);
```

**Partial indexes** для «живых» выборок
```sql
CREATE INDEX idx_tasks_pending_due ON recruitment_tasks(due_date)
  WHERE status = 'pending';
```

**GIN для массивов и JSONB**
```sql
CREATE INDEX idx_candidates_tool_ids_gin ON work_entry_tools USING GIN (tool_id);
CREATE INDEX idx_positions_required_gin  ON positions USING GIN (required_categories);
```

**pg_trgm** для fuzzy-поиска
```sql
CREATE EXTENSION pg_trgm;
CREATE INDEX idx_candidates_name_trgm ON candidates USING GIN (
  (first_name || ' ' || last_name) gin_trgm_ops
);
```

**Full-text**
```sql
ALTER TABLE vacancies ADD COLUMN search_tsv tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('russian', coalesce(company_name, '')), 'A') ||
    setweight(to_tsvector('russian', coalesce(notes, '')),        'B')
  ) STORED;
CREATE INDEX idx_vacancies_fts ON vacancies USING GIN (search_tsv);
```

### Денормализация и materialized views

**`match_scores` таблица** (денормализация)
- `(vacancy_id, candidate_id, score_min, score_max, computed_at)`
- Обновляется триггером при `INSERT/UPDATE` в `vacancy_requirements` или `work_entry_tools`
- Либо асинхронно через Celery (listener на LISTEN/NOTIFY)

**`position_roadmap_mv`**
```sql
CREATE MATERIALIZED VIEW position_roadmap_mv AS
SELECT
  position_id,
  grade,
  jsonb_agg(DISTINCT tool_id) AS tool_ids,
  AVG(salary_to) AS avg_salary,
  COUNT(*) AS vacancies_count
FROM vacancies v
JOIN vacancy_requirements vr ON vr.vacancy_id = v.id
GROUP BY position_id, grade;
CREATE UNIQUE INDEX ON position_roadmap_mv (position_id, grade);
-- REFRESH MATERIALIZED VIEW CONCURRENTLY position_roadmap_mv;
```

Обновление — Celery-beat раз в час или по событию.

### JSONB с умом

Для `position.required_categories` (полиморфная структура) — JSONB с GIN. Для `vacancy.min_requirements` — **нормализованная таблица**, потому что фильтруем и джойним.

Правило: **JSONB когда читаем целиком, нормализация когда фильтруем по содержимому**.

### Connection pooling

- `asyncpg` pool в самом SQLAlchemy (`pool_size=20, max_overflow=10`)
- **PgBouncer** в transaction mode перед базой — для защиты от connection spikes
- Настройка: `pool_pre_ping=True` — отлавливает dead connections

### Row-level security (RLS)

Для многопользовательского режима — RLS **обязателен** (не надежда на ORM):
```sql
ALTER TABLE vacancies ENABLE ROW LEVEL SECURITY;

CREATE POLICY vacancies_workspace_isolation ON vacancies
  USING (workspace_id = current_setting('app.current_workspace_id')::uuid);
```
В FastAPI каждый запрос:
```python
await session.execute(text("SET app.current_workspace_id = :ws"), {"ws": user.workspace_id})
```

### Мониторинг

- `pg_stat_statements` включено
- Slow-query log: `log_min_duration_statement = 100` (логируем > 100 мс)
- Регулярный `EXPLAIN (ANALYZE, BUFFERS)` для топ-10 запросов
- `VACUUM ANALYZE` autovacuum тюнинг: для горячих таблиц — агрессивнее

---

## Специфика этого приложения

### Tool tree — read-heavy, write-rare

- **Bundle внутри фронта** как fallback, **Redis** как источник истины
- Один эндпоинт `/api/v1/tools/tree` возвращает ВСЁ дерево (оно весит ~50 КБ)
- Кэшируется в Redis + CDN; cache key версионируется на изменения (ETag)
- В клиенте tanstack-query с `staleTime: Infinity`, инвалидация вручную при admin-правках

### Matching — write-on-event, read-often

- Храним результаты в таблице `match_scores`
- Триггер на изменение `vacancy_requirements`, `work_entry_tools` → Celery job пересчёта
- Клиенту отдаём из таблицы, не пересчитываем on-demand

### Pipeline — collaborative, realtime

- Source of truth — БД, но клиенту подписка через SSE (`LISTEN/NOTIFY`)
- Оптимистичные обновления + rollback
- CRDT-подобная логика не нужна: у pipeline-карточки одно местоположение, конфликты редки. Last-write-wins ok.

### Search — компромисс

- Для сложных фильтров по инструментам — структурированные запросы (SQL WHERE)
- Для текстового поиска — FTS с русской морфологией
- Для fuzzy («~Петров») — pg_trgm
- Для «похожих кандидатов» (phase 6) — pgvector

### Аналитика

- Preaggregate: ежедневные агрегаты по вакансиям/кандидатам в отдельную таблицу
- Grafana для внутренних дашбордов (подключается напрямую к PostgreSQL read replica)
- Для пользовательских дашбордов — материализованные views + React/visx

### Экспорт и импорт

- CSV/JSON — не тащим в память целиком, стримим через `StreamingResponse`
- Импорт больших файлов — в Celery, отображаем прогресс через SSE

---

## Чеклист перед каждым релизом

### Frontend
- [ ] Bundle size не вырос (сравнить с baseline в CI)
- [ ] Lighthouse Performance > 85
- [ ] Нет console.error на чистом пути пользователя
- [ ] A11y: клавиатурная навигация работает

### Backend
- [ ] Все новые эндпоинты в OpenAPI
- [ ] TS-типы перегенерированы
- [ ] `pytest` зелёный, coverage > 80% на services/
- [ ] `EXPLAIN ANALYZE` для всех новых запросов < 50 мс

### DB
- [ ] Миграция обратимая (`downgrade` работает)
- [ ] Миграция не блокирует таблицу > 1 сек на проде
- [ ] Новые индексы созданы с `CREATE INDEX CONCURRENTLY`

### Общее
- [ ] Changelog обновлён
- [ ] Feature flag для рискованной фичи
- [ ] Rollback-план зафиксирован
