# FireProM v14

---

## 18. Обновление от 28.09.2026 (вечер)

### Auto-theme по URL (коммит 9cc861d)

Тема подбирается автоматически, если пользователь не выбрал вручную:

  /bending, /cutting → blueprint (Синька)
  /kp               → paper     (Калька)
  /machine          → shopfloor (Цех)
  /ui, /history     → terminal  (Терминал)
  /                 → forge     (Горн, базовая)

Файлы:
  src/lib/theme.ts                    — THEME_FOR_PATH, themeForPath()
  src/components/theme-provider.tsx   — usePathname(), isAuto
  src/components/theme-switcher.tsx   — кнопка «Автоматически»

Логика:
  localStorage.getItem("fireprom-theme")
    null или "auto" → тема по URL
    значение        → уважаем ручной выбор
  Кнопка «Автоматически» → localStorage.removeItem + тема по URL

THEME_INIT_SCRIPT (инлайн в <head>) читает window.location.pathname —
переключение происходит до первой отрисовки, без мигания.

### Arena Design Lab (отдельный проект)

Путь: ~/arena-concepts/ (копия от arena.ai)
URL:  http://192.168.10.21:3001/ (dev-режим, запускается вручную)
Назначение: 5 концептов интерфейса для выбора темы MES-экранов.

Содержит:
  src/components/concepts/ForgeConcept.tsx        20 KB
  src/components/concepts/BlueprintConcept.tsx    17 KB
  src/components/concepts/PaperConcept.tsx        16 KB
  src/components/concepts/ShopfloorConcept.tsx    12 KB
  src/components/concepts/TerminalConcept.tsx     10 KB

Стек: Next.js 16.2.6, React 19, Drizzle, Postgres (та же app_db).
Порт: 3001. НЕ в boot-скриптах — запускать вручную:

  ssh -p 8022 u0_a304@192.168.10.21 \
    'cd ~/arena-concepts && PORT=3001 HOSTNAME=0.0.0.0 \
     nohup npx next dev --webpack > ~/arena.log 2>&1 &'

Страницы:
  /               — галерея 5 концептов
  /c/forge        — Горн
  /c/blueprint    — Синька
  /c/paper        — Калька
  /c/shopfloor    — Цех
  /c/terminal     — Терминал
  /review         — сводка + голосование
  /access         — точки доступа (Wi-Fi, NetBird, публичный)

### БД app_db — теперь 10 таблиц

FireProM v14 (5):
  clients, quotes, quote_items, bending_calculations, cutting_calculations

Arena Design Lab (5):
  concepts, votes, feedback, access_links, roadmap_items

Юзер БД: u0_a304 (НЕ postgres!)

### Roadmap от arena (приоритеты)

1. 🚀 Деплой на Amvera (Dockerfile + amvera.yml уже в репо) — от 0 ₽
2. ⚙️ Уйти с dev на Termux — СДЕЛАНО ✅
3. 🎨 Темы из одного источника — СДЕЛАНО частично (авто по URL)
4. 📄 PDF-КП серверный рендер (Калька = шаблон)
5. 🤖 Jarvis: расширить интенты
6. 🌐 NetBird — СДЕЛАНО ✅

### Известные подводные камни (обновлено)

• arena-concepts использует ту же БД app_db, что и fireprom-v14
• Drizzle в arena-concepts: drizzle.config.json содержал postgres:postgres,
  исправлено на u0_a304
• seed.ts в arena-concepts не запускается сам — экспортирует ensureSeeded(),
  вызвать через скрипт-триггер
• На Termux нет /tmp — писать в $HOME или $PREFIX/tmp

### Коммиты

  9cc861d  feat(theme): авто-привязка темы к модулю
  4c56e0c  feat(cutting): импорт DXF
  57d8ca8  feat(cutting): модуль «Резка металла»
  a4adfb6  docs: PROJECT_STATE.md + scripts/backup.sh
  d5c518f  feat(clients): GET + PATCH
  bd209f5  fix(jarvis): валидация снапшота

---

## 19. Обновление от 06.10.2026 — MES (коммит 95a795f)

### Операторские экраны

Роуты:
  /laser /press /weld /paint /pack — экраны операторов (тема shopfloor)
  /mes/queue                       — канбан мастера

