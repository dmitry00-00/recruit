# PROMPT_TELEGRAM_BOT.md — Telegram-бот

Спецификация Telegram-бота для приёма резюме от кандидатов, выдачи дайджестов вакансий и проведения личных аналитик («где я нахожусь на рынке»).

В отличие от OpenClaw (который читает каналы через MTProto user-API), бот работает через **Bot API** (BotFather). Это значит:
- Бот общается с пользователями в личных сообщениях.
- Бот **не может** читать каналы, в которых не админ.
- Бот **не имеет** доступа к телефонам/email пользователей без явного `request_contact`.
- Ответственность за провенанс данных у пользователя — он сам присылает резюме.

---

## 1. Что бот умеет

| Команда / событие | Описание | Кто инициирует |
|---|---|---|
| `/start` | Приветствие + onboarding (выбор роли: кандидат / рекрутер / наблюдатель) | Пользователь |
| Document (PDF/DOC/DOCX) | Принимает резюме → DeepSeek extract → создаёт `Candidate` со `source='bot_dm'` | Пользователь |
| `/me` | Показывает «карточку» пользователя, что бот о нём знает | Пользователь |
| `/find <запрос>` | Поиск по последним вакансиям («backend python remote») | Пользователь |
| `/digest` | Подписка на еженедельный дайджест вакансий по ролям | Пользователь |
| `/digest off` | Отписка от дайджеста | Пользователь |
| `/analytics` | «Где я на рынке?» — анализ резюме vs распределение вакансий | Пользователь |
| `/feedback` | Свободная форма — попадает в `lead_items` | Пользователь |
| `/help` | Список команд | Пользователь |
| `/privacy` | Условия обработки данных, ссылка на удаление | Пользователь |
| `/forget` | Удалить мои данные (right to be forgotten) | Пользователь |
| Push: digest вакансий | Раз в неделю по подписке | Расписание |
| Push: горячая вакансия | Если матч ≥ 0.85 с резюме подписчика | Триггер на новую вакансию |

---

## 2. Архитектура

```
                ┌─────────────────────┐
                │  Telegram Bot API   │
                │  (BotFather token)  │
                └──────────┬──────────┘
                           │ webhook
                           ▼
           ┌───────────────────────────────┐
           │  POST /webhook/telegram/      │
           │       <bot_token>             │
           │                               │
           │  • validate secret token      │
           │  • dispatch to aiogram        │
           └────────────┬──────────────────┘
                        │
                        ▼
           ┌───────────────────────────────┐
           │  apps/backend/app/bots/       │
           │                               │
           │  routers/                     │
           │   ├── start.py                │
           │   ├── resume.py  ← document   │
           │   ├── search.py  ← /find      │
           │   ├── digest.py  ← /digest    │
           │   ├── analytics.py            │
           │   └── feedback.py             │
           │                               │
           │  middlewares/                 │
           │   ├── auth.py    (subscription)│
           │   ├── rate_limit.py           │
           │   └── logging.py              │
           └────────────┬──────────────────┘
                        │
                        ▼
              ┌──────────────────────┐
              │  Recruit Services    │
              │  • IngestService     │
              │  • SearchService     │
              │  • AnalyticsService  │
              └──────────────────────┘
```

**Решение:** бот живёт **внутри** `apps/backend` как aiogram-роутер, не отдельный сервис. Меньше движущихся частей, общая БД-сессия, общая авторизация для admin-эндпоинтов.

Альтернатива (Phase 5+): вынести в отдельный микросервис, если нагрузка вырастет до 1000+ msg/sec.

---

## 3. Регистрация бота

**Шаги:**

1. В Telegram: `@BotFather` → `/newbot` → имя `RecruitAssistant` → username `@recruit_assistant_bot`.
2. Получить token: `123456789:AABBccDD...`.
3. Сохранить в secrets manager (`TELEGRAM_BOT_TOKEN`).
4. Сгенерировать webhook secret token (random 256-bit hex).
5. Зарегистрировать webhook:
   ```bash
   curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
     -d "url=https://recruit.example.com/webhook/telegram/<TOKEN>" \
     -d "secret_token=<SECRET>" \
     -d "allowed_updates=[\"message\",\"callback_query\"]"
   ```
