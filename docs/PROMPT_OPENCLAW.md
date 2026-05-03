# PROMPT_OPENCLAW.md — виртуальный ассистент

Спецификация подсистемы виртуального ассистента на базе **OpenClaw** (open-source agent gateway) + **DeepSeek** (LLM-мозг).

OpenClaw здесь — **диспетчер и интегратор**, не парсер. Бизнес-логика, дедуп, матчинг, онтология — это backend Recruit. OpenClaw умеет: читать каналы, классифицировать, выбирать промпт, отправлять в DeepSeek, складывать результат через REST в Recruit, общаться с рекрутером в чате.

---

## 1. Граница ответственности

| Что делает OpenClaw | Что делает Recruit-API | Что делает DeepSeek |
|---|---|---|
| Watcher Telegram-каналов | Хранит канон, маски, shadow registry | Classify post (vacancy/resume/...) |
| Идемпотентный pull новых сообщений | Дедуп по `(source, external_id)` | Extract structure из текста |
| Выбор промпта по типу контента | Резолв `tool_id` по алиасам | Consolidate shadow registry (Pro) |
| Запрос маски за конкретной ролью | Хранит inbox, leads, vacancies, candidates | Sanitize PII (опционально) |
| Маршрутизация результата | Источник истины для матчинга | Проф-консультации в Phase 4 |
| Discover новых каналов | Health checks API | — |
| Чат-интерфейс ассистента | Хранит conversation history | — |

**Главное правило:** OpenClaw **не имеет direct DB access**. Только через REST API с rate limit.

---

## 2. Где OpenClaw НЕ должен быть

Аки-список того, что хочется ему делегировать, но **нельзя**:

| Что | Почему нет | Куда |
|---|---|---|
| Match score кандидат×вакансия | Это бизнес-логика, версионируется отдельно | `app/services/matching.py` |
| Дедуп вакансий | Требует доступа ко всей БД | `IngestService` в backend |
| Скоринг кандидатов | Это часть матчинга | backend |
| Прямое изменение tool tree | Только через shadow registry с подтверждением человеком | UI рекрутера через `/api/v1/shadow-registry/*` |
| Ответы пользователям бота | Бот сам — отдельный handler в backend | `apps/backend/app/bots/` |
| Хранение паролей / API keys для всех окружений | Секреты живут в secrets manager | vault / env |
| Outreach по найденным лидам | Только после явного согласия рекрутера | UI «отправить лид» (Phase 4) |

---

## 3. Архитектура

```
                 ┌──────────────────────────────────────────┐
                 │            OpenClaw Gateway              │
                 │  (Docker, локально или на VPS рекрутера) │
                 │                                          │
                 │  ┌────────────┐  ┌────────────────────┐ │
                 │  │  Skills    │  │  Local SQLite       │ │
                 │  │            │  │  (idempotency,      │ │
                 │  │  watch_*   │  │   last_msg_id,      │ │
                 │  │  classify_*│  │   skill prompts)    │ │
                 │  │  extract_* │  └────────────────────┘ │
                 │  │  discover_*│                          │
                 │  │  consol_*  │  ┌────────────────────┐ │
                 │  │  serve_*   │  │  Outbound clients   │ │
                 │  └────────────┘  │  • DeepSeek API     │ │
                 │                  │  • Recruit API      │ │
                 │                  │  • telethon (MTProto)│ │
                 │                  └────────────────────┘ │
                 └──────────────────────────────────────────┘
                          │             │             │
                          ▼             ▼             ▼
                    DeepSeek API   Recruit API   telegram MTProto
                    (V4 Flash/Pro) (REST + key)   (channel reads)
```

**Окружение:**

