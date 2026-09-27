# FireProM v14 — Единый портал ФАЙЕРПРОМ

## Что это

Веб-приложение для ООО «ФАЙЕРПРОМ» (Санкт-Петербург, металлообработка).
Объединяет инженерный расчёт гибки и коммерческие предложения в одном окне.

## Стек

- **Frontend:** Next.js 16 (App Router) + React 19 + TypeScript
- **UI:** Tailwind CSS 4 + 5 тем оформления
- **Backend:** Next.js API routes (Node.js)
- **БД:** PostgreSQL 18.2 + Drizzle ORM
- **LLM:** Ollama на Doogee (qwen3:4b-instruct) через Jarvis API
- **3D:** Three.js + OrbitControls
- **DXF:** собственный парсер + генератор

## Целевые пользователи

| Роль | Модуль | Что делает |
|---|---|---|
| Менеджер | `/kp` | Коммерческие предложения, импорт DXF, печать |
| Технолог | `/bending` | Расчёт развёртки, 3D, экспорт DXF |
| Мастер цеха | `/machine` | Характеристики оборудования |
| Все | Jarvis (🔥) | AI-ассистент (expert + LLM) |

## Что готово (на 26.09.2026)

- ✅ 6 страниц: `/`, `/bending`, `/kp`, `/history`, `/machine`, `/ui`
- ✅ 4 таблицы БД: `clients`, `bending_calculations`, `quotes`, `quote_items`
- ✅ CRUD-API для клиентов, расчётов, КП
- ✅ Импорт DXF в КП (парсер `dxf-import.ts`)
- ✅ Экспорт DXF (слои CUT/BEND/HOLES/TEXT)
- ✅ 3D и 2D визуализация гибки
- ✅ 5 тем оформления (forge, blueprint, paper, shopfloor, terminal)
- ✅ Jarvis: экспертный движок (697 строк) + Ollama
- ✅ Бэкапы в 4 места (GitHub + Samsung ×2 + Doogee)
- ✅ Автозапуск Postgres + Next.js в Termux

## Что не готово

- ❌ Боевая ссылка из интернета (туннели блокируются в РФ)
- ❌ Jarvis в облаке (Ollama только на локальном Doogee)
- ❌ Авторизация пользователей (только локальная сеть)

## Текущее развёртывание

- **Сервер:** Samsung (Termux) — Next.js :3000 + PostgreSQL :5432
- **LLM-сервер:** Doogee (Termux) — Ollama :11434
- **Доступ:** `http://192.168.10.44:3000` (Wi-Fi офиса)
- **Репозиторий:** github.com/lomachenkogennady-design/fireprom-v14

## Ближайшие планы

1. VPS + frp (~150 ₽/мес) — постоянная боевая ссылка
2. Доработка модуля `/machine` — реальные паспорта станков
3. Расширение Jarvis — больше интентов эксперта
4. Экспорт PDF-КП с реквизитами

## Ключевые файлы

| Файл | Что |
|---|---|
| `src/app/api/jarvis/route.ts` | API Jarvis |
| `src/lib/jarvis/expert.ts` | Экспертный движок (697 строк) |
| `src/lib/jarvis/llm.ts` | Провайдеры LLM (Ollama приоритет) |
| `src/lib/geometry.ts` | Формулы гибки (DIN 6935) |
| `src/lib/pricing.ts` | Тарифы лазер/гибка/покраска |
| `src/lib/machine.ts` | Характеристики станков |
| `src/components/bending-calculator.tsx` | Форма гибки |
| `src/components/quote-builder.tsx` | Форма КП |

## История решений

См. `docs/sessions/` — отчёты по сессиям разработки.