6. Установить команды бота:
   ```bash
   curl -X POST "https://api.telegram.org/bot<TOKEN>/setMyCommands" \
     -d 'commands=[
       {"command":"start","description":"Начать"},
       {"command":"me","description":"Что вы обо мне знаете"},
       {"command":"find","description":"Поиск вакансий"},
       {"command":"digest","description":"Подписка на дайджест"},
       {"command":"analytics","description":"Где я на рынке"},
       {"command":"feedback","description":"Обратная связь"},
       {"command":"privacy","description":"Условия обработки данных"},
       {"command":"forget","description":"Удалить мои данные"},
       {"command":"help","description":"Помощь"}
     ]'
   ```

---

## 4. Webhook endpoint

```python
# apps/backend/app/webhooks/telegram.py
from fastapi import APIRouter, Request, Header, HTTPException
from aiogram import Bot, Dispatcher
from aiogram.types import Update

router = APIRouter(prefix='/webhook/telegram')

@router.post('/{bot_token}')
async def telegram_webhook(
    bot_token: str,
    request: Request,
    x_telegram_bot_api_secret_token: str = Header(default=None),
):
    if x_telegram_bot_api_secret_token != settings.TELEGRAM_WEBHOOK_SECRET:
        raise HTTPException(status_code=401, detail='Invalid secret token')
    if bot_token != settings.TELEGRAM_BOT_TOKEN:
        raise HTTPException(status_code=404)

    body = await request.json()
    update = Update.model_validate(body)
    await dispatcher.feed_update(bot, update)
    return {'ok': True}
```

**Безопасность:** webhook secret token проверяется на каждый запрос. Без него любой может слать поддельные update'ы.

---

## 5. Схемы хранения

(Из [PROMPT_BUILD § 6](./PROMPT_BUILD.md#6-бд-схема))

```sql
CREATE TABLE telegram_subscriptions (...);
CREATE TABLE telegram_messages_log (...);
```

Дополнительно:

```sql
CREATE TABLE telegram_users (
    telegram_user_id   BIGINT PRIMARY KEY,
    telegram_handle    TEXT,
    first_name         TEXT,
    last_name          TEXT,
    language_code      TEXT,                  -- 'ru' | 'en' | ...
    candidate_id       UUID REFERENCES candidates(id) ON DELETE SET NULL,
    role               TEXT NOT NULL DEFAULT 'candidate',  -- 'candidate' | 'recruiter' | 'observer'
    pii_consent_given  BOOLEAN NOT NULL DEFAULT FALSE,
    pii_consent_at     TIMESTAMPTZ,
    forgotten          BOOLEAN NOT NULL DEFAULT FALSE,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 6. Сценарии (handlers)

### 6.1 `/start`

```python
# apps/backend/app/bots/routers/start.py
from aiogram import Router, F
from aiogram.types import Message, InlineKeyboardMarkup, InlineKeyboardButton
from aiogram.filters import CommandStart

router = Router()

WELCOME = """
Привет! Я бот **Recruit** — помогаю с поиском работы и оценкой себя на ИТ-рынке.

Выберите свою роль, чтобы я подстроился:
"""

@router.message(CommandStart())
async def handle_start(msg: Message, users: TelegramUserService):
    user = await users.upsert(msg.from_user)

    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text='Я ищу работу', callback_data='role:candidate')],
        [InlineKeyboardButton(text='Я рекрутер',   callback_data='role:recruiter')],
        [InlineKeyboardButton(text='Просто смотрю', callback_data='role:observer')],
    ])
    await msg.answer(WELCOME, reply_markup=kb, parse_mode='Markdown')
