# Схема базы данных PostgreSQL

**Назначение:** целевая схема для миграции с IndexedDB. Покрывает все сущности прототипа + мультитенантность (workspaces), аудит и поисковые индексы.

Все PK — `uuid` (`gen_random_uuid()`), все FK — с `ON DELETE CASCADE` где это безопасно, иначе `RESTRICT`.

Все таблицы содержат `created_at timestamptz NOT NULL DEFAULT now()` и `updated_at timestamptz` (триггер на update).

---

## Расширения

```sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";      -- gen_random_uuid
CREATE EXTENSION IF NOT EXISTS "pg_trgm";       -- fuzzy search
CREATE EXTENSION IF NOT EXISTS "btree_gin";     -- composite GIN indexes
CREATE EXTENSION IF NOT EXISTS "unaccent";      -- russian search
CREATE EXTENSION IF NOT EXISTS "vector";        -- pgvector (phase 6)
```

---

## Блок 1. Workspaces, users, auth

### `workspaces`
Каждая компания/агентство = один workspace. Полная изоляция данных.

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK |
| name | text | NOT NULL |
| slug | text | UNIQUE NOT NULL |
| plan | text | default 'free' CHECK (plan IN ('free','pro','enterprise')) |
| settings | jsonb | default '{}' |

### `users`
| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK |
| email | citext | UNIQUE NOT NULL |
| password_hash | text | NOT NULL (argon2) |
| first_name | text | NOT NULL |
| last_name | text | NOT NULL |
| avatar_url | text | |
| phone | text | |
| is_active | bool | default true |
| email_verified_at | timestamptz | |
| last_login_at | timestamptz | |

### `workspace_members`
Многие-ко-многим users ↔ workspaces с ролью.

| Column | Type | Constraints |
|--------|------|-------------|
| workspace_id | uuid | FK workspaces, PK |
| user_id | uuid | FK users, PK |
| role | text | CHECK (role IN ('admin','recruiter','hiring_manager','viewer','candidate')) |
| joined_at | timestamptz | default now() |

### `refresh_tokens`
| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK |
| user_id | uuid | FK users |
| token_hash | text | UNIQUE NOT NULL |
| expires_at | timestamptz | NOT NULL |
| revoked_at | timestamptz | |
| user_agent | text | |
| ip | inet | |

### `invites`
| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK |
| workspace_id | uuid | FK workspaces |
| email | citext | NOT NULL |
| role | text | NOT NULL |
| token_hash | text | UNIQUE NOT NULL |
| invited_by | uuid | FK users |
| expires_at | timestamptz | NOT NULL |
| accepted_at | timestamptz | |

---

## Блок 2. Tool tree

### `tool_categories`
Верхние категории (сейчас: Инструменты, Навыки, Стандарты, Опыт профильный, Опыт отраслевой).

| Column | Type | Constraints |
|--------|------|-------------|
| id | text | PK (человекочитаемое: 'cat_tools') |
| workspace_id | uuid | FK workspaces NULL — global if NULL |
| name | text | NOT NULL |
| icon | text | |
| sort_order | int | default 0 |

### `tool_subcategories`
| Column | Type | Constraints |
|--------|------|-------------|
| id | text | PK ('sub_javascript') |
| category_id | text | FK tool_categories |
| workspace_id | uuid | FK workspaces NULL |
| name | text | NOT NULL |
| "group" | text | nullable (внутренняя группа: "Языки разработки") |
| domain | text | CHECK (domain IN ('dev','design','analysis','qa','infosec','devops','misc')) |
| sort_order | int | default 0 |

### `tools`
| Column | Type | Constraints |
|--------|------|-------------|
| id | text | PK ('t_react') |
| subcategory_id | text | FK tool_subcategories |
| workspace_id | uuid | FK workspaces NULL |
| name | text | NOT NULL |
| logo_url | text | |
| aliases | text[] | default '{}' |

**Идея:** если `workspace_id IS NULL` — это глобальный справочник (bundled seed). Если workspace_id заполнен — это кастомизация конкретного тенанта (они видят и свои, и глобальные).

---

## Блок 3. Positions, vacancies, candidates

### `positions` (шаблон должности)
| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK |
| workspace_id | uuid | FK workspaces NOT NULL |
| name | text | NOT NULL |
| category | text | CHECK (category IN ('developer','qa','analyst','devops','designer','manager','data')) |
| subcategory | text | |
| icon | text | |
| grades | text[] | NOT NULL (intern, junior, middle, senior, lead, principal, staff) |
| description | text | |

### `position_required_categories`
Связка позиции с подкатегориями tool-tree.

| Column | Type | Constraints |
|--------|------|-------------|
| position_id | uuid | FK positions, PK |
| subcategory_id | text | FK tool_subcategories, PK |
| min_years | numeric(4,1) | |

