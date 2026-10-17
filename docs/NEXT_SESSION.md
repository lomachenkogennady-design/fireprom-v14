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

## Интеграция door_order ↔ quote_items — что осталось

### Уже готово (PR-6, PR-9b-fix)
- door_orders.quote_id / quote_item_id (FK) — schema-orders.ts:19-20
- createDoorOrder принимает quoteId/quoteItemId — order-service.ts:95-96
- createQuoteWithDoor (создать КП+заказ из конфига) — quote-door-service.ts:74
- breakdown.door_order_id в quote_items — quote-door-service.ts шаг 7

### Что нужно сделать (C3+)
1. Сервис createQuoteFromExistingOrder(orderId) — новый
   src/lib/doors/quote-from-order-service.ts (~80-100 строк):
   - читает door_orders по id
   - если quote_id уже есть → вернуть существующий (идемпотентно) или 409
   - создаёт quotes (subtotal = door_orders.subtotal,
     total = door_orders.totalPrice, vatPct = door_orders.vatRate)
   - создаёт quote_items (item_type="door", unitPrice=subtotal,
     breakdown={door_order_id})
   - обновляет door_orders.quote_id / quote_item_id
   - audit action="attach_to_quote"

2. Endpoint POST /api/doors/orders/[id]/to-quote — ~40 строк,
   зеркалит стиль quote-order/route.ts

3. Кнопка «Создать КП» в OrdersListClient — только если quoteId === null,
   после успеха router.push(/kp?load=N). ~20 строк

### Оценка
1.5-2 часа кода + сборка + smoke. Лучше в свежей сессии.

### Разведка перед кодом (3 команды)
1. quoteNumber + схема quotes/quoteItems — grep pricing.ts, schema.ts
2. getDoorOrder — тянет ли hardware/services
3. Полная схема quotes — какие поля NOT NULL

### Smoke-тест
curl POST /api/doors/orders/1/to-quote → 200
psql: SELECT quote_id, quote_item_id FROM door_orders WHERE id=1 → не NULL
открыть /kp?load=N — видна позиция «Дверь 900×2000» с ценой 29490