```bash
# .env для OpenClaw контейнера
OPENCLAW_HOME=/var/lib/openclaw
OPENCLAW_SQLITE_PATH=/var/lib/openclaw/state.sqlite

# DeepSeek
DEEPSEEK_API_KEY=sk-...
DEEPSEEK_MODEL_FLASH=deepseek-v4-flash
DEEPSEEK_MODEL_PRO=deepseek-v4-pro
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1

# Recruit API
RECRUIT_API_BASE=https://recruit.example.com/api/v1
RECRUIT_API_KEY=ock_...                 # выдан рекрутером в /admin/api-keys
RECRUIT_WORKSPACE_ID=ws_abc123

# Telegram MTProto
TG_API_ID=12345                          # с my.telegram.org
TG_API_HASH=abcdef0123...
TG_SESSION_PATH=/var/lib/openclaw/tg.session
TG_PHONE=+71234567890                    # для первичной авторизации

# Operational
WATCH_INTERVAL_SEC=300                   # частота опроса каналов
MAX_BATCH_SIZE=50                        # сколько сообщений за раз
DAILY_CONSOLIDATE_AT=03:00               # время суточной агрегации shadow registry
```

---

## 4. Каталог скиллов

### 4.1 `watch_telegram_channels`

**Триггер:** cron каждые `WATCH_INTERVAL_SEC` секунд.

**Логика:**

```python
async def watch_telegram_channels():
    channels = await recruit_api.get('/telegram/channels?is_active=true')
    for ch in channels:
        last_seen = sqlite.get_last_message_id(ch['handle'])
        new_msgs = await tg_client.iter_messages(
            entity=ch['handle'],
            min_id=last_seen,
            limit=MAX_BATCH_SIZE,
        )
        for msg in new_msgs:
            if msg.text and len(msg.text) > 100:
                await recruit_api.post('/ingest/inbox', {
                    'source': 'telegram',
                    'channel_handle': ch['handle'],
                    'external_id': str(msg.id),
                    'raw_text': msg.text,
                    'raw_html': msg.message,  # с разметкой
                    'received_at': msg.date.isoformat(),
                })
            sqlite.set_last_message_id(ch['handle'], msg.id)
        await sleep(0.5)  # rate limit к MTProto
```

**Idempotency:** `(channel_handle, external_id)` уникален в Recruit. Двойная отправка → 409 → пропуск.

**Backoff:** при `FloodWaitError` от Telegram — пауза по `wait_seconds` из ошибки.

---

### 4.2 `classify_post`

**Триггер:** webhook из Recruit (или периодический pull) — «новые `inbox_items` с `status='raw'`».

**Логика:**

```python
async def classify_post(inbox_item):
    prompt = load_prompt('classify_post.md')  # см. §6.1
    result = await deepseek_chat(
        model=DEEPSEEK_MODEL_FLASH,
        messages=[
            {'role': 'system', 'content': prompt},
            {'role': 'user', 'content': inbox_item['raw_text']},
        ],
        response_format={'type': 'json_object'},
        temperature=0.0,
    )
    parsed = json.loads(result)

    await recruit_api.patch(f"/inbox/{inbox_item['id']}", {
        'classified_as': parsed['kind'],
        'classified_role': parsed.get('role'),
        'classification_confidence': parsed['confidence'],
        'status': 'classified',
    })
```

**Возможные значения `kind`:**

```
vacancy            → запускает extract_vacancy
resume             → запускает extract_candidate
project_post       → перекладывается в lead_items как project
team_search        → лиды как team_search
roast_request      → лиды как roast_request
career_advice      → лиды как career_advice
other              → status='skipped', не идёт дальше
```

**Acceptance:** на размеченной выборке 200 постов из IT-каналов точность классификации ≥ 0.9.

---

### 4.3 `extract_vacancy`

**Триггер:** новые `inbox_items` со `status='classified'` и `classified_as='vacancy'`.

**Логика:**