```

После выбора роли — onboarding по соответствующей ветке. Кандидату предлагается прислать резюме.

### 6.2 Приём резюме

```python
# apps/backend/app/bots/routers/resume.py
@router.message(F.document)
async def handle_resume(
    msg: Message,
    bot: Bot,
    users: TelegramUserService,
    ingest: IngestService,
):
    user = await users.get(msg.from_user.id)
    if not user.pii_consent_given:
        await msg.answer(
            'Чтобы я мог обработать резюме и предлагать вам вакансии, нужно согласие '
            'на обработку персональных данных. Прочитайте /privacy и подтвердите.'
        )
        return

    doc = msg.document
    if doc.file_size > 10 * 1024 * 1024:
        await msg.answer('Файл слишком большой (>10 MB). Сожмите и попробуйте снова.')
        return

    if not any(doc.file_name.lower().endswith(ext) for ext in ('.pdf', '.doc', '.docx', '.txt', '.md')):
        await msg.answer('Поддерживаются: PDF, DOC, DOCX, TXT, MD.')
        return

    await msg.answer('Принял, обрабатываю… ⏳')

    file_info = await bot.get_file(doc.file_id)
    raw_bytes = await bot.download_file(file_info.file_path)

    try:
        # Сохраняем как inbox_item с source='bot_dm'
        inbox_id = await ingest.create_inbox_item(
            source='bot_dm',
            external_id=doc.file_unique_id,
            raw_text=extract_text(raw_bytes, doc.mime_type),
            received_at=datetime.fromtimestamp(msg.date.timestamp()),
            telegram_user_id=msg.from_user.id,
        )

        # Запускаем classify + extract в background (через RQ или просто asyncio.create_task в Phase 1)
        candidate_id = await ingest.process_inbox_to_candidate(
            inbox_id,
            link_to_telegram_user=msg.from_user.id,
        )

        await msg.answer(
            f'✅ Резюме принято.\n\n'
            f'Найдено навыков: {candidate_id.skill_count}\n'
            f'Грейд: {candidate_id.grade}\n'
            f'Оценочная позиция: {candidate_id.position_name}\n\n'
            f'Чтобы получать дайджест вакансий — /digest.\n'
            f'Чтобы увидеть свою аналитику — /analytics.'
        )
    except ExtractionError as e:
        await msg.answer(
            f'Не удалось распознать структуру: {e}.\n'
            f'Можете прислать резюме в более простом формате?'
        )
```

**Важно:** консент на ПДн обязателен **до** обработки. Без него — отказ с предложением прочитать `/privacy`.

### 6.3 `/find`

```python
@router.message(Command('find'))
async def handle_find(
    msg: Message,
    command: CommandObject,
    search: SearchService,
):
    if not command.args:
        await msg.answer('Пример: /find backend python remote')
        return

    results = await search.vacancies_by_text(
        text=command.args,
        workspace_id=settings.PUBLIC_WORKSPACE_ID,  # публичные вакансии
        limit=10,
    )

    if not results:
        await msg.answer('Ничего не нашёл по такому запросу. Попробуйте другие слова.')
        return

    chunks = ['Топ-10 вакансий:\n']
    for i, v in enumerate(results, 1):
        salary = format_salary(v) if v.salary_from else '—'
        chunks.append(f'{i}. *{v.title}* — {v.company_name}, {salary}, {v.location}')
    chunks.append('\nЧтобы получать такие подборки автоматически — /digest.')

    await msg.answer('\n'.join(chunks), parse_mode='Markdown')
```

### 6.4 `/digest`

```python
@router.message(Command('digest'))
async def handle_digest(msg: Message, command: CommandObject, subs: SubscriptionService):
    if command.args == 'off':
        await subs.unsubscribe(msg.from_user.id)
        await msg.answer('Отписка оформлена. Чтобы вернуться — /digest.')
        return

    user = await subs.get_telegram_user(msg.from_user.id)
    if not user.candidate_id:
        await msg.answer(
            'Сначала пришлите резюме — я буду подбирать вакансии под вас.'
        )
        return

    sub = await subs.subscribe(
        telegram_user_id=msg.from_user.id,
        candidate_id=user.candidate_id,
        frequency='weekly',
    )

    await msg.answer(
        f'Подписка оформлена! 🎉\n\n'
        f'Каждое воскресенье буду присылать топ-10 вакансий по вашим скиллам.\n'
        f'Отписаться: /digest off.'
    )
