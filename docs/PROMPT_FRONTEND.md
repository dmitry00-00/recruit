# Промпт для разработки frontend

**Назначение:** ТЗ на миграцию существующего Vite+React+IndexedDB прототипа в full-stack клиент FastAPI-бэкенда с сохранением всей UX/UI-наработки.

---

## Промпт

> Ты — senior React/TypeScript разработчик. Твоя задача — мигрировать существующий прототип рекрутинговой платформы с IndexedDB на HTTP-API FastAPI, сохранив весь UX/UI и компоненты, но переведя слой данных на серверную сторону.
>
> **Что есть.** Работающий Vite SPA на React 19 + TypeScript + zustand + Dexie (IndexedDB). 19 страниц, 29 компонентов, полная доменная модель в `src/entities/index.ts`, сложные визуализации (TreePicker, KanbanBoard, RoadMap, SpinePopover, Tablet). Прототип функционально полный, но однопользовательский.
>
> **Что нужно.** Тот же UI/UX, но данные идут через FastAPI REST API. Поддержка мультитенантности (одновременно несколько команд рекрутеров). Live-обновления для pipeline и уведомлений через SSE.
>
> ### Технический стек (новое)
>
> Добавляем к существующему:
> - **@tanstack/react-query v5** — для серверного состояния (заменяет Dexie)
> - **axios** или **ky** — HTTP клиент (ky короче и легче)
> - **openapi-typescript** — автогенерация типов из `/api/openapi.json`
> - **@tanstack/react-virtual** — виртуализация длинных списков
> - **react-hook-form** + **zod** — формы и валидация
> - **sonner** — toast-уведомления
> - **@microsoft/fetch-event-source** — SSE с reconnect
>
> Что **удаляем**:
> - `dexie` — полностью
> - `src/db/` — целиком
> - Заглушки seed'ов переносим в backend
>
> Что **оставляем** (нетронутое):
> - Все компоненты из `src/components/` (TreePicker, KanbanBoard, Tablet, Spine, RoadMap, SalaryChart и др.)
> - zustand для UI-state (`uiStore`, `filterStore`, `authStore`, `toolTreeStore`)
> - Утилиты визуализации и вычислений (кроме тех, что переезжают на бэк: matchScore, roadmap)
> - Роутинг, ProtectedRoute, ErrorBoundary
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
> ### Паттерны хуков
>
> **Query hook:**
> ```ts
> export function useVacancies(filters?: VacancyFilters) {
>   return useQuery({
>     queryKey: queryKeys.vacancies.list(filters),
>     queryFn: () => api.vacancies.list(filters),
>   });
> }
> ```
>
> **Mutation hook с оптимистичным апдейтом:**
> ```ts
> export function useMovePipelineCard() {
>   const qc = useQueryClient();
>   return useMutation({
>     mutationFn: (p: { id: string; stageId: string; sortOrder: number }) =>
>       api.pipelines.moveCard(p),
>     onMutate: async (p) => {
>       await qc.cancelQueries({ queryKey: queryKeys.pipelines.all });
>       const prev = qc.getQueryData(queryKeys.pipelines.detail(p.pipelineId));
>       qc.setQueryData(queryKeys.pipelines.detail(p.pipelineId), (old) =>
>         applyMove(old, p));
>       return { prev };
>     },
>     onError: (_err, p, ctx) => {
>       if (ctx?.prev) qc.setQueryData(queryKeys.pipelines.detail(p.pipelineId), ctx.prev);
>     },
>     onSettled: (_, __, p) => {
>       qc.invalidateQueries({ queryKey: queryKeys.pipelines.detail(p.pipelineId) });
>     },
>   });
> }
> ```
>
> ### SSE для pipeline и уведомлений
>
> ```ts
> export function useWatchPipeline(pipelineId: string) {
>   const qc = useQueryClient();
>   useEffect(() => {
>     const ctrl = new AbortController();
>     fetchEventSource(`/api/v1/pipelines/${pipelineId}/events`, {
>       signal: ctrl.signal,
>       headers: { Authorization: `Bearer ${useAuthStore.getState().accessToken}` },
>       onmessage: (ev) => {
>         const data = JSON.parse(ev.data);
>         qc.invalidateQueries({ queryKey: queryKeys.pipelines.detail(pipelineId) });
>       },
>     });
>     return () => ctrl.abort();
>   }, [pipelineId, qc]);
> }
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
> - **Виртуализация списков** > 100 элементов (Candidate list, Vacancy list)
> - **Code splitting** по роутам: `const PipelinePage = lazy(() => import(...))`
> - **Prefetch на hover** в списках — при наведении подгружаем detail
> - **useMemo / React.memo** на горячих компонентах (TreePicker, SpinePopover)
> - **Debounce 300мс** на текстовых фильтрах
> - **IntersectionObserver** для infinite scroll
> - **Image lazy loading** для photoUrl, companyLogoUrl
> - **Bundle analyzer** в CI — не даём bundle расти
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
> ### Порядок миграции
>
> 1. Устанавливаем tanstack-query, настраиваем QueryClient
> 2. Генерируем типы из OpenAPI
> 3. Создаём api-client и endpoints
> 4. Мигрируем auth flow (login/register/me/refresh)
> 5. Мигрируем tool-tree на query (+ ToolsEditor мутации)
> 6. Мигрируем Positions, Vacancies, Candidates последовательно
> 7. Мигрируем Pipeline + SSE
> 8. Мигрируем Response events, Tasks, Notifications
> 9. Удаляем Dexie, src/db/, seeding-код
> 10. Настраиваем mock-backend (MSW) для dev без бэкенда
> 11. Bundle optimization, lazy loading
>
> Каждый шаг — отдельный PR. Фича-флаг `VITE_USE_API=true` позволяет временно держать оба слоя работающими.
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

- [ ] Приложение работает без IndexedDB полностью через HTTP
- [ ] Оптимистичные апдейты в Kanban без мигания
- [ ] Pipeline обновляется в реальном времени между двумя вкладками
- [ ] Loading UX: skeleton screens, не spinner'ы
- [ ] Offline индикатор отображается при потере связи
- [ ] Форма не теряет несохранённые данные при refresh (warn на beforeunload)
- [ ] Lighthouse Performance > 85, A11y > 90
- [ ] E2E-сценарий: регистрация → должность → вакансия → кандидат → pipeline → оффер