### `vacancies`
| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK |
| workspace_id | uuid | FK workspaces NOT NULL |
| position_id | uuid | FK positions |
| company_name | text | NOT NULL |
| company_logo_url | text | |
| grade | text | NOT NULL |
| salary_from | int | |
| salary_to | int | |
| currency | text | CHECK (currency IN ('RUB','USD','EUR','KZT')) |
| published_at | timestamptz | NOT NULL |
| closed_at | timestamptz | |
| status | text | CHECK (status IN ('open','closed','offer_made','hired')) default 'open' |
| source_url | text | |
| location | text | |
| work_format | text | CHECK (work_format IN ('office','remote','hybrid')) |
| employment_type | text | CHECK (employment_type IN ('full','part','contract','freelance')) |
| notes | text | |
| search_tsv | tsvector | GENERATED (из company_name, notes, position.name) |

### `vacancy_requirements`
Нормализуем MIN и MAX в одной таблице с enum'ом.

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK |
| vacancy_id | uuid | FK vacancies |
| tool_id | text | FK tools |
| level | text | CHECK (level IN ('min','max')) NOT NULL |
| min_years | numeric(4,1) | |
| is_locked | bool | default false |

UNIQUE (`vacancy_id`, `tool_id`, `level`).

### `candidates`
| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK |
| workspace_id | uuid | FK workspaces NOT NULL |
| user_id | uuid | FK users NULL (если кандидат зарегистрирован) |
| first_name | text | NOT NULL |
| last_name | text | NOT NULL |
| middle_name | text | |
| photo_url | text | |
| email | citext | |
| phone | text | |
| telegram_handle | text | |
| linkedin_url | text | |
| city | text | |
| country | text | |
| citizenship | text | |
| position_id | uuid | FK positions |
| work_format | text | CHECK (work_format IN ('office','remote','hybrid','any')) |
| relocate | bool | default false |
| salary_expected | int | |
| currency | text | |
| notes | text | |
| embedding | vector(384) | NULL (phase 6) |
| search_tsv | tsvector | GENERATED |

### `work_entries`
| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK |
| candidate_id | uuid | FK candidates |
| company_name | text | NOT NULL |
| company_logo_url | text | |
| position_id | uuid | FK positions |
| grade | text | NOT NULL |
| start_date | date | NOT NULL |
| end_date | date | |
| is_current | bool | default false |
| salary | int | |
| currency | text | |
| responsibilities | text | |
| embedding | vector(384) | NULL (phase 6) |

### `work_entry_tools`
| Column | Type | Constraints |
|--------|------|-------------|
| work_entry_id | uuid | FK work_entries, PK |
| tool_id | text | FK tools, PK |
| years | numeric(4,1) | NOT NULL |

---

## Блок 4. Pipeline (Kanban)

### `pipelines`
| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK |
| vacancy_id | uuid | FK vacancies UNIQUE |

### `pipeline_stages`
| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK |
| pipeline_id | uuid | FK pipelines |
| name | text | NOT NULL |
| sort_order | int | NOT NULL |
| color | text | |

### `pipeline_cards`
| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK |
| pipeline_id | uuid | FK pipelines |
| stage_id | uuid | FK pipeline_stages |
| candidate_id | uuid | FK candidates |
| match_score | numeric(5,2) | |
| sort_order | int | NOT NULL |
| added_at | timestamptz | default now() |
| moved_at | timestamptz | default now() |
| notes | text | |

UNIQUE (`pipeline_id`, `candidate_id`).

---

## Блок 5. Response timeline, tasks

### `response_events`
| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK |
| workspace_id | uuid | FK workspaces |
| vacancy_id | uuid | FK vacancies |
| candidate_id | uuid | FK candidates |
| type | text | CHECK (type IN (14 enum-значений из прототипа)) |
| comment | text | |
| author_id | uuid | FK users |
| scheduled_at | timestamptz | |

### `recruitment_tasks`
| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK |
| workspace_id | uuid | FK workspaces |
| title | text | NOT NULL |
| description | text | |
| vacancy_id | uuid | FK vacancies |
| candidate_id | uuid | FK candidates |
| assignee_id | uuid | FK users |
| status | text | CHECK (status IN ('pending','in_progress','done','cancelled')) |
| due_date | timestamptz | NOT NULL |

---

## Блок 6. Матчинг

### `match_scores` (денормализованный кэш)
| Column | Type | Constraints |
|--------|------|-------------|
| vacancy_id | uuid | FK vacancies, PK |
| candidate_id | uuid | FK candidates, PK |
| score_min | numeric(5,2) | NOT NULL |
| score_max | numeric(5,2) | NOT NULL |
| matched | jsonb | NOT NULL (массив {toolId, required, actual}) |
| gaps | jsonb | NOT NULL |
| extras | jsonb | NOT NULL |
| computed_at | timestamptz | default now() |

Индексы:
```sql
CREATE INDEX idx_match_scores_vacancy_score
  ON match_scores(vacancy_id, score_min DESC);
CREATE INDEX idx_match_scores_candidate
  ON match_scores(candidate_id, score_min DESC);
```

