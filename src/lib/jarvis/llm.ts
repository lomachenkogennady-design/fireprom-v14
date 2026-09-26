/**
 * Выбор провайдера языковой модели.
 *
 * Вынесено из route-файла: Next.js разрешает экспортировать оттуда только
 * обработчики (GET/POST/…) и служебные поля конфигурации — произвольный
 * экспорт роняет сборку webpack.
 */

export interface LlmProvider {
  name: string;
  baseUrl: string;
  /** пустая строка для локальных моделей без авторизации */
  key: string;
  model: string;
  /** локальная модель на слабом железе отвечает дольше */
  timeoutMs: number;
}

/** Ollama слушает 11434 и отдаёт OpenAI-совместимый /v1/chat/completions */
function normalizeOllamaUrl(raw: string): string {
  let url = raw.trim().replace(/\/+$/, "");
  if (!/^https?:\/\//.test(url)) url = `http://${url}`;
  if (!/\/v1$/.test(url)) url = `${url}/v1`;
  return url;
}

export function resolveProvider(): LlmProvider | null {
  // 1. Локальная Ollama — приоритетный вариант
  const ollama = process.env.OLLAMA_URL ?? process.env.OLLAMA_HOST;
  if (ollama) {
    return {
      name: "ollama",
      baseUrl: normalizeOllamaUrl(ollama),
      key: "",
      model: process.env.OLLAMA_MODEL ?? process.env.LLM_MODEL ?? "qwen3:4b-instruct",
      timeoutMs: Number(process.env.LLM_TIMEOUT_MS ?? 55_000),
    };
  }

  // 2. Облачные провайдеры по ключу
  const custom = process.env.LLM_BASE_URL;
  const pick: [string, string | undefined, string, string][] = [
    ["openai", process.env.OPENAI_API_KEY, "https://api.openai.com/v1", "gpt-4o-mini"],
    ["openrouter", process.env.OPENROUTER_API_KEY, "https://openrouter.ai/api/v1", "openai/gpt-4o-mini"],
    ["deepseek", process.env.DEEPSEEK_API_KEY, "https://api.deepseek.com/v1", "deepseek-chat"],
    ["groq", process.env.GROQ_API_KEY, "https://api.groq.com/openai/v1", "llama-3.3-70b-versatile"],
  ];
  for (const [name, key, baseUrl, model] of pick) {
    if (key) {
      return {
        name,
        key,
        baseUrl: custom ?? baseUrl,
        model: process.env.LLM_MODEL ?? model,
        timeoutMs: Number(process.env.LLM_TIMEOUT_MS ?? 25_000),
      };
    }
  }
  return null;
}