```

### 6.5 `/analytics`

```python
@router.message(Command('analytics'))
async def handle_analytics(
    msg: Message,
    users: TelegramUserService,
    analytics: AnalyticsService,
):
    user = await users.get(msg.from_user.id)
    if not user.candidate_id:
        await msg.answer('Сначала пришлите резюме.')
        return

    # Используем существующий computeCareerRecommendations
    report = await analytics.career_report(user.candidate_id)

    text = f"""
*Где вы на рынке:*

📊 Ваш грейд по опыту: *{report.detected_grade}*
💰 Медианная зарплата для этого грейда в {report.role_name}: *{report.median_salary} ₽*
   Ваша ожидаемая: *{report.expected_salary} ₽* ({_salary_diff(report.expected_salary, report.median_salary)})

🛠 Ваши топ-навыки совпадают с *{report.match_pct}%* активных вакансий по этой роли.

⚠️ Чего не хватает для +1 грейда:
{_format_skill_recs(report.skill_recommendations)}

📈 Растущие технологии в вашей области (за последние 3 месяца):
{_format_trends(report.trending)}
""".strip()

    await msg.answer(text, parse_mode='Markdown')
```

### 6.6 `/feedback`

```python
@router.message(Command('feedback'))
async def handle_feedback(msg: Message, state: FSMContext):
    await state.set_state(FeedbackForm.text)
    await msg.answer(
        'Опишите, что хотели бы — прожарку резюме, совет по карьере, '
        'просто пожелание боту. Я передам нашей команде.\n'
        '/cancel — отмена.'
    )

@router.message(FeedbackForm.text, F.text)
async def handle_feedback_text(
    msg: Message,
    state: FSMContext,
    leads: LeadService,
):
    text = msg.text
    # Классификация типа лида через DeepSeek (мини-промпт)
    kind = await classify_lead(text)
    # 'roast_request' | 'career_advice' | 'project_post' | 'team_search' | 'other'

    await leads.create(
        kind=kind,
        author_telegram=msg.from_user.username,
        author_user_id=msg.from_user.id,
        snapshot_text=text,
    )

    await state.clear()
    await msg.answer(
        'Принял, спасибо! 🙌\n'
        'Если соберёмся отвечать на такие запросы — напишу в личку.'
    )
```

### 6.7 `/privacy` и `/forget`

```python
@router.message(Command('privacy'))
async def handle_privacy(msg: Message):
    await msg.answer(PRIVACY_TEXT, parse_mode='Markdown')
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text='Я согласен', callback_data='consent:yes')],
        [InlineKeyboardButton(text='Удалить мои данные', callback_data='consent:no')],
    ])
    await msg.answer('Что выбираете?', reply_markup=kb)

@router.message(Command('forget'))
async def handle_forget(msg: Message, users: TelegramUserService):
    await users.forget(msg.from_user.id)
    await msg.answer(
        'Все ваши данные удалены: контакт, резюме, история сообщений.\n'
        'Если захотите вернуться — просто напишите /start.'
    )