```python
async def extract_vacancy(inbox_item):
    role = inbox_item['classified_role']
    mask = await recruit_api.get(f"/masks/{role}")  # mini dictionary

    prompt_template = load_prompt('extract_vacancy.md')
    system_prompt = prompt_template.format(
        position_id=mask['position_id'],
        canonical_skills=json.dumps(mask['canonical_skills']),
        anti_dictionary=json.dumps(mask['anti_dictionary']),
    )

    result = await deepseek_chat(
        model=DEEPSEEK_MODEL_FLASH,
        messages=[
            {'role': 'system', 'content': system_prompt, 'cache_control': {'type': 'ephemeral'}},
            {'role': 'user', 'content': inbox_item['raw_text']},
        ],
        response_format={'type': 'json_object'},
        temperature=0.1,
    )
    normalized = json.loads(result)

    await recruit_api.post('/ingest/vacancy', {
        'inbox_item_id': inbox_item['id'],
        'normalized': normalized,
        'extraction_meta': {
            'source': 'telegram',
            'extracted_at': now_iso(),
            'extraction_model': DEEPSEEK_MODEL_FLASH,
            'mask_version': mask['version'],
            'ontology_version': mask['ontology_version'],
            'extraction_quality': normalized.get('_confidence'),
        },
    })
```

**Batching:** скилл накапливает inbox-items одной роли (по `classified_role`) и шлёт в DeepSeek **батчем** до 20 штук с одним системным промптом — это активирует prompt caching (~90% экономия).

**Pseudo-batched call:**

```python
# Накопили 20 backend-вакансий
batch_text = '\n\n---POST_SEPARATOR---\n\n'.join(item['raw_text'] for item in batch)
# Просим вернуть массив
result = await deepseek_chat(
    messages=[
        {'role': 'system', 'content': system_prompt + '\nVerified: return JSON array of NormalizedVacancy.'},
        {'role': 'user', 'content': batch_text},
    ],
    ...
)
```

---

### 4.4 `extract_candidate`

Аналогично `extract_vacancy`, но для резюме. Промпт другой (см. §6.3).

Дополнительно:

- Если `inbox_item['source'] == 'bot_dm'` → это резюме от пользователя через бота. Создаётся `Candidate` со ссылкой `inbox_item.imported_id = candidate.id`.
- Если из Telegram-канала → создаётся `Candidate` со `source='telegram'`, без контактов (контакты только если автор поста явно их указал; в любом случае помечается как `outreach_status='untouched'`).

---

### 4.5 `discover_channels`

**Триггер:** weekly cron.

**Логика:**

```python
async def discover_channels():
    # Сбор кандидатов:
    # 1. Каналы, упомянутые в forward'ах из подписанных каналов
    # 2. Каналы из @-mentions в сообщениях
    # 3. Telegram search по ключевым словам ['вакансии', 'разработчик', 'IT работа']
    
    candidates = await collect_channel_candidates()
    
    # Для каждого кандидата — sample 10 последних сообщений и просим DeepSeek оценить
    for ch in candidates:
        sample = await tg_client.iter_messages(ch, limit=10)
        prompt = load_prompt('classify_channel.md')
        result = await deepseek_chat(...)
        # Возвращает: { kind: 'vacancies'|'resumes'|'mixed'|'projects'|'noise', quality: 0..1 }
        if result['quality'] >= 0.6:
            await recruit_api.post('/telegram/channels/proposed', {
                'handle': ch.username,
                'title': ch.title,
                'discovered_via': 'crawl',
                'expected_kind': result['kind'],
                'quality_score': result['quality'],
                'sample_post_ids': [m.id for m in sample],
            })
```

В UI рекрутера в `/admin/channels` появляется блок «Предлагаемые» с кнопками «принять / отклонить».

---

### 4.6 `consolidate_shadow_registry`

**Триггер:** daily cron в `DAILY_CONSOLIDATE_AT`.

**Логика:**

```python
async def consolidate_shadow_registry():
    incubating = await recruit_api.get('/shadow-registry?status=incubating')
    if len(incubating) < 10:
        return  # мало данных

    prompt = load_prompt('consolidate_shadow_registry.md')
    chunks = chunk(incubating, 30)  # 30 терминов за раз
    
    for batch in chunks:
        result = await deepseek_chat(
            model=DEEPSEEK_MODEL_PRO,  # тут нужна Pro — кластеризация
            messages=[
                {'role': 'system', 'content': prompt},
                {'role': 'user', 'content': json.dumps(batch)},
            ],
            response_format={'type': 'json_object'},
        )
        decisions = json.loads(result)
        # Decisions format:
        # [
        #   { "term": "langchain", "action": "promote", "subcategory_id": "sub_ml_libs", "confidence": 0.85,
        #     "reason": "Растущая библиотека LLM-оркестрации, тесно связана с Python AI стеком" },
        #   { "term": "next.js 15", "action": "merge", "merge_into": "tool_nextjs", "confidence": 0.95,
        #     "reason": "Версионный синоним существующего инструмента Next.js" },
        #   { "term": "yapper",    "action": "ignore", "confidence": 0.4,
        #     "reason": "Низкая частота, неясный контекст" },
        # ]
        await recruit_api.post('/shadow-registry/consolidated', {'decisions': decisions})
```

