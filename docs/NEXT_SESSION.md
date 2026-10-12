# FireProM v14 — Старт новой сессии

## Доступ


Сервер: Doogee V40 Pro, Termux. Пульт: Xiaomi Redmi Note 10 Pro.

## Проверка здоровья

Ожидаем строку `next-server` + `{"ok":true,"db":"connected"}`.

## Перезапуск (если упал)

## UI

- http://192.168.10.21:3000/admin/price-lists — прайсы
- http://192.168.10.21:3000/admin/doors — каталог дверей
- http://192.168.10.21:3000/doors/new — конфигуратор

## Данные

- Активный прайс: id=6 «Прайс дверей Q4 v2», 17 позиций
- Каталог: 3 профиля, 3 наполнения, 3 отделки, 4 фурнитуры, 5 услуг
- Заказы: 1 тестовый (id=1, subtotal=29490, total=35977.80)

## Что сделано

PR-1: прайс-инфраструктура (5 таблиц)
PR-2: API прайсов (5 роутов)
PR-3: UI прайсов
PR-4: схема каталога дверей (5 таблиц)
PR-5a-e: сид, сервис, API, UI, калькулятор
PR-6: заказы дверей (3 таблицы + сервис + API)
PR-8: конфигуратор /doors/new

Коммит: 6414d5f, запушен на GitHub.

## Roadmap

- UI заказов /admin/doors/orders
- Интеграция door_order ↔ quote_items
- Ретрофит quotes real → DECIMAL
- RBAC перед NetBird
- Backup cron

## Грабли

1. Turbopack на Android — только `--webpack`
2. Standalone без статики — `cp -r .next/static .next/standalone/.next/`
3. Tailwind тёмная тема — `text-*-900` на светлых фонах
4. Bracketed paste — `set +H` + перезапуск Termux
5. `npx tsc` — только с `-p tsconfig.json`
6. EADDRINUSE :3000 — watchdog уже держит порт
7. process.cwd failed — pkill перед сборкой

## Команда для ИИ в новой сессии