```

`forget()` должен:
1. `UPDATE telegram_users SET forgotten=true, telegram_handle=NULL, first_name=NULL, last_name=NULL` (сохраняем только id для предотвращения восстановления).
2. `DELETE FROM telegram_messages_log WHERE telegram_user_id = ?`.
3. `DELETE FROM telegram_subscriptions WHERE telegram_user_id = ?`.
4. Если есть привязанный `candidate_id` — анонимизировать (`firstName='[удалено]'`, контакты в null), но оставить `WorkEntry` для статистики (без идентификации).

Это compliance с GDPR / 152-ФЗ.

---

## 7. Push: дайджест вакансий

**Триггер:** cron в backend, раз в неделю в воскресенье 10:00 МСК.

```python
# apps/backend/app/workers/digest.py
async def send_weekly_digest(workspace_id: UUID):
    subs = await db.fetch_all("""
        SELECT s.*, c.id as candidate_id, c.position_id, c.alternate_position_ids
        FROM telegram_subscriptions s
        JOIN candidates c ON c.id = s.candidate_id
        WHERE s.workspace_id = :ws
          AND s.is_active = true
          AND s.digest_frequency = 'weekly'
          AND (s.last_sent_at IS NULL OR s.last_sent_at < NOW() - INTERVAL '6 days')
    """, ws=workspace_id)

    for sub in subs:
        # Поиск свежих вакансий по позиции кандидата
        roles = [sub['position_id'], *sub['alternate_position_ids']]
        vacancies = await db.fetch_all("""
            SELECT * FROM vacancies
            WHERE workspace_id = :ws
              AND status = 'open'
              AND (position_id = ANY(:roles) OR alternate_position_ids && :roles)
              AND published_at > NOW() - INTERVAL '7 days'
            ORDER BY published_at DESC
            LIMIT 20
        """, ws=workspace_id, roles=roles)

        # Матчинг каждой против кандидата
        scored = []
        for v in vacancies:
            score = await matching.score(v['id'], sub['candidate_id'])
            scored.append((v, score))
        scored.sort(key=lambda x: x[1].score_min, reverse=True)
        top10 = scored[:10]

        if not top10:
            continue

        text = format_digest(top10)
        try:
            await bot.send_message(sub['telegram_user_id'], text, parse_mode='Markdown')
            await db.execute("""
                UPDATE telegram_subscriptions SET last_sent_at = NOW() WHERE id = :id
            """, id=sub['id'])
        except TelegramForbiddenError:
            # Пользователь заблокировал бота
            await db.execute("""
                UPDATE telegram_subscriptions SET is_active = false WHERE id = :id
            """, id=sub['id'])
```

**Формат дайджеста:**

```
🔥 *Подборка вакансий за неделю* (7 свежих, 3 «горячих» с матчем 80%+)