**Что ассистент делает:** только **предлагает** обновления. Recruit-API переводит запись в `status='proposed'` и ждёт человека.

---

### 4.7 `serve_assistant_chat` (Phase 4)

**Триггер:** webhook от Recruit-API → пользователь написал сообщение в чат ассистента.

**Логика:**

```python
async def serve_assistant_chat(message, conversation_id):
    history = await recruit_api.get(f'/assistant/conversations/{conversation_id}')
    
    # Детектим intent
    intent = await classify_intent(message['text'])
    # 'find_candidates' | 'find_vacancies' | 'analyze_position' | 'rebuild_mask' | 'general'
    
    if intent == 'find_candidates':
        # Извлекаем критерии (роль, грейд, локация, скиллы)
        criteria = await deepseek_extract_criteria(message['text'])
        # Вызываем Recruit search API
        candidates = await recruit_api.post('/search/candidates', criteria)
        # Форматируем ответ
        response = format_candidates_response(candidates)
    elif intent == 'analyze_position':
        # Запросить аналитику по позиции
        ...
    
    await recruit_api.post(f'/assistant/conversations/{conversation_id}/messages', {
        'role': 'assistant',
        'content': response,
        'intent': intent,
        'tool_calls': [...],  # если делали API-вызовы
    })
```

В Phase 4 — это полноценный agentic flow: ассистент может делать несколько шагов, переспрашивать, показывать промежуточные результаты.

---

## 5. Recruit-API контракты для OpenClaw

Все эндпоинты, которые нужны OpenClaw'у. Auth: `X-Recruit-Api-Key: <key>`.

### 5.1 Inbox

```http
POST /api/v1/ingest/inbox
{
  "source": "telegram",
  "channel_handle": "@some_dev_jobs",
  "external_id": "12345",
  "raw_text": "...",
  "raw_html": null,
  "received_at": "2026-05-03T12:34:56Z"
}
→ 201 { "id": "inbox_uuid", "status": "raw" }
→ 409 { "error": "duplicate", "existing_id": "inbox_uuid" }

PATCH /api/v1/inbox/{id}
{
  "classified_as": "vacancy",
  "classified_role": "pos_backend",
  "classification_confidence": 0.92,
  "status": "classified"
}
→ 200 { "id": "inbox_uuid", ... }

GET /api/v1/inbox?status=raw&limit=50
→ 200 { "items": [...], "total": 120 }
```

### 5.2 Ingest converted

```http
POST /api/v1/ingest/vacancy
{
  "inbox_item_id": "inbox_uuid",
  "normalized": { /* NormalizedVacancy */ },
  "extraction_meta": { ... }
}
→ 201 { "id": "vacancy_uuid", "warnings": ["unmapped: 'flux'", ...] }
  (warnings автоматически попадают в shadow_registry_entries)

POST /api/v1/ingest/candidate
(аналогично)
```

### 5.3 Masks

```http
GET /api/v1/masks/{position_id}
X-Recruit-Api-Key: ock_...
→ 200 {
  "position_id": "pos_backend",
  "version": "pos_backend@1.3",
  "ontology_version": "tooltree@2.1",
  "canonical_skills": { ... },
  "anti_dictionary": [...],
  "preferred_grades": ["middle", "senior"],
  "domain_hints": { ... }
}
```

### 5.4 Shadow registry