Компоненты:
  src/lib/stations.ts              — STATIONS, StationSpec
  src/components/StationShell.tsx  — общий shell оператора
  src/app/mes/queue/page.tsx       — канбан 5 колонок

API:
  GET   /api/mes/tasks?station=X   — очередь станка
  POST  /api/mes/tasks/:id/start   — старт
  POST  /api/mes/tasks/:id/report  — { done, scrap, note }
  PATCH /api/mes/tasks/:id         — { machineId, status, note }
  GET   /api/mes/queue             — сводка

БД (app_db, +2 таблицы):
  machine_tasks   — производственные задания
  machine_events  — аудит: start | +1 | scrap

Ключевое:
  • Инкремент sql`done + N` — два оператора не перетрут.
  • Автозакрытие: done >= qty -> status=done + finished_at.
  • meta jsonb — произвольные параметры станка.

Подводные камни:
  • drizzle-kit push требует TTY -> через SSH не работает.
    Накат таблиц — прямым SQL через psql.
  • next-env.d.ts был под git -> git rm --cached.

---

## 20. Обновление от 06.10.2026 (вечер) — navbar ЦЕХ + тесты

### Кнопка ЦЕХ (коммит 9eeb57c)
  site-header.tsx: NAV += { href: "/mes/queue", label: "Цех", icon: Factory }
  Позиция между «История» и «Станок». < 640px — только иконка.

### Автотесты MES (коммит fe72a44)
  tests/mes.test.mjs — 27 тестов через node:test
  Покрытие: Health, MES API, Jarvis MES, 6 страниц HTTP 200
  Запуск: npm test (~23 сек)

### Паттерн db.execute в pg
  Драйвер возвращает { rows: [...] }, не массив.
  mes.ts: const rows = (_r as unknown as { rows: T[] }).rows

### NetBird — реальный статус
  Samsung: клиент есть, toggle ВЫКЛЮЧЕН. В сети 0 пиров.
  Doogee: netbird НЕ установлен.
  Строчка «NetBird 100.96.47.95» в старом SESSION_START.md — устарела.
  Решение (Wi-Fi / NetBird / Amvera) отложено.

### Итог сессии
  6 коммитов: 95a795f → 9eeb57c
  +1300 строк: MES, Jarvis MES, тесты, navbar
  Amvera: аккаунт, 111 ₽ — но деплой не сделан

---

## 21. Обновление от 06.10.2026 (вечер) — приём заявок

### Telegram-бот @Fireprombot

Расположение: ~/fireprom-intake/ (Samsung), процесс bot.py (Python 3.14 + python-telegram-bot 22.8).

Транспорт: SOCKS5 через Orbot (127.0.0.1:9050) — на Samsung Telegram работает
только через прокси. Termux видит SOCKS5 (127.0.0.1:9050 открыт).

Роли (по from.id):
  • Менеджер (5529929467) — меню Заявки/Статус/Контакты/Помощь
  • Клиент — пошаговый диалог /new

Команды менеджера:
  /start /help /leads /status /contacts

Клиентский диалог (4 шага + файлы):
  1) Тип (11 reply-кнопок с эмодзи)
  2) Имя
  3) Телефон
  4) Комментарий (/skip)
  5+) Файлы (DXF/PDF/фото) → кнопка «✅ Отправить заявку»

Маршрут:
  Telegram → Orbot SOCKS5 → Samsung bot.py → LAN 192.168.10.21:3000
    → /api/leads (POST multipart) → Postgres + uploads/

### Модуль leads на Doogee

Таблицы: leads, lead_items, lead_files (всего 15 в app_db).
API: POST/GET /api/leads, автонумерация L-YYMMDD-NNN (дневной счётчик).
Файлы: ~/fireprom-v14/uploads/{leadId}/, SHA-256 дедупликация.
Роут: src/app/api/leads/route.ts.

### Ловушка UPLOAD_ROOT в standalone

process.cwd() = .next/standalone, uploads уезжал внутрь standalone и
терялся при пересборке. Патч: UPLOAD_ROOT = (() => {...}) — 
из .next/standalone поднимаемся на два уровня вверх к корню проекта.

### Управление ботом (Samsung)

Запуск:  ~/fireprom-intake/start.sh
Останов: он же — убивает все процессы fireprom-intake и запускает один
Лог:     ~/fireprom-intake/bot.log

