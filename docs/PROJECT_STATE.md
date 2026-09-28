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