```http
POST /api/v1/shadow-registry/proposed
{
  "term": "langchain",
  "from_role_id": "pos_backend",
  "context_snippet": "Опыт с langchain и LLM-оркестрацией обязателен"
}
→ 201 { "id": "sr_uuid", "frequency": 1, "status": "incubating" }
→ 200 { "id": "sr_uuid", "frequency": 12, "status": "incubating" }  // если уже был — frequency++

GET /api/v1/shadow-registry?status=incubating&limit=100
→ 200 { "items": [...] }

POST /api/v1/shadow-registry/consolidated
{
  "decisions": [ /* см. §4.6 */ ]
}
→ 200 { "applied": 28, "errors": [] }
```

### 5.5 Telegram channels

```http
GET /api/v1/telegram/channels?is_active=true
→ 200 [ { "id": "uuid", "handle": "@...", "expected_kind": "vacancies", ... } ]

POST /api/v1/telegram/channels/proposed
{
  "handle": "@new_channel",
  "title": "Some IT Jobs",
  "discovered_via": "crawl",
  "expected_kind": "vacancies",
  "quality_score": 0.78,
  "sample_post_ids": [...]
}
→ 201 { "id": "uuid", "status": "pending_review" }
```

---

## 6. Системные промпты (хранятся в `apps/openclaw/prompts/`)

### 6.1 `classify_post.md`

```
Ты классифицируешь IT-пост из Telegram-канала.

Возможные категории:
  vacancy        — описание открытой вакансии в IT
  resume         — представление специалиста, ищущего работу
  project_post   — описание проекта (без явного найма; обсуждение задач, поиск партнёров)
  team_search    — поиск тиммейтов в команду / стартап
  roast_request  — просьба «прожарить резюме»
  career_advice  — вопрос о профориентации / выборе технологий
  other          — всё остальное (новости, мемы, обсуждения, реклама курсов)

Также определи `role` (если применимо): pos_backend, pos_frontend, pos_devops, pos_qa_auto, pos_data_analyst, pos_pm, pos_designer, pos_other.

Для категорий `vacancy` и `resume` `role` обязателен.
Для остальных категорий `role` опционален (если упоминается).

Верни СТРОГО JSON:
{
  "kind": "<one of categories>",
  "role": "<position_id or null>",
  "confidence": 0..1
}

Без пояснений. Никакого текста кроме JSON.
```

### 6.2 `extract_vacancy.md`

```
Ты извлекаешь данные ИТ-вакансии в JSON-структуру для роли «{position_id}».

Используй ТОЛЬКО следующий справочник навыков (canonical skills):
{canonical_skills}

Если в тексте упоминается технология, которой НЕТ в справочнике — добавь её в массив `_unmapped` с цитатой контекста, но НЕ ВКЛЮЧАЙ в `min_requirements` или `max_requirements`.

Анти-словарь — навыки, которые НЕ должны попадать в эту роль:
{anti_dictionary}

Если в тексте присутствует навык из анти-словаря — это сильный сигнал, что текст НЕ относится к этой роли. Верни {{"_misclassified": true}}.

Извлекай:
- title             — оригинальный заголовок вакансии
- company_name      — название компании
- grade             — junior | middle | senior | lead | principal | staff
- salary_from, salary_to, currency, salary_period, salary_gross
- location, address (страна, город)
- work_format       — office | remote | hybrid
- employment_type   — full | part | contract | freelance
- min_requirements  — массив { tool_id, min_years? }
- max_requirements  — массив { tool_id, min_years? } (расширенные требования)
- responsibilities  — массив строк (3-7 пунктов)
- qualifications    — массив строк (не-инструментальные требования: образование, языки)
- benefits          — массив строк
- industry          — fintech | ecommerce | gamedev | edtech | healthtech | b2b_saas | other
- _unmapped         — массив { term, context_snippet }
- _confidence       — твой оценочный confidence 0..1

Верни СТРОГО JSON по этой схеме. Никакого текста кроме JSON.
```

### 6.3 `extract_candidate.md`

(Аналогично `extract_vacancy.md`, но для резюме: добавляет `headline`, `summary`, `education[]`, `certifications[]`, `languages[]`, `work_history[]` с tools.)

### 6.4 `consolidate_shadow_registry.md`