### Известные особенности

  • reply-кнопки работают, inline (callback) — теряются через SOCKS5
    → меню переделано на reply, нормализация текста через normalize()
  • Конфликт getUpdates при двух запущенных bot.py с одним токеном
    → start.sh убивает все старые перед запуском нового
  • PTBUserWarning про per_message — некритичен, не используем ConversationHandler

### Известные ограничения

  • MAX Bot API — не проверен, добавление отложено
  • IMAP san@fire-prom.ru — не проверен, добавление отложено
  • Автозапуск через Termux:Boot — не настроен

---

## 22. Обновление 07.10.2026 — прайсы в Telegram

### @Fireprombot — модуль прайсов

Добавлены в бота на Samsung (~/fireprom-intake/bot.py):

  Команды (всем):
    /doors — прайс дверей ТИП 1-11 (32 000 – 44 000 ₽/м²)
    /price — прайс монтажа (замер, доставка, ПСУЛ, портал, документация)

  Кнопки клиенту (CLIENT_KB):
    [📝 Новая заявка]
    [💰 Цены]  [📞 Контакты]
    [ℹ️ О компании]

  Подменю (PRICES_KB):
    [🚪 Противопожарные двери] → DOOR_PRICES
    [🔧 Монтаж и услуги]        → SERVICE_PRICES
    [⬅️ Назад]                  → CLIENT_KB/MENU_KB

Источник прайсов — старый информационный бот (~/bot.py от 01.08.2026,
токен 8924445497 отозван). Код сохранён в ~/archive/bot.py.old-20261007.

### Управление ботами (Samsung)

  ~/fireprom-intake/start.sh    — стоп + старт обоих ботов (double-fork)
  ~/fireprom-intake/watchdog.sh — проверка и перезапуск
  ~/fireprom-intake/bot.log     — лог @Fireprombot
  ~/fireprom-bot/bot.log        — лог @fireprom_bot

Cron:  */5 * * * * watchdog.sh (cronie 1.7.2)
Boot:  ~/.termux/boot/02-fireprom-bots.sh + 03-crond.sh

### Ловушки 07.10.2026

  • setsid python3 bot.py & без subshell — родитель ждёт вечно.
    Правильно: ( setsid python3 bot.py & ) — subshell умирает, родитель идёт дальше.
  • watchdog.sh считает процессы по cwd, а не по cmdline
    (команда python3 bot.py не содержит пути).
  • Inline-кнопки (callback) через Orbot SOCKS5 теряются — использовать reply.
  • Эмодзи в reply-кнопках: нормализация через normalize(txt)
    (эмодзи могут отличаться — с U+FE0F и без).

### Мёртвые токены (не удалять из истории)

  8294326412 — Unauthorized
  8610694040 — Unauthorized
  8924445497 — Unauthorized (старый информационный бот)

### Живые боты

  @fireprom_bot (8692066131)       — конфигуратор
  @Fireprombot (8254899354)        — заявки + прайсы + менеджер
  @ark_metaldoors_bot (8636927420) — голосовой ассистент (эксперимент, не в cron)

---

## 23. Обновление 09.10.2026 — уведомления TG + Email

### Таблицы БД (итого 21)

  products         прайс с категориями
  bot_commands     команды бота в БД
  lead_events      лента событий заявки
  notifications    журнал уведомлений (+ subject, status)
  bot_settings     key/value
  channels         каналы доставки (telegram, email)

### API

  GET   /api/products[?category=]      
  POST  /api/products                  
  PATCH /api/products/:id              
  DELETE /api/products/:id             
  GET   /api/bot/commands              
  POST  /api/bot/commands              
  PATCH /api/bot/commands/:id          
  DELETE /api/bot/commands/:id         
  GET   /api/bot/settings              
  POST  /api/bot/settings              
  GET   /api/notifications?status=pending  ← очередь для notifier
  PATCH /api/notifications/:id             ← статус sent/failed/archived
  POST  /api/leads/:id/notify              ← ручное уведомление
  POST  /api/leads                         ← + queueNotifications() при создании