Обновление: listener на изменения в `vacancy_requirements` / `work_entry_tools` через LISTEN/NOTIFY → Celery job пересчитывает пары.

---

## Блок 7. Audit, notifications, comments

### `audit_events`
| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK |
| workspace_id | uuid | FK workspaces |
| actor_id | uuid | FK users |
| action | text | NOT NULL ('vacancy.create', 'candidate.update' etc.) |
| entity_type | text | |
| entity_id | uuid | |
| before | jsonb | |
| after | jsonb | |
| ip | inet | |
| user_agent | text | |

Партицирование по месяцам (`PARTITION BY RANGE (created_at)`) — таблица будет расти.

### `notifications`
| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK |
| user_id | uuid | FK users |
| workspace_id | uuid | FK workspaces |
| type | text | |
| title | text | |
| body | text | |
| entity_type | text | |
| entity_id | uuid | |
| read_at | timestamptz | |

### `comments`
| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK |
| workspace_id | uuid | FK workspaces |
| entity_type | text | CHECK (entity_type IN ('vacancy','candidate','task')) |
| entity_id | uuid | NOT NULL |
| author_id | uuid | FK users |
| body | text | NOT NULL |
| mentions | uuid[] | default '{}' (user ids) |

### `saved_filters`
| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK |
| user_id | uuid | FK users |
| workspace_id | uuid | FK workspaces |
| name | text | NOT NULL |
| entity_type | text | CHECK (entity_type IN ('vacancy','candidate')) |
| filter | jsonb | NOT NULL |
| is_shared | bool | default false |

---

## Блок 8. Интеграции (phase 7)

### `integrations`
| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK |
| workspace_id | uuid | FK workspaces |
| type | text | CHECK (type IN ('hh','linkedin','telegram','gcal','outlook')) |
| config | jsonb | зашифровано |
| is_active | bool | default true |
| last_sync_at | timestamptz | |

### `webhooks`
| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK |
| workspace_id | uuid | FK workspaces |
| url | text | NOT NULL |
| events | text[] | NOT NULL |
| secret | text | NOT NULL |
| is_active | bool | default true |

---

## Row-Level Security (multitenant)

```sql
-- для каждой таблицы с workspace_id
ALTER TABLE vacancies ENABLE ROW LEVEL SECURITY;

CREATE POLICY vacancies_isolation ON vacancies
  USING (workspace_id = current_setting('app.current_workspace_id')::uuid);

CREATE POLICY vacancies_insert ON vacancies FOR INSERT
  WITH CHECK (workspace_id = current_setting('app.current_workspace_id')::uuid);
```

В FastAPI dependency:
```python
@asynccontextmanager
async def tenant_scope(session: AsyncSession, workspace_id: UUID):
    await session.execute(text("SET LOCAL app.current_workspace_id = :ws"),
                          {"ws": str(workspace_id)})
    yield
```

---

## Триггеры

### `updated_at` auto-update
```sql
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_vacancies_updated
  BEFORE UPDATE ON vacancies
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

### Pipeline notify
```sql
CREATE OR REPLACE FUNCTION notify_pipeline_change() RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify(
    'pipeline:' || NEW.pipeline_id::text,
    jsonb_build_object('op', TG_OP, 'card_id', NEW.id, 'stage_id', NEW.stage_id)::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_pipeline_cards_notify
  AFTER INSERT OR UPDATE OR DELETE ON pipeline_cards
  FOR EACH ROW EXECUTE FUNCTION notify_pipeline_change();
```

### Match invalidation
```sql
CREATE OR REPLACE FUNCTION invalidate_matches() RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify('match_invalidate',
    jsonb_build_object(
      'table', TG_TABLE_NAME,
      'row_id', COALESCE(NEW.id, OLD.id)
    )::text);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_vacancy_reqs_invalidate
  AFTER INSERT OR UPDATE OR DELETE ON vacancy_requirements
  FOR EACH ROW EXECUTE FUNCTION invalidate_matches();
```

Воркер подписан на `match_invalidate` → пересчёт.

---

## Partitioning strategy

- `audit_events` — по месяцам, автоматическое создание через `pg_partman`
- `response_events` — по годам (событий меньше, но долгоживущие)
- `match_scores` — **не** партицируется (активное чтение по vacancy_id/candidate_id)

---

## Миграции

Все миграции — Alembic, с правилами:
1. **Никаких `op.drop_*`** в одной миграции с переездом данных. Двухфазный деплой: deprecate → migrate → drop.
2. Новые индексы — `CREATE INDEX CONCURRENTLY` (не блокирует таблицу).
3. Каждая миграция тестируется на снимке prod-данных (dev-копия).
4. `downgrade()` должен быть рабочим (хотя бы для последних 5 миграций).

---

## Seed data

При первом запуске:
- 5 глобальных tool_categories
- ~35 tool_subcategories (из `toolTree.json`)
- ~400 tools
- Demo-workspace с 1 admin-пользователем (для smoke-тестов только в dev)

В prod — **только глобальные справочники**. Никаких демо-кандидатов.
