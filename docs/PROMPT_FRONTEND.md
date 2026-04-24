# Промпт для разработки frontend

**Назначение:** ТЗ на миграцию существующего Vite+React+IndexedDB прототипа в full-stack клиент FastAPI-бэкенда с сохранением всей UX/UI-наработки.

---

## ⚠️ Режим разработки: MVP-first

Ты работаешь в режиме **MVP-first**. Это НЕ идеальная production-версия — это рабочая миграция с IndexedDB на API, без избыточных оптимизаций.

**Приоритеты:**
1. Все страницы работают через API
2. Простота кода
3. UX не регрессирует

**Правило выбора:** если есть два пути — сложный и простой — выбирай простой, если он не ломает будущую масштабируемость. Оптимизации (SSE, optimistic updates, prefetch) добавляем ПО ФАКТУ, когда базовая версия работает.

---

## Промпт

> Ты — senior React/TypeScript разработчик. Твоя задача — мигрировать существующий прототип рекрутинговой платформы с IndexedDB на HTTP-API FastAPI, сохранив весь UX/UI и компоненты, но переведя слой данных на серверную сторону.
>
> **Что есть.** Работающий Vite SPA на React 19 + TypeScript + zustand + Dexie (IndexedDB). 19 страниц, 29 компонентов, полная доменная модель в `src/entities/index.ts`, сложные визуализации (TreePicker, KanbanBoard, RoadMap, SpinePopover, Tablet). Прототип функционально полный, но однопользовательский.
>
> **Что нужно.** Тот же UI/UX, но данные идут через FastAPI REST API. Поддержка мультитенантности (одновременно несколько команд рекрутеров). Live-обновления для pipeline и уведомлений через SSE.
>
> ### Технический стек (MVP)
>
> Добавляем к существующему:
> - **@tanstack/react-query v5** — для серверного состояния (заменяет Dexie)
> - **ky** — HTTP клиент (короче и легче axios)
> - **openapi-typescript** — автогенерация типов из `/api/openapi.json`
> - **react-hook-form** + **zod** — формы и валидация
> - **sonner** — toast-уведомления
>
> Что **удаляем**:
> - `dexie` — полностью
> - `src/db/` — целиком
> - Заглушки seed'ов переносим в backend
>
> Что **оставляем** (нетронутое):
> - Все компоненты из `src/components/` (TreePicker, KanbanBoard, Tablet, Spine, RoadMap, SalaryChart и др.)
> - zustand для UI-state (`uiStore`, `filterStore`, `authStore`, `toolTreeStore`)
> - Утилиты визуализации
> - Роутинг, ProtectedRoute, ErrorBoundary
>
> **Добавляется позже (этап 2–3, НЕ MVP):**
> - `@tanstack/react-virtual` — когда списки станут > 100 элементов
> - `@microsoft/fetch-event-source` — когда появится SSE (этап 3)
> - Bundle analyzer в CI — при приближении к 1 МБ
> - MSW — когда появится отдельная разработка фронта без бэка
>
> ### Архитектура слоёв
>
> ```
> src/
> ├── api/                      ← NEW: HTTP клиент + endpoints
> │   ├── client.ts              ← ky с interceptors
> │   ├── endpoints/
> │   │   ├── auth.ts, positions.ts, vacancies.ts, ...
> │   └── types.ts               ← re-export из openapi-typescript
> ├── hooks/
> │   ├── queries/              ← NEW: useQuery обёртки
> │   │   ├── usePositions.ts
> │   │   ├── useVacancies.ts
> │   │   └── ...
> │   └── mutations/            ← NEW: useMutation обёртки
> │       ├── useCreateVacancy.ts
> │       └── ...
> ├── stores/                   ← только UI-state, без сущностей
> ├── entities/                 ← заменяется на packages/shared-types
> ├── components/               ← остаётся, но некоторые переведены на queries
> ├── pages/                    ← остаётся, но использует hooks/queries
> ├── utils/                    ← минус matchScore, roadmap (они теперь на бэке)
> └── App.tsx
> ```
>
> ### Принципы разделения состояния
>
> | Вид состояния | Инструмент |
> |--------------|-----------|
> | Данные с сервера | tanstack-query |
> | UI-state (модалки, табы, скролл) | zustand (`uiStore`) |
> | Фильтры текущего экрана | zustand (`filterStore`) с синхронизацией в URL |
> | Аутентификация | zustand (`authStore`) + refresh через cookie |
> | Формы | react-hook-form (локально в компоненте) |
> | Tool tree | tanstack-query (`staleTime: Infinity`, manual invalidate) |
>
> **Правило:** если данные приходят с сервера и могут устареть — они в react-query. Всё остальное — в zustand или локально.
>
> ### HTTP клиент
>
> ```ts
> import ky from 'ky';
> import { useAuthStore } from '@/stores';
>
> export const api = ky.create({
>   prefixUrl: import.meta.env.VITE_API_URL,
>   credentials: 'include', // для refresh cookie
>   hooks: {
>     beforeRequest: [(req) => {
>       const token = useAuthStore.getState().accessToken;
>       if (token) req.headers.set('Authorization', `Bearer ${token}`);
>     }],
>     afterResponse: [async (req, _opts, res) => {
>       if (res.status === 401) {
>         const refreshed = await refreshAccessToken();
>         if (refreshed) {
>           return ky(req);
>         }
>       }
>       return res;
>     }],
>   },
> });
> ```
>
> Refresh token хранится в HttpOnly cookie (не доступен JS). Access token — в памяти zustand. При 401 — один retry с refresh.
>
> ### React Query configuration
>
> ```ts
> const queryClient = new QueryClient({
>   defaultOptions: {
>     queries: {
>       staleTime: 30_000,
>       gcTime: 5 * 60_000,
>       refetchOnWindowFocus: false,
>       retry: (n, err) => {
>         if (err instanceof HTTPError && err.response.status < 500) return false;
>         return n < 2;
>       },
>     },
>     mutations: {
>       onError: (err) => {
>         toast.error(extractErrorMessage(err));
>       },
>     },
>   },
> });
> ```
>
> **Организация query keys:**
> ```ts
> export const queryKeys = {
>   vacancies: {
>     all:    ['vacancies'] as const,
>     list:   (filters?: VacancyFilters) => [...queryKeys.vacancies.all, 'list', filters] as const,
>     detail: (id: string) => [...queryKeys.vacancies.all, 'detail', id] as const,
>   },
>   // ...
> };
> ```
>
> ### Data fetching стратегия (по этапам)
>
> **Этап 1 (MVP) — простой useQuery без изысков:**
> - Все списки через `useQuery`, без ручной оптимизации
> - После mutation → `invalidateQueries` на соответствующий ключ
> - Loading — обычный spinner / skeleton
> - Ошибка → toast, опция retry через `refetch()`
>
> ```ts
> // MVP-версия hook'а
> export function useVacancies(filters?: VacancyFilters) {
>   return useQuery({
>     queryKey: queryKeys.vacancies.list(filters),
>     queryFn: () => api.vacancies.list(filters),
>   });
> }
>
> // MVP-версия mutation — просто инвалидация, без optimistic
> export function useCreateVacancy() {
>   const qc = useQueryClient();
>   return useMutation({
>     mutationFn: api.vacancies.create,
>     onSuccess: () => {
>       qc.invalidateQueries({ queryKey: queryKeys.vacancies.all });
>       toast.success('Вакансия создана');
>     },
>   });
> }
> ```
>
> **НЕ делаем на этапе 1:**
> - Optimistic updates
> - Prefetch на hover
> - Manual query key manipulation в `setQueryData`
> - SSE
> - `useInfiniteQuery` (обычная offset-пагинация достаточна)
>
> **Этап 2 — улучшение UX** (добавляется после завершения этапа 1):
> - Optimistic updates на горячих путях: drag-and-drop в Kanban, toggle статуса задачи
> - Prefetch на hover в списках
> - Skeleton screens вместо spinner'ов
>
> **Этап 3 — real-time** (только если реально нужно):
> - SSE для pipeline и notifications
> - Background refetch при фокусе окна
> - Cache invalidation по events
>
> ### Оптимистичные обновления (Этап 2, НЕ MVP)
>
> Добавляем только для Kanban drag-and-drop, где лаг особенно заметен. Пример:
>
> ```ts
> // ДОБАВЛЯТЬ ТОЛЬКО ПОСЛЕ ЗАВЕРШЕНИЯ ЭТАПА 1
> export function useMovePipelineCard() {
>   const qc = useQueryClient();
>   return useMutation({
>     mutationFn: api.pipelines.moveCard,
>     onMutate: async (p) => {
>       await qc.cancelQueries({ queryKey: queryKeys.pipelines.detail(p.pipelineId) });
>       const prev = qc.getQueryData(queryKeys.pipelines.detail(p.pipelineId));
>       qc.setQueryData(queryKeys.pipelines.detail(p.pipelineId), (old) => applyMove(old, p));
>       return { prev };
>     },
>     onError: (_err, p, ctx) => {
>       if (ctx?.prev) qc.setQueryData(queryKeys.pipelines.detail(p.pipelineId), ctx.prev);
>       toast.error('Не удалось переместить карточку');
>     },
>     onSettled: (_, __, p) => {
>       qc.invalidateQueries({ queryKey: queryKeys.pipelines.detail(p.pipelineId) });
>     },
>   });
> }
> ```
>
> ### Real-time обновления (Этап 3, опционально)
>
> **Для MVP — не делаем вообще.** Если на экране нужна свежесть данных — используй `refetchInterval: 30_000` на useQuery:
>
> ```ts
> useQuery({
>   queryKey: queryKeys.pipelines.detail(id),
>   queryFn: () => api.pipelines.get(id),
>   refetchInterval: 30_000, // пока достаточно
> });
> ```
>
> Когда и если polling начнёт создавать нагрузку — заменить на SSE:
>
> ```ts
> // Код SSE переносится в отдельный хук useWatchPipeline на этапе 3
> // НЕ реализовывать в MVP
> ```
>
> ### Формы
>
> Каждая форма — `react-hook-form` + `zod` схема. Схема импортируется из `packages/shared-types` (сгенерированная из OpenAPI), оборачивается `zodResolver`.
>
> ```tsx
> const schema = vacancyCreateSchema; // из shared-types
> type FormData = z.infer<typeof schema>;
>
> const form = useForm<FormData>({
>   resolver: zodResolver(schema),
>   defaultValues: { ... },
> });
>
> const create = useCreateVacancy();
> const onSubmit = form.handleSubmit((data) => create.mutate(data));
> ```
>
> ### Страницы — что меняется
>
> - **Dashboard, PositionList, VacancyList, CandidateList** — заменяем load() из zustand на useQuery
> - **PositionForm, VacancyForm, CandidateForm** — react-hook-form + mutation
> - **PositionDetail, VacancyDetail, CandidateDetail** — prefetch + детальный query
> - **Pipeline** — useQuery + useWatchPipeline (SSE)
> - **ComparePage** — query по `(vacancyId, candidateId)` → match_result с бэка
> - **RecruiterDashboard** — агрегированный analytics query
> - **ToolsEditor** — остаётся, но мутации идут на бэк (не в localStorage)
>
> ### Performance
>
> **MVP (этап 1):**
> - **Debounce 300мс** на текстовых фильтрах (уже есть в прототипе)
> - **Image lazy loading** через `loading="lazy"` для photoUrl, companyLogoUrl
> - **Code splitting** по роутам для тяжёлых страниц (Pipeline, ToolsEditor): `const PipelinePage = lazy(() => import(...))`
>
> **Оптимизации на этапе 2** (добавляем по необходимости):
> - Виртуализация списков > 100 элементов (`@tanstack/react-virtual`)
> - Prefetch на hover в списках
> - `React.memo` для горячих рендер-узлов (TreePicker, SpinePopover)
> - Tree-shaking `lucide-react` через прямые импорты
> - Замена `recharts` на `visx` (если чарты тормозят)
>
> **НЕ делать в MVP:** Service Worker, HTTP/2 push, ручная оптимизация chunks, preloading critical fonts.
>
> ### i18n (опционально)
>
> Если нужна мультиязычность — `react-intl` или `i18next`. Приоритет: `ru`, `en`. Сообщения в `src/locales/{lang}.json`, ICU-format для плюрализации.
>
> ### A11y
>
> - Все интерактивные элементы — кнопки, не div'ы с onClick
> - `aria-label` для icon-only кнопок
> - Focus management в модалках (focus trap)
> - Клавиатурная навигация в TreePicker и Kanban
> - Цвета с достаточным контрастом (WCAG AA)
>
> ### Тесты
>
> - **Vitest** для unit (утилиты, reducers)
> - **@testing-library/react** для компонентов
> - **Playwright** для e2e (happy paths, критические сценарии)
> - **MSW** для моков API в компонентных тестах
> - Coverage > 70% для `hooks/`, `utils/`
>
> ### Error handling
>
> - **Global Error Boundary** — уже есть, расширяем логированием в Sentry
> - **Query error states** — показываем retry button + описание ошибки
> - **Toast notifications** (sonner) для mutation errors
> - **Offline-first графически:** показываем индикатор при потере связи (navigator.onLine + query networkMode)
>
> ### Порядок миграции (MVP-first)
>
> **Этап 1 — базовая миграция (MVP):**
> 1. Устанавливаем tanstack-query, настраиваем QueryClient с дефолтами
> 2. Генерируем типы из OpenAPI
> 3. Создаём api-client (ky) и endpoints
> 4. Мигрируем auth flow (login/register/me — без refresh rotation)
> 5. Мигрируем tool-tree на query + ToolsEditor мутации
> 6. Мигрируем Positions, Vacancies, Candidates последовательно — **только useQuery + invalidateQueries**
> 7. Мигрируем Pipeline **без SSE** (refetch при открытии страницы, опционально `refetchInterval`)
> 8. Мигрируем Response events, Tasks, Notifications
> 9. Удаляем Dexie, src/db/, seeding-код
>
> **Критерий выхода из этапа 1:** приложение работает через API, все страницы функциональны.
>
> **Этап 2 — улучшение UX** (добавляем после этапа 1):
> 10. Optimistic updates для Kanban drag-and-drop
> 11. Skeleton screens вместо spinner'ов
> 12. Prefetch на hover для деталей
> 13. Bundle optimization, lazy routes
>
> **Этап 3 — real-time** (только при реальной потребности):
> 14. SSE для pipeline
> 15. SSE для уведомлений
> 16. Offline detection
>
> Каждый шаг — отдельный PR. Не переходи к следующему этапу, пока предыдущий не стабилен на реальном использовании.
>
> ### Deliverables
>
> - Весь `src/` обновлён, Dexie удалён
> - `vite.config.ts` настроен для proxying API в dev
> - `.env.example` с `VITE_API_URL`
> - Обновлённый `README.md`
> - E2E тесты проходят против запущенного бэкенда
> - Bundle size < 250 КБ initial, все роуты lazy

---

## Критерии приёмки

### Этап 1 (MVP)

- [ ] Приложение работает без IndexedDB полностью через HTTP
- [ ] Все страницы из прототипа функциональны (не регрессия UX)
- [ ] Форма не теряет данные при фокус-loss (обычное поведение react-hook-form)
- [ ] E2E-сценарий: регистрация → должность → вакансия → кандидат → pipeline → оффер
- [ ] Dexie и `src/db/` удалены из кода

### Этап 2 (добавляется позже)

- [ ] Оптимистичные апдейты в Kanban без визуального лага
- [ ] Skeleton screens вместо spinner'ов
- [ ] Lighthouse Performance > 85

### Этап 3 (добавляется ещё позже)

- [ ] Pipeline обновляется в реальном времени между двумя вкладками (SSE)
- [ ] Offline индикатор при потере связи
- [ ] A11y > 90
