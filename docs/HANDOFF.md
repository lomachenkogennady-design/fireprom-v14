# FireProM v14 — Handoff

См. также: docs/PROGRESS.md, docs/NEXT_SESSION.md, README.md

## Правило проекта

Бесплатно, локально, без облаков. Arena/LMArena не использовать —
диалоги уходят в публичный датасет. Только Ollama.

## Доступ

ssh -p 8022 u0_a304@192.168.10.21

## Проверка здоровья

ps -ef | grep next-server
curl -s http://127.0.0.1:3000/api/health

Ожидаем: строка next-server + {"ok":true,"db":"connected"}

## UI

- /admin/price-lists — прайсы
- /admin/doors — каталог дверей (5 табов)
- /doors/new — конфигуратор

## Данные

Активный прайс: id=6 «Прайс дверей Q4 v2», 17 позиций.
Каталог: 3 профиля, 3 наполнения, 3 отделки, 4 фурнитуры, 5 услуг.
Тестовый заказ id=1: subtotal=29490, total=35977.80.

## Что сделано

PR-1: прайс-инфраструктура
PR-2: API прайсов
PR-3: UI прайсов
PR-4: схема каталога дверей
PR-5a-e: сид, сервис, API, UI, калькулятор
PR-6: заказы дверей
PR-8: конфигуратор /doors/new

Полный цикл: каталог → прайс → расчёт → заказ → БД.

## Риски для ревью

A. Гонка при первой активации прайса.
   activatePriceList использует .for("update"), но при пустой
   таблице блокировать нечего. Два параллельных вызова могут
   оба записать oldValue: null.
   Кандидат-фикс: pg_advisory_xact_lock в начале транзакции.

B. Денежная арифметика на float64.
   Сервис принимает price: number и применяет .toFixed(2).
   Калькулятор — Math.round(x * 100) / 100.
   Накопление сумм может дать погрешность.
   Кандидат-фикс: работа в копейках или decimal.js.

## Ревью через Ollama

Установленные модели: llama3.1:8b, qwen3:4b, qwen3:4b-instruct,
qwen2.5:3b, phi3:latest, qwen2.5:1.5b.

Критично: Ollama обрезает контекст до 2048 по умолчанию.
Без явного num_ctx 16384 модель молча теряет начало промпта.

Modelfile создать один раз:
  FROM llama3.1:8b
  PARAMETER num_ctx 16384
  PARAMETER temperature 0.2

Аналогично для qwen3:4b и qwen3:4b-instruct.
Теги review-llama, review-qwen3, review-qwen3i.

Прогон: три модели, три сессии, одинаковый промпт.
Материал: price-list-service.ts + schema-pricing.ts + SQL 002, 003.
Не подсказывать модели про баги. Добавить контрольный фрагмент
без багов — если найдёт проблемы, оценки делить на два.

## Roadmap

- UI заказов /admin/doors/orders
- Интеграция door_order ↔ quote_items
- Ретрофит quotes real → DECIMAL
- Локальное ревью через Ollama (три модели)
- RBAC перед NetBird
- Backup cron (pg_dump ежедневно)
- 3D-визуализация конфигуратора

## Первый запрос новой сессии

cat ~/fireprom-v14/docs/PROGRESS.md
cat ~/fireprom-v14/docs/NEXT_SESSION.md
cat ~/fireprom-v14/docs/HANDOFF.md
ssh -p 8022 u0_a304@192.168.10.21 "ps -ef | grep next-server ; curl -s http://127.0.0.1:3000/api/health"

Приложить вывод — контекст восстановится за 30 секунд.
