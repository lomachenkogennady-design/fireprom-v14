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