```
Тебе дан список новых терминов, которые встречаются в реальных IT-вакансиях / резюме, но отсутствуют в нашей онтологии.

Для каждого предложи действие:
  promote      — добавить как новый инструмент в подкатегорию (укажи subcategory_id)
  merge        — это синоним / версия существующего инструмента (укажи tool_id)
  ignore       — шум, не добавлять
  defer        — недостаточно данных, подождать ещё месяц

Учитывай:
- частоту (frequency)
- роли, в которых встречается (sample_role_ids)
- примеры контекста (sample_examples)

Верни массив решений в JSON.

Принципы:
- Новый инструмент в канон → minimum frequency >= 20 OR pct_of_role >= 1%
- Если term — версия существующего (next.js 15 vs next.js) → merge
- Если term — общее понятие без специфики (например "ml") → ignore (мы канонизируем конкретные инструменты)
- При сомнении → defer
```

### 6.5 `classify_channel.md`

```
Тебе дано до 10 последних сообщений из Telegram-канала.

Оцени:
  kind     — vacancies | resumes | mixed | projects | noise
  quality  — 0..1, насколько канал релевантен для harvesting'а IT-вакансий и резюме

Quality 0.0 = новости / мемы / реклама.
Quality 1.0 = чистый канал с структурированными вакансиями или резюме.

Верни JSON: {"kind": "...", "quality": 0..1, "reason": "..."}
```

---

## 7. Idempotency и observability

### 7.1 Локальный SQLite

```sql
CREATE TABLE telegram_processed (
    channel_handle  TEXT NOT NULL,
    last_message_id BIGINT NOT NULL,
    updated_at      TEXT NOT NULL,
    PRIMARY KEY (channel_handle)
);

CREATE TABLE skill_runs (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    skill_name      TEXT NOT NULL,
    started_at      TEXT NOT NULL,
    finished_at     TEXT,
    status          TEXT NOT NULL,        -- 'running' | 'success' | 'fail' | 'retry'
    items_processed INT,
    error_text      TEXT
);
CREATE INDEX idx_skill_runs_started ON skill_runs (started_at DESC);

CREATE TABLE deepseek_calls (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    skill_name      TEXT,
    model           TEXT,
    tokens_in       INT,
    tokens_out      INT,
    cached_tokens   INT,
    cost_usd        NUMERIC(10,6),
    duration_ms     INT,
    success         BOOLEAN,
    called_at       TEXT NOT NULL
);
```

### 7.2 Логи

Все логи — JSON в stdout, агрегируются в Loki (или просто в файл при single-host).

Минимальные поля:

```json
{
  "ts": "2026-05-03T12:34:56Z",
  "level": "info",
  "skill": "extract_vacancy",
  "inbox_item_id": "uuid",
  "model": "deepseek-v4-flash",
  "tokens_in": 850,
  "tokens_out": 420,
  "cached_tokens": 720,
  "duration_ms": 1240,
  "success": true
}
```

### 7.3 Health endpoint

```http
GET /health
→ 200 {
  "skills": {
    "watch_telegram_channels": { "last_run": "...", "status": "success" },
    "classify_post": { "last_run": "...", "status": "success" },
    ...
  },
  "recruit_api": "reachable",
  "deepseek_api": "reachable",
  "telegram_mtproto": "authorized",
  "queue_depth": 12
}
```

---

## 8. Деплой

### 8.1 Локальный (рекомендуется для MVP)

`docker-compose.openclaw.yml` на машине рекрутера:

```yaml
version: '3.9'

services:
  openclaw:
    image: openclaw/gateway:latest
    container_name: recruit-openclaw
    restart: unless-stopped
    env_file:
      - .env.openclaw
    volumes:
      - ./openclaw-data:/var/lib/openclaw
      - ./apps/openclaw/skills:/etc/openclaw/skills:ro
      - ./apps/openclaw/prompts:/etc/openclaw/prompts:ro
    ports:
      - "127.0.0.1:8765:8765"     # health endpoint
```

### 8.2 На VPS (для production)

