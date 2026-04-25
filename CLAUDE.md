# Recruiting Intelligence System — CLAUDE.md

## Что это за проект

Recruiting Intelligence System — SPA для автоматизации рекрутинга. Позволяет вести базу вакансий и кандидатов, автоматически сопоставлять их по навыкам (tool matching), вести канбан-пайплайн найма и анализировать данные.

Стадия: локальный прототип на IndexedDB. Backend (FastAPI + PostgreSQL) запланирован на Phase 2+.

---

## Стек

| Слой | Технология |
|---|---|
| UI | React 19 + TypeScript 5.9 + Vite 6 |
| State | Zustand 5 |
| Router | React Router 7 |
| DB (local) | Dexie 4 (IndexedDB) |
| Charts | Recharts 2 |
| DnD | @dnd-kit |
| Icons | lucide-react |
| Styles | CSS Modules |

---

## Команды

```bash
npm run dev      # дев-сервер
npm run build    # TypeScript + Vite build
npm run lint     # ESLint
npm run preview  # preview prod build
```

---

## Архитектура кода

```
src/
├── App.tsx                  # Router + theme
├── components/
│   ├── TreePicker/          # Выбор инструментов (vacancy/candidate/position/edit/compare)
│   ├── Spine/               # Компактная строка кандидата/вакансии
│   ├── SpinePopover/        # Детали во всплывающем окне
│   ├── Tablet/              # Shell: список → карточка → полный экран
│   ├── KanbanBoard/         # Pipeline drag-drop
│   ├── VacancyCard/         # Карточка вакансии
│   ├── CandidateCard/       # Карточка кандидата
│   ├── RoadMap/             # Матрица инструменты × грейды
│   ├── SalaryChart/         # Аналитика зарплат
│   └── ui/                  # Button, Modal, Tabs и т.д.
├── pages/
│   ├── Dashboard/           # Главный список вакансий/кандидатов
│   ├── Positions/           # Шаблоны должностей (CRUD)
│   ├── Vacancies/           # Вакансии (CRUD + import)
│   ├── Candidates/          # Кандидаты (CRUD + import)
│   ├── Tools/ToolsEditor    # Редактор дерева инструментов
│   ├── Pipeline/            # Канбан-доска
│   ├── Compare/             # Сравнение кандидат vs вакансия
│   └── Auth/                # Авторизация
├── stores/                  # Zustand stores
├── db/                      # Dexie схема + seed данные
├── entities/index.ts        # Все TypeScript типы
└── utils/
    ├── toolTreeHelpers.ts   # Дерево инструментов: домены, поиск, мутации
    ├── matchScore.ts        # Алгоритм сопоставления кандидат ↔ вакансия
    ├── aggregateCandidate.ts# Агрегация опыта из workEntries
    └── computeRoadmap.ts    # Матрица для RoadMap
```

---

## Ключевые концепции

### Дерево инструментов (Tool Tree)

Иерархия: **Категория → Подкатегория (→ Группа) → Инструмент**

Домены (`ToolDomain`): `dev`, `design`, `analysis`, `qa`, `infosec`, `devops`, `misc`

Хранится в `localStorage` через `toolTreeHelpers.ts`:
- `getToolTree()` — получить дерево
- `getToolById(id)` — найти инструмент
- `searchTools(query)` — поиск по имени и алиасам
- `setSubcategoryDomain(id, domain)` — задать домен

### TreePicker — режимы

| Режим | Назначение |
|---|---|
| `vacancy` | Выбор инструментов вакансии (min/max) |
| `vacancy-min` | Только минимальные требования |
| `vacancy-max` | Только максимальные требования |
| `candidate` | Опыт кандидата (годы) |
| `candidate-agg` | Агрегированный просмотр |
| `position` | Маска подкатегорий для должности |
| `compare` | Сравнение matched/gap/extra |
| `edit` | Редактирование дерева (CRUD) |

### Алгоритм Match Score (`matchScore.ts`)

Сравнивает опыт кандидата (WorkEntry[]) с требованиями вакансии (min/max years):
- `matched` — кандидат подходит по данному инструменту
- `gap` — опыт кандидата меньше минимума вакансии
- `extra` — у кандидата есть навык, не нужный вакансии

### БД (Dexie / IndexedDB)

Таблицы: `positions`, `vacancies`, `candidates`, `workEntries`, `pipelines`, `pipelineStages`, `pipelineCards`, `users`, `responseEvents`, `recruitmentTasks`

---

## Ветки

| Ветка | Описание |
|---|---|
| `main` | Стабильная база. Базовый функционал CRUD, пайплайн, матчинг. |
| `claude/refactor-tools-treepicker-anTva` | **Активная.** Рефактор Tool Tree + TreePicker. Редактор дерева, ToolDomain таксономия, Spine/Tablet UI, domain-grid layout, compare mode. |
| `claude/fix-filters-and-tabs-X2P37` | Ветка с фиксами фильтров и табов. Базируется на commit с TabletView, spine-popover, column filters. |
| `claude/job-position-constructor-nJr3J` | Конструктор должностей через TreePicker (выбор маски подкатегорий). |
| `claude/recruiting-intelligence-system-pl6qX` | Ранняя ветка рефакторинга UI (Tablet, Spine-pair). Основа для последующих веток. |

---

## Документация (docs/)

| Файл | Содержимое |
|---|---|
| `docs/README.md` | Навигация по всем доками |
| `docs/ROADMAP.md` | 4-фазный план: MVP → UX → Real-time → ML |
| `docs/SCHEMA.md` | PostgreSQL схема для production |
| `docs/OPTIMIZATION.md` | Рекомендации по производительности |
| `docs/PROMPT_*.md` | Детальные спецификации для backend/frontend |

---

## Правила работы с кодом

1. **Типы** — все сущности в `src/entities/index.ts`. Не дублировать типы в компонентах.
2. **Стор** — данные через Zustand stores в `src/stores/`. Прямые вызовы Dexie только внутри stores.
3. **Tool Tree** — мутировать только через хелперы в `toolTreeHelpers.ts`, не напрямую в localStorage.
4. **CSS** — CSS Modules. Не использовать inline styles без крайней необходимости.
5. **Компоненты** — Spine/Tablet паттерн для списков и детальных страниц. Не изобретать новые паттерны раскладки.
6. **TreePicker** — добавлять новый режим через `mode` prop, не создавать новый компонент.
7. **Matching** — логика матчинга только в `matchScore.ts`, агрегация опыта — в `aggregateCandidate.ts`.

---

## Планы (Roadmap)

- **Phase 1 (MVP, текущая)**: стабилизация Tool Tree, CRUD, match scoring
- **Phase 2**: FastAPI backend + PostgreSQL + авторизация
- **Phase 3**: WebSocket, real-time коллаборация
- **Phase 4**: ML-ранжирование кандидатов, salary benchmarking