### Уведомления — архитектура

  Doogee создаёт заявку
     ↓ INSERT leads + notifications (status=pending)
  Samsung: ~/fireprom-intake/notifier.py
     ↓ loop 10 сек: GET /api/notifications?status=pending
     ├─ telegram → @Fireprombot через SOCKS5 (Orbot 9050)
     └─ email    → smtp.yandex.ru:465
     ↓ PATCH /api/notifications/:id {status: sent|failed}

  MAX — ручное дублирование (нет токена)

### SMTP — Яндекс с переадресацией

  Логин: aleksandr.aleksandr71@yandex.ru
  От:    san@fire-prom.ru (псевдоним не подтверждён → от личного)
  Цель:  san@fire-prom.ru → переадресация → личный ящик
  Пароль приложения: см. ~/fireprom-intake/.env

### CA Минцифры (для MAX API)

  Установлен на Samsung и Doogee:
    ~/certs/Russian_Trusted_Root_CA.cer
    ~/certs/ca-full.crt
    ~/.bashrc: CURL_CA_BUNDLE, REQUESTS_CA_BUNDLE, SSL_CERT_FILE

  После установки:
    curl https://platform-api2.max.ru/me → {"code":"verify.token"}

### Watchdog (Samsung)

  ~/fireprom-intake/watchdog.sh — проверяет 3 процесса:
    @fireprom_bot  (~/fireprom-bot/bot.py)
    @Fireprombot   (~/fireprom-intake/bot.py)
    notifier.py    (~/fireprom-intake/notifier.py)

  Cron: */5 * * * * watchdog.sh

### End-to-end проверка

  Заявка L-261009-004 «ФИНАЛ»:
    → Postgres + 2 pending в notifications
    → notifier: TG ✓ (bot8254899354), Email ✓ (san@fire-prom.ru)
    → PATCH: status=sent
    → пришло менеджеру в TG + в почту

### Отложено

  • MAX — ручное дублирование (токен бота не получен)
  • /leads и /bot в браузере — проверить визуально
  • /api/email/inbound и /api/email/poll — только Email-отправка, приём не реализован
  • Android APK Studio, Sites, Presentation — не трогали

---

## 24. Источники и резерв (09.10.2026)

### срм1 (5) — рабочая база
Путь: `/sdcard/срм1/daily-development-and-deployment (5)/`

**Взято в v14 (или переработано):**
- ✅ `lib/settings.ts`
- ✅ `lib/constants.ts` → `bot-constants.ts`
- ✅ `lib/types.ts` → `bot-types.ts`
- ✅ `lib/seed.ts` (переработан под прайсы/команды ФАЙЕРПРОМ)
- ✅ `components/LeadsClient.tsx`, `components/BotStudio.tsx`
- ✅ `app/leads/page.tsx`, `app/bot/page.tsx`
- ✅ `api/leads/[id]/notify/route.ts`
- ✅ `api/products/*`, `api/bot/commands/*`, `api/bot/settings`

**Реализовано в другой форме:**
- 🟡 `lib/channels/*` → таблица `channels` + Python `notifier.py`
- 🟡 `lib/bot-engine.ts` → Python-боты на Samsung
- 🟡 `lib/telegram.ts` → `notifier.py` через SOCKS5
- 🟡 `lib/channels/email.ts` → SMTP через Python + Yandex
- 🟡 `lib/channels/max.ts` → отложен до токена MAX

**В резерве (не трогали):**
- ❌ `lib/email-intake.ts` + `api/email/{inbound,poll}` — IMAP-приём
- ❌ `api/max/webhook` — после токена MAX
- ❌ `api/bot/{simulate,webhook}` — песочница (зависит от bot-engine)
- ❌ `api/stats`, `api/site/stats`, `api/track` — статистика + трекинг
- ❌ `components/{ChannelsTab,ApkStudio,Presentation}.tsx`
- ❌ `lib/{apk,apk-data,site-variants,presentation}.ts`
- ❌ `app/{apk,presentation,site}/page.tsx`
- ❌ `api/apk/{issues,script,steps}`, `api/channels/*`

### срм2 (6) — параллельный продукт, не эволюция

Пути:
- `/sdcard/срм2/daily-development-and-deployment (6).zip`
- `/sdcard/срм2/unpacked/` (содержимое без папки-обёртки)