Выделенный VM 2 vCPU / 2 GB RAM достаточно. Не требует БД (SQLite). Сетевой доступ:
- исходящие на `api.deepseek.com` (HTTPS)
- исходящие на `<recruit-api>.com/api/v1/*` (HTTPS)
- исходящие на Telegram MTProto (TCP 443/80)
- входящие — только если включён health check от внешнего monitoring

### 8.3 Первичная настройка Telegram MTProto

```bash
docker exec -it recruit-openclaw openclaw skills setup_telegram \
  --api-id 12345 \
  --api-hash abcdef0123 \
  --phone +71234567890
# Запросит код из Telegram, потом 2FA пароль если включён
# Сохранит сессию в /var/lib/openclaw/tg.session
```

После этой команды можно подписываться на каналы:

```bash
docker exec -it recruit-openclaw openclaw skills subscribe_channel @some_dev_jobs
```

---

## 9. Стоимость

При 2000 вакансий + 200 резюме в день, с использованием prompt caching и батчинга:

| Подсчёт | Tokens (input) | Tokens (output) | Cost USD/day |
|---|---|---|---|
| `classify_post` (Flash) | ~500 × 2200 = 1.1M | ~50 × 2200 = 0.11M | $0.30 |
| `extract_vacancy` (Flash, batched 20) | ~12k × 110 батчей (с cache: 80% hit) = ~330k effective | ~3k × 110 = 0.33M | $0.50 |
| `extract_candidate` (Flash, batched) | ~30k effective | ~50k | $0.10 |
| `consolidate_shadow_registry` (Pro, daily) | ~100k | ~30k | $0.20 |
| `discover_channels` (weekly) | ~200k | ~30k | $0.05 |
| **Итого** | | | **~$1.20 / день** ≈ **$36 / мес** |

(оценки приближённые, на DeepSeek V4 Flash при $0.07/1M input non-cached, $0.014/1M cached, $0.28/1M output, и Pro в 4× дороже)

---

## 10. Acceptance criteria

### Phase 3a (OpenClaw MVP)

- [ ] OpenClaw поднят и подключён к Recruit API + DeepSeek + Telegram MTProto.
- [ ] Скилл `watch_telegram_channels` приносит 100+ inbox-items/день из 5+ подписанных каналов.
- [ ] `classify_post` обрабатывает каждый item < 10 сек, точность ≥ 0.85 на размеченной выборке 200.
- [ ] `extract_vacancy` через `mask` дёргает API, возвращает структурированный JSON, шлёт в `/ingest/vacancy`.
- [ ] Backend получает вакансии, дедупит, складывает в БД.
- [ ] В UI `/inbox` рекрутер видит классификацию и может одной кнопкой подтвердить импорт.

### Phase 3b (полный круг)

- [ ] `consolidate_shadow_registry` работает раз в сутки, в `/registry` появляются обоснованные предложения.
- [ ] `discover_channels` работает раз в неделю, в `/admin/channels` появляются предложенные каналы.
- [ ] Метрики OpenClaw попадают в health endpoint и dashboard рекрутера.

### Phase 4 (assistant chat)

- [ ] `/assistant` — функциональный чат, способный понять «найди мне backend senior с fintech опытом, удалёнка, до 400k» и вернуть топ-10.
- [ ] Conversation history сохраняется и возобновляется.

---

## 11. Анти-паттерны

- **OpenClaw напрямую в Postgres.** Только REST. Иначе теряем audit trail и нарушаем разделение слоёв.
- **Один универсальный prompt для всех ролей.** Каждая роль = свой mask. Иначе теряем prompt caching и точность.
- **Без батчинга.** При 2200 запросах/день without batching стоимость x10.
- **Применять решения shadow consolidator автоматически.** Только предлагать, рекрутер подтверждает.
- **Хранить сообщения каналов в OpenClaw localSQLite дольше суток.** Только last_message_id для idempotency. Сами сообщения — в Recruit DB.
- **Авторизовать MTProto без 2FA.** Аккаунт под угрозой угона. 2FA обязательно.
- **Запускать discover_channels чаще раза в неделю.** Telegram banit за частые поисковые запросы.
