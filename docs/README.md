# Документация проекта Recruit

Полная спецификация и дорожная карта разработки рекрутинговой платформы на базе существующего прототипа.

**Подход:** MVP-first. Делаем минимально достаточную реализацию, которая работает end-to-end, и расширяем по мере реальной потребности. Главный принцип — см. `PROMPT_MASTER.md § 0`.

## Навигация

| Документ | Для кого | Что внутри |
|---|---|---|
| [**PROMPT_MASTER.md**](./PROMPT_MASTER.md) | Tech-lead, AI-агент | Главный промпт, общий контекст, порядок работы |
| [**ROADMAP.md**](./ROADMAP.md) | PM, tech-lead | 4 фазы: MVP → UX → real-time → ML, критерии перехода |
| [**SCHEMA.md**](./SCHEMA.md) | Backend, DBA | Полная схема PostgreSQL: таблицы, индексы, RLS, триггеры |
| [**SCHEMA_AUDIT.md**](./SCHEMA_AUDIT.md) | Tech-lead, импорт | Аудит полей hh × LinkedIn × Habr → канонический формат, план расширения `entities` |
| [**OPTIMIZATION.md**](./OPTIMIZATION.md) | Все инженеры | Рекомендации по perf: frontend, backend, DB |
| [**PROMPT_BACKEND.md**](./PROMPT_BACKEND.md) | Backend команда | Детальное ТЗ для FastAPI |
| [**PROMPT_FRONTEND.md**](./PROMPT_FRONTEND.md) | Frontend команда | Детальное ТЗ для миграции SPA |

## Порядок чтения

**Продакт-менеджер / стейкхолдер:**
1. `PROMPT_MASTER.md` § 1 (бизнес-контекст), § 8 (критерии успеха)
2. `ROADMAP.md` — таймлайн

**Tech-lead:**
1. `PROMPT_MASTER.md` целиком
2. `ROADMAP.md` целиком
3. `OPTIMIZATION.md`
4. `SCHEMA.md`

**Backend-разработчик:**
1. `PROMPT_MASTER.md` § 1–4
2. `PROMPT_BACKEND.md` целиком
3. `SCHEMA.md` целиком
4. `OPTIMIZATION.md` § Backend, PostgreSQL

**Frontend-разработчик:**
1. `PROMPT_MASTER.md` § 1–4, § 10
2. `PROMPT_FRONTEND.md` целиком
3. `OPTIMIZATION.md` § Frontend

**DevOps:**
1. `PROMPT_MASTER.md` § 6 (DevOps)
2. `ROADMAP.md` — phase 0 и phase 8
3. `OPTIMIZATION.md` — целиком

## Стек (коротко)

```
Frontend:  Vite 6 + React 19 + TypeScript + tanstack-query + zustand
Backend:   FastAPI + SQLAlchemy 2.0 async + Pydantic v2 + Celery
Database:  PostgreSQL 16 + pgvector + Redis 7 + PgBouncer
Infra:     Docker + GitHub Actions + Sentry + Grafana stack
```

Полное обоснование выбора стека — в `PROMPT_MASTER.md § 2`.

## Прототип

Текущий прототип — Vite SPA с IndexedDB, полная доменная модель и UX. Мигрируется пофазово:

- `src/entities/index.ts` → SQLAlchemy модели (SCHEMA.md)
- `src/utils/matchScore.ts` → `app/services/matching.py` (PROMPT_BACKEND.md)
- `src/db/` (Dexie) → удаляется, замена на tanstack-query (PROMPT_FRONTEND.md)
- Компоненты UI (TreePicker, Kanban, Spine…) сохраняются без изменений
