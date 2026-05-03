# Документация проекта Recruit

Полная спецификация и дорожная карта разработки рекрутинговой платформы на базе существующего прототипа.

**Подход:** MVP-first. Делаем минимально достаточную реализацию, которая работает end-to-end, и расширяем по мере реальной потребности. Главный принцип — см. `PROMPT_BUILD.md § 0`.

## Навигация

### Главный мастер-промпт

| Документ | Для кого | Что внутри |
|---|---|---|
| [**PROMPT_BUILD.md**](./PROMPT_BUILD.md) | Tech-lead, AI-агент | **Полный промпт разработки**: фронт + бэк + БД + OpenClaw + Telegram + калибровка. Точка входа. |

### Подспеки

| Документ | Для кого | Что внутри |
|---|---|---|
| [**PROMPT_BACKEND.md**](./PROMPT_BACKEND.md) | Backend команда | Детальное ТЗ для FastAPI |
| [**PROMPT_FRONTEND.md**](./PROMPT_FRONTEND.md) | Frontend команда | Детальное ТЗ для миграции SPA |
| [**PROMPT_OPENCLAW.md**](./PROMPT_OPENCLAW.md) | Backend / Devops | Виртуальный ассистент: скиллы, контракты, промпты, деплой |
| [**PROMPT_TELEGRAM_BOT.md**](./PROMPT_TELEGRAM_BOT.md) | Backend | Telegram-бот: handlers, дайджесты, push-нотификации, privacy/compliance |
| [**PROMPT_CALIBRATION.md**](./PROMPT_CALIBRATION.md) | Backend / Data | Калибровочный пайплайн на 333k Habr Career: анонимизация, агрегаты, валидация качества |

### Схема и таймлайн

| Документ | Для кого | Что внутри |
|---|---|---|
| [**SCHEMA.md**](./SCHEMA.md) | Backend, DBA | Полная схема PostgreSQL: таблицы, индексы, RLS, триггеры |
| [**SCHEMA_AUDIT.md**](./SCHEMA_AUDIT.md) | Tech-lead, импорт | Аудит полей hh × LinkedIn × Habr → канонический формат, план расширения `entities` |
| [**ROADMAP.md**](./ROADMAP.md) | PM, tech-lead | Фазы поставки и критерии перехода |
| [**OPTIMIZATION.md**](./OPTIMIZATION.md) | Все инженеры | Рекомендации по perf: frontend, backend, DB |

### Архивные

| Документ | Статус |
|---|---|
| [PROMPT_MASTER.md](./PROMPT_MASTER.md) | **Заменён** на `PROMPT_BUILD.md`. Оставлен для истории — не считать актуальным. |

## Порядок чтения

**Продакт-менеджер / стейкхолдер:**
1. `PROMPT_BUILD.md` § 1 (бизнес-контекст), § 13 (фазы), § 15 (критерии приёмки)
2. `ROADMAP.md` — таймлайн

**Tech-lead:**
1. `PROMPT_BUILD.md` целиком — это карта всей системы
2. `SCHEMA_AUDIT.md` — текущее состояние канона
3. `SCHEMA.md` — детали БД
4. Подспеки в порядке релевантности

**Backend-разработчик:**
1. `PROMPT_BUILD.md` § 1–7
2. `PROMPT_BACKEND.md` целиком
3. `SCHEMA.md` + `SCHEMA_AUDIT.md`
4. По необходимости: `PROMPT_OPENCLAW.md` (контракты), `PROMPT_TELEGRAM_BOT.md` (handlers)
5. `OPTIMIZATION.md` § Backend, PostgreSQL

**Frontend-разработчик:**
1. `PROMPT_BUILD.md` § 1–5, § 8
2. `PROMPT_FRONTEND.md` целиком
3. `SCHEMA_AUDIT.md` — какие поля показывать
4. `OPTIMIZATION.md` § Frontend

**Виртуальный ассистент / автоматизация:**
1. `PROMPT_BUILD.md` § 9
2. `PROMPT_OPENCLAW.md` целиком
3. `PROMPT_CALIBRATION.md` — для seed shadow registry

**Telegram-бот:**
1. `PROMPT_BUILD.md` § 10
2. `PROMPT_TELEGRAM_BOT.md` целиком
3. `PROMPT_BACKEND.md` § безопасность

**DevOps:**
1. `PROMPT_BUILD.md` § 2 (архитектура), § 13 (фазы)
2. `PROMPT_OPENCLAW.md` § 8 (деплой)
3. `OPTIMIZATION.md` целиком

**Калибровка / Data:**
1. `PROMPT_BUILD.md` § 11–12
2. `PROMPT_CALIBRATION.md` целиком
3. `SCHEMA_AUDIT.md` § «Versioning канона»

## Стек (коротко)

```
Frontend:    Vite 6 + React 19 + TypeScript + tanstack-query + zustand
Backend:     FastAPI 3.12 + SQLAlchemy 2.0 async + Pydantic v2 + aiogram 3
Database:    PostgreSQL 16 (+ pgvector в Phase 5) + Redis 7
Assistant:   OpenClaw + DeepSeek V4 Flash/Pro
Telegram:    Bot API через aiogram (бот) + MTProto через telethon (OpenClaw watcher)
Infra:       Docker + docker-compose + GitHub Actions
```

Полное обоснование стека — в `PROMPT_BUILD.md § 3`.

## Прототип

Текущий прототип — Vite SPA с IndexedDB, полная доменная модель и UX. Мигрируется пофазово:

- `src/entities/index.ts` → SQLAlchemy модели (SCHEMA.md + SCHEMA_AUDIT.md)
- `src/utils/matchScore.ts` → `app/services/matching.py` (PROMPT_BACKEND.md)
- `src/utils/parse*.ts` (parseSalary, parseAddress, parseExperience, parseLanguage, parseOpenToWork) → одноимённые модули в `app/services/parsers/`
- `src/utils/versioning.ts` → `app/services/versioning.py`
- `src/db/` (Dexie) → удаляется, замена на tanstack-query
- Компоненты UI (TreePicker, Kanban, Spine, RoadMap, SalaryChart, Tablet) сохраняются без изменений
- Появляются новые страницы: `/inbox`, `/leads`, `/registry`, `/calibration`, `/assistant`, `/admin/channels`, `/admin/api-keys`, `/admin/bots`