**Структура `unpacked/`:**
- `android/` — цельный Gradle-проект (Java, `build-termux.sh`)
- `public/`
- `src/app/(admin)/` — route group админки
- `src/app/api/` — API
- `src/app/presentation/` — презентация
- `src/app/sites/` — 5 шаблонов сайтов
- `src/components/` — богатый leads UI + `presentation/` + `site/`
  - `LeadDetail.tsx` — развёрнутая карточка (нет в v14)
  - `LeadEditor.tsx` — редактор (нет в v14)
  - `LeadsBoard.tsx` — альтернативный борд (нет в v14)
  - `QuickLeadForm.tsx` — быстрая форма (нет в v14)
  - `CheckBotsButton.tsx` — статус ботов (нет в v14)
  - `CopyButton.tsx` — утилита (нет в v14)
  - `SiteNav.tsx` — навигация сайтов (нет в v14)

**Отличия от срм1:**
- ➕ `android/` (Java, gradle) — отдельный продукт
- ➕ `(admin)/` — route group
- ➕ `sites/` + `presentation/` — отдельные модули
- ➕ улучшенный leads UI (Board/Detail/Editor/QuickForm)
- ➕ `api/telegram/webhook` — webhook вместо polling
- ➖ `bot-engine.ts` — отсутствует

**Из срм2 не брали.** Возможный резерв:
- ⏸ LeadsBoard + LeadDetail + LeadEditor + QuickLeadForm — апгрейд `/leads`
- ⏸ CheckBotsButton — мониторинг в UI
- ⏸ `sites/`, `presentation/`, `(admin)/`, `android/` — отдельные сессии

### Резерв по приоритетам (следующие сессии)

| Приоритет | Что | Откуда |
|---|---|---|
| 🔥 высокий | IMAP-приём (`email-intake` + `api/email/*`) | срм1 |
| 🔥 высокий | Апгрейд `/leads` (LeadsBoard, LeadDetail, LeadEditor, QuickLeadForm) | срм2 |
| средний | `api/stats`, `api/site/stats`, `api/track` | срм1 |
| средний | ChannelsTab — вкрутить в `/bot` UI | срм1 |
| после MAX | `lib/channels/max.ts` + `api/max/webhook` | срм1 |
| отдельно | APK Studio (`lib/apk*`, `api/apk/*`, `ApkStudio.tsx`) | срм1 |
| отдельно | Sites (`lib/site-variants*`, `api/site/*`, SiteNav) | срм1 + срм2 |
| отдельно | Presentation (`lib/presentation`, `Presentation.tsx`) | срм1 |
| отдельно | Android APK (`android/`, `build-termux.sh`) | срм2 |

### Финальная проверка сессии (09.10.2026 11:50)

Прогон ~/test-fireprom.sh (на Samsung): PASS=44 FAIL=3 WARN=2.
Все FAIL/WARN — ложные срабатывания теста:
  • /api/mes/tasks требует ?station=... — работает как задумано
  • /api/kp не существует (есть /api/kp/[id]/pdf)
  • @fireprom_bot — жив (PID 7932, u0_a624, python3 bot.py)
  • SOCKS5: порт 9050 открыт, но HTTP 000 — у Samsung нет
    исходящего интернета (direct TG тоже 000)

Состояние стека на конец сессии:
  • 21 таблица, 12 leads, 14 notifications (0 pending, все sent)
  • 16/16 страниц UI → 200
  • 14/16 API → 200
  • POST /api/leads → 201
  • Пайплайн TG+Email отработал 12/12 (11:22-11:24)
  • 3 бота живы, watchdog OK, cron OK
  • HEAD=3ba42fe (раздел 24), working tree чист
  • Ref: a95d202 (битый) → reset → 3ba42fe (полный через scp)

⚠️ На конец сессии: Orbot/SOCKS5 без выхода в интернет,
   notifier вхолостую (0 pending). Диагностику продолжить
   в следующей сессии — Wi-Fi ping работает, HTTPS нет.

Отложено:
  • MAX-токен (dev.max.ru)
  • IMAP-приём (email-intake + api/email/*)
  • Апгрейд /leads из срм2 (LeadsBoard, LeadDetail, LeadEditor, QuickLeadForm)
  • ChannelsTab в /bot UI
  • APK Studio, Sites, Presentation, Android APK
  • Диагностика Orbot (DNS vs bootstrap)
