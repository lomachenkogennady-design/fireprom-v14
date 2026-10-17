
---

## PR-3 — UI прайс-листов (закрыт 2026-10-12)

### Файлы

- src/app/admin/price-lists/page.tsx (7) — server component
- src/components/admin/price-lists/PriceListsClient.tsx (163) — client
- src/app/api/admin/price-lists/* — 5 роутов (см. PR-2)

### Функции UI

- Список всех версий с тегами draft/published/active
- Кнопка «Опубликовать» на черновиках
- Кнопка «Активировать» на published, не active
- Клик по версии — раскрытие позиций
- Плашка активного прайса
- Кнопка «Обновить»

### Уроки

1. Next.js standalone: статику надо копировать вручную:
   cp -r .next/static .next/standalone/.next/
   Добавлен npm скрипт build:standalone.
2. Tailwind на тёмной теме: светлые фоны (bg-green-50)
   требуют явных text-*-900, иначе текст невидим.
3. Turbopack не работает на Android/arm64 — только webpack.
4. Bracketed paste в Termux ломает вставки команд.
   Решение: printf вместо heredoc, или отключить.

### Статус

PR-1, PR-2, PR-3 закрыты. Прайсы работают end-to-end
через UI и API.

---

## PR-4 — Схема каталога дверей

- scripts/sql/004_doors_catalog.sql (77) — 5 таблиц
- src/db/schema-doors.ts (113) — Drizzle
- Экспорт в schema.ts: export * from "./schema-doors"

## PR-5a — Сид каталога

- scripts/sql/005_doors_seed.sql (77)
- 3 профиля, 3 наполнения, 3 отделки, 4 фурнитуры, 5 услуг
- 18 записей в catalog_items, 18 в door_*

## PR-5b — Сервис каталога

- src/lib/doors/catalog-service.ts (402, 12 функций)
- list + create для всех 5 типов
- setCatalogItemActive — soft delete с audit

## PR-5c — API каталога

- src/app/api/admin/doors/route.ts (14) — сводка
- src/app/api/admin/doors/[type]/route.ts (90) — универсальный GET/POST
- src/app/api/admin/doors/catalog-item/[id]/route.ts (43) — PATCH soft delete

Все тесты пройдены: 11/11 (список, создание, soft delete, audit).

## Дальше

- PR-5d: UI /admin/doors — таблицы 5 типов
- PR-5e: Калькулятор дверей (DoorPriceCalculator.ts)
- PR-5f: Конфигуратор + интеграция с КП

---

## PR-4 — Схема каталога дверей

- scripts/sql/004_doors_catalog.sql (77) — 5 таблиц
- src/db/schema-doors.ts (113) — Drizzle
- Экспорт в schema.ts

## PR-5a — Сид каталога

- scripts/sql/005_doors_seed.sql
- 3 профиля, 3 наполнения, 3 отделки, 4 фурнитуры, 5 услуг

## PR-5b — Сервис каталога

- src/lib/doors/catalog-service.ts (402, 12 функций)
- list + create для всех 5 типов
- setCatalogItemActive — soft delete с audit

## PR-5c — API каталога

- src/app/api/admin/doors/route.ts (14) — сводка
- src/app/api/admin/doors/[type]/route.ts (90) — универсальный GET/POST
- src/app/api/admin/doors/catalog-item/[id]/route.ts (43) — PATCH soft delete

Тесты: 11/11 (список, создание, soft delete, audit).

## Дальше

- PR-5d: UI /admin/doors
- PR-5e: Калькулятор дверей
- PR-5f: Конфигуратор + интеграция с КП

---

## PR-5d — UI каталога дверей

- src/app/admin/doors/page.tsx (7)
- src/components/admin/doors/DoorsCatalogClient.tsx (~200)
- 5 табов, таблица, soft delete toggle

## PR-5e — Калькулятор дверей

- src/lib/doors/DoorPriceCalculator.ts (~330)
- src/app/api/doors/calculate/route.ts (~72)
- POST /api/doors/calculate

Тест: дверь 900×2000, профиль standard-60, минвата-50,
отделки powder + mdf, 3 петли + замок + ручка, 3 услуги.
Итог: subtotal=29490, pricingVersionId=5.
Петля умножается на hingeCount — проверено.

## Дальше

- PR-5f: Конфигуратор UI + сохранение заказа двери
- Интеграция door_order с quote_items
- Ретрофит quotes (real -> DECIMAL)

---

## PR-6 — Заказы дверей

### Схема

- scripts/sql/006_door_orders.sql (88)
- src/db/schema-orders.ts (~120)
- 3 таблицы: door_orders, door_order_hardware, door_order_services
- Триггер door_orders_touch_updated_at
- 3 индекса на door_orders

### Сервис

- src/lib/doors/order-service.ts (~215, 3 функции)
- createDoorOrder — транзакция: order + hardware + services + audit
- pricing_snapshot с format_version и pricing_engine_version
- getDoorOrder, listDoorOrders

### API

- src/app/api/doors/orders/route.ts (GET, POST)
- src/app/api/doors/orders/[id]/route.ts (GET)

### Тест

Заказ id=1: дверь 900×2000, standard-60, минвата-50,
отделки powder+mdf, 3 петли, замок, ручка, 3 услуги.
subtotal=29490, vat=6487.80, total=35977.80.
Петля ×3, price_at_order зафиксирована, audit записан.

## Дальше

- PR-7: UI заказов /admin/doors/orders
- PR-8: Конфигуратор /doors/new
- Ретрофит quotes (real -> DECIMAL)

---

## PR-7/8 — UI заказов + Конфигуратор

### Файлы

- src/app/doors/new/page.tsx (7)
- src/components/doors/DoorsConfiguratorClient.tsx (~407)
- POST /api/doors/orders — сохранение
- GET /api/doors/orders, /orders/[id]

### Что работает

- Форма: клиент, габариты, петли, профиль, наполнение,
  отделки (нар./внутр.), фурнитура, услуги
- Кнопка «Рассчитать» → таблица позиций + subtotal
- Кнопка «Сохранить заказ» → door_orders + snapshot + audit
- Ошибки калькулятора отображаются в UI

### Прайс дверей

Активен v6 (id=6) «Прайс дверей Q4 v2» — 17 позиций,
включая Kale 252 = 5000.00.

### Скриншот-тест

Конфигуратор: Премиум 100 + Комбинированный 60 + Powder + МДФ
+ весь hardware + все услуги → рассчитан, заказ сохранён.

## Что ещё не сделано

- UI списка заказов /admin/doors/orders
- Интеграция door_order ↔ quote_items (родительский КП)
- Ретрофит quotes real → DECIMAL
- RBAC перед внешним доступом
- Backup-регламент (cron для pg_dump)

---

## Ретрофит quotes: real → numeric(12,2) — 2026-10-17

Закрыт риск B (денежная арифметика на float64).

### SQL

- scripts/sql/007_quotes_decimal.sql
- ALTER TABLE quotes: discount_pct, vat_pct, subtotal, total
- ALTER TABLE quote_items: unit_price, total_price
- Размеры (thickness, len, wid, cut_len) остались real

### Код

- schema.ts: 6 полей real → numeric
- quotes/route.ts: .toFixed(2) на INSERT
- kp-data.ts, history/route.ts, page.tsx: Number() при чтении

### Проверка

4 КП до и после — те же числа:
id=1: 2071.00 → 2527.00
id=2: 2071.00 → 2527.00
id=3: 66.00 → 1000.00
id=4: 6338.00 → 7732.00

Оборот по КП: 13786 ₽ (не изменился).
tsc чист, сборка проходит, UI показывает корректные суммы.

### Статус

Риск B закрыт для quotes/quote_items. door_* уже были numeric.

---

## PR-9 — UI списка заказов (2026-10-17)

- src/app/admin/doors/orders/page.tsx (7)
- src/components/admin/doors/OrdersListClient.tsx (~290)
- Список + раскрытие: конфигурация, финансы, фурнитура, услуги, snapshot
- Read-only
- Мелочь: на узком экране колонки фурнитуры слипаются, данные в БД верные

---

## PR-9b-fix — цены door-позиции в КП (2026-10-17)

### Что закрыто

После PR-9b страница /kp?load=5 открывалась, но цена позиции
была 0 ₽. Причина: calcItem ранний return для door возвращал
unitPrice: (input as any).unitPrice ?? 0, а setItems не
передавал цену из API.

### Изменения

- pricing.ts: QuoteItemInput получил unitPrice?: number, totalPrice?: number
- calcItem: input.unitPrice ?? 0 без as any
- quote-builder.tsx: setItems передаёт unitPrice/totalPrice из r
- quote-builder.tsx:192: if ((i.material as string) === door) continue

### Проверка

КП-261017-05: позиция 29490 ₽, подытог 29490, НДС 6488,
итого 35978 ₽.

### Известные мелочи

- В колонке «Материал» дверь отображается как «Ст3» —
  UI не знает про material=door. Косметика, отдельная правка.
- Итого в UI 35978 (округление до рубля) vs 35977.80 в БД.
  Нормально для отображения.

---

## A. Backup cron — 2026-10-17

Закрыт операционный риск «нет регулярных бэкапов».

### Скрипт

- scripts/backup-db.sh: pg_dump app_db + gzip + ротация 30 дней
- Ручной запуск: ./scripts/backup-db.sh manual

### Cron

- Пакет: cronie (pkg install cronie)
- crontab:
    HOME=/data/data/com.termux/files/home
    PATH=/data/.../usr/bin:/data/.../usr/bin/applets
    0 2 * * * .../scripts/backup-db.sh scheduled >> .../backups/cron.log 2>&1
- HOME и PATH обязательны, иначе crond не найдёт pg_dump/gzip/date

### Автозапуск

- crond стартует из ~/.termux/boot/05-fireprom-v14.sh
- Проверка: pgrep crond → PID

### Тест

- Тестовая задача «* * * * *» сработала: 14:06, 14:07
- После теста crontab очищен, cron-test.log удалён
- Ежедневный бэкап в 02:00 MSK

### Файлы

- app_db-YYYYMMDD-HHMMSS.sql.gz (~19-20 KB)
- app_db-scheduled-*.sql.gz — ежедневные
- app_db-manual-*.sql.gz — ручные
- app_db-*.sql.gz старше 30 дней удаляются автоматически