🎯 *Match 92%* — Senior Backend Python
🏢 Тинькофф · 💰 От 350 000 ₽ · 🌍 Гибрид Москва
✅ Совпало: Python, FastAPI, PostgreSQL, Kafka, Docker
⚠️ Не хватает: Kubernetes
👉 [Открыть](https://recruit.example.com/v/uuid)

🎯 *Match 88%* — Backend Engineer
🏢 Авито · 💰 От 300 000 ₽ · 🌍 Удалёнка
✅ Совпало: Python, Django, PostgreSQL, Redis
⚠️ Не хватает: ClickHouse, Kafka
👉 [Открыть](...)

[ещё 8 вакансий]

📩 Чтобы изменить частоту: /digest
🚫 Отписка: /digest off
```

---

## 8. Push: горячая вакансия

**Триггер:** новая вакансия импортирована → если есть подписчик с матчем ≥ 0.85 → отправить **сразу**.

```python
# apps/backend/app/services/ingest.py
async def on_vacancy_imported(vacancy_id: UUID):
    # Найти кандидатов с matching ≥ 0.85
    subs = await db.fetch_all("""
        SELECT s.*, c.id as candidate_id
        FROM telegram_subscriptions s
        JOIN candidates c ON c.id = s.candidate_id
        WHERE s.is_active = true
    """)
    for sub in subs:
        score = await matching.score(vacancy_id, sub['candidate_id'])
        if score.score_min >= 0.85:
            await notify_hot_vacancy(sub, vacancy_id, score)
```

**Rate limit per user:** не более 2 «горячих» вакансий в день. Если уже отправили 2 — складывать в очередь до завтрашнего дайджеста.

---

## 9. Aiogram Middlewares

### 9.1 Auth (subscription check)

```python
class AuthMiddleware(BaseMiddleware):
    async def __call__(self, handler, event, data):
        user = await users.get(event.from_user.id)
        if user and user.forgotten:
            await event.answer('Ваши данные были удалены. /start чтобы зарегистрироваться снова.')
            return
        data['user'] = user
        return await handler(event, data)
```

### 9.2 Rate limit

```python
class RateLimitMiddleware(BaseMiddleware):
    """20 messages/min per user, sliding window."""
    LIMIT = 20
    WINDOW_SEC = 60

    async def __call__(self, handler, event, data):
        key = f'rl:{event.from_user.id}'
        count = await redis.incr(key)
        if count == 1:
            await redis.expire(key, self.WINDOW_SEC)
        if count > self.LIMIT:
            await event.answer('Слишком много сообщений. Подождите минуту.')
            return
        return await handler(event, data)
```

### 9.3 Logging

Каждое входящее сообщение и каждый исходящий ответ логируется в `telegram_messages_log`. Для GDPR — auto-purge старше 30 дней через cron.

---

## 10. Privacy и compliance

### 10.1 `PRIVACY_TEXT`

```
*Условия обработки персональных данных*

Этот бот собирает и обрабатывает следующие данные:
• Telegram ID, handle, имя — для идентификации.
• Тексты ваших сообщений и команд.
• Содержимое присланных резюме (PDF/DOC/TXT) — для извлечения навыков и подбора вакансий.
• Историю взаимодействия — для статистики и улучшения сервиса.

Что мы НЕ делаем:
• Не делимся вашими данными с работодателями без вашего явного согласия.
• Не продаём данные третьим лицам.
• Не показываем ваше резюме другим пользователям.

Хранение:
• Логи сообщений — 30 дней.
• Резюме и обработанный профиль — пока вы не запросите удаление через /forget.
• Подписка на дайджесты — пока вы не отпишетесь через /digest off.

Ваши права:
• /me — посмотреть, что мы о вас знаем.
• /forget — удалить все данные.

Контакты для вопросов: privacy@recruit.example.com
```

### 10.2 Консент

Бот **обязан** получить явный консент перед:

1. Обработкой первого резюме.
2. Передачей данных в DeepSeek (LLM-провайдер — третья сторона).
3. Подключением подписки на дайджест.

Консент сохраняется в `telegram_users.pii_consent_given=true` + `pii_consent_at`.

### 10.3 Auto-purge

```sql
-- Crontab: daily at 03:00
DELETE FROM telegram_messages_log
WHERE created_at < NOW() - INTERVAL '30 days';
```

---

## 11. Stress / scaling

| Размер | Решение |
|---|---|
| < 1k users, < 100 msg/min | aiogram polling или webhook на одном FastAPI worker — достаточно |
| 1k–10k users, < 1000 msg/min | webhook + 4 FastAPI workers, Redis для rate limit, BackgroundTasks для тяжёлой обработки |
| 10k+ users | вынести в отдельный микросервис, очередь RQ для extract, отдельный пул workers для send |
| 100k+ users | Telegram Bot API имеет лимит 30 msg/sec на исходящие — нужен rate limiter с очередью на каждого получателя |

Phase 1 — single FastAPI worker. Phase 5 — масштабирование по факту.

---

## 12. Acceptance criteria

### Phase 3a (минимальный бот)

- [ ] Бот отвечает на `/start`, `/help`, `/privacy`.
- [ ] Принимает PDF/DOC резюме до 10 MB, создаёт `Candidate` за < 30 секунд.
- [ ] Команда `/find` возвращает вакансии из публичного workspace.
- [ ] Команда `/me` показывает зарегистрированную информацию.
- [ ] Команда `/forget` корректно удаляет данные (verified ручной проверкой).

### Phase 3b (digest + analytics)

- [ ] `/digest` подписывает на еженедельную рассылку.
- [ ] Cron `send_weekly_digest` работает, шлёт топ-10 в воскресенье.
- [ ] `/analytics` возвращает осмысленный отчёт «где я на рынке».

### Phase 4 (advanced)

- [ ] Push «горячих» вакансий с матчем ≥ 0.85 работает в течение 1 часа после импорта.
- [ ] Бот переживает 1000 одновременных подписчиков без потери сообщений.
- [ ] `/feedback` создаёт `lead_items` с правильной классификацией.

---

## 13. Анти-паттерны

- **Использование long-polling в продакшене.** Webhook + secret token обязательно.
- **Хранение резюме в `telegram_messages_log` целиком.** Только `file_id` Telegram'а; контент в `inbox_items` и далее в `Candidate`.
- **Игнорирование TelegramRetryAfter / FloodWait.** Респектить, иначе бан бота.
- **Открытый webhook без secret token.** Любой может слать апдейты.
- **Принимать резюме без явного консента.** Юридический риск + UX-риск (пользователь чувствует слив).
- **Спам «горячими» вакансиями.** Лимит 2/день.
- **Telegram outreach по найденным в каналах резюме без согласия автора.** Ни в коем случае.
