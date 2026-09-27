# Модуль: Jarvis (AI-ассистент)

## Назначение
Помощник технолога и менеджера. Отвечает на вопросы по текущему расчёту.

## Архитектура (2 слоя)

Вопрос -> expert.ts (697 строк)
- intent найден -> точный ответ (0.05 сек)
- не найден -> Ollama qwen3:4b -> свободный ответ (2-10 сек)
- если LLM недоступна -> Fallback

## Ключевые файлы
- src/lib/jarvis/expert.ts - интенты
- src/lib/jarvis/llm.ts - провайдеры (Ollama приоритет)
- src/lib/jarvis/types.ts - типы Snapshot
- src/app/api/jarvis/route.ts - POST-обработчик

## Оптимизации
- think: false для qwen3
- max_tokens: 220
- stripThinking() - отсекает think блоки
- keep_alive: 24h

## Время ответа
- Expert: 0.05 сек
- LLM: 2-10 сек
- Fallback: мгновенно

## Зависимости
- Ollama на Doogee: 192.168.10.21:11434
- Env: OLLAMA_URL, OLLAMA_MODEL, LLM_TIMEOUT_MS
