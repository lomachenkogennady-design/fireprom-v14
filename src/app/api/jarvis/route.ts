import { NextResponse } from "next/server";
import { askExpert, contextSummary } from "@/lib/jarvis/expert";
import type { JarvisSnapshot, JarvisMessage } from "@/lib/jarvis/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Двухслойный ответ:
 *  1. Инженерный движок — считает по фактическому состоянию калькулятора.
 *     Работает всегда, ключи не нужны, числа гарантированно верные.
 *  2. Языковая модель — свободные формулировки, получает те же цифры
 *     в системном промпте. Включается, если задан ключ в окружении.
 */

interface LlmProvider {
  name: string;
  baseUrl: string;
  key: string;
  model: string;
}

function resolveProvider(): LlmProvider | null {
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
      };
    }
  }

  // ─── Локальная Ollama (Doogee) — OpenAI-совместимый endpoint /v1 ───
  const ollamaUrl = process.env.OLLAMA_BASE_URL;
  if (ollamaUrl) {
    return {
      name: "ollama",
      key: "ollama", // Ollama игнорирует ключ, но fetch требует Bearer
      baseUrl: `${ollamaUrl.replace(/\/$/, "")}/v1`,
      model: process.env.OLLAMA_MODEL ?? "qwen3:4b-instruct",
    };
  }

  return null;
}

const SYSTEM = `Ты — Jarvis, инженер-технолог листовой обработки металла компании ФАЙЕРПРОМ (Санкт-Петербург): лазерная резка, гибка на листогибочном прессе, порошковая покраска.

Правила:
- Отвечай по-русски, кратко и по делу, как опытный технолог коллеге.
- Используй ТОЛЬКО числа из контекста расчёта ниже. Никогда не выдумывай значения.
- Если для ответа нужны данные, которых в контексте нет, честно скажи об этом.
- Формулы приводи, когда они объясняют результат.
- Не извиняйся и не расписывай, что ты ИИ.`;

async function callLlm(
  provider: LlmProvider,
  question: string,
  snapshot: JarvisSnapshot,
  history: JarvisMessage[]
): Promise<string> {
  const res = await fetch(`${provider.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${provider.key}`,
    },
    body: JSON.stringify({
      model: provider.model,
      temperature: 0.3,
      max_tokens: 700,
      messages: [
        { role: "system", content: `${SYSTEM}\n\n=== ТЕКУЩИЙ КОНТЕКСТ ===\n${contextSummary(snapshot)}` },
        ...history.slice(-6).map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content: question },
      ],
    }),
    signal: AbortSignal.timeout(55_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${provider.name} ${res.status}: ${text.slice(0, 180)}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const answer = data.choices?.[0]?.message?.content?.trim();
  if (!answer) throw new Error("Пустой ответ модели");
  return answer;
}

function fallbackAnswer(snapshot: JarvisSnapshot): string {
  const base =
    snapshot.kind === "bending"
      ? `Я отвечаю по вашему расчёту «${snapshot.name}» (${snapshot.material}, s=${snapshot.thickness} мм, развёртка ${Math.round(snapshot.results.flatLength)} мм).`
      : snapshot.kind === "quote"
        ? `Я вижу текущее КП: ${snapshot.items.length} позиций на ${Math.round(snapshot.totals.totalClient).toLocaleString("ru-RU")} ₽.`
        : `Откройте «Технологу» или «Менеджеру» — я подхвачу параметры с экрана.`;

  return [
    `Не нашёл эту тему в инженерной базе, а языковая модель не подключена.`,
    ``,
    base,
    ``,
    `Спросите иначе — например: «минимальная полка», «какое усилие», «проверь деталь», «длина развёртки», «сколько стоит», «порядок гибов», «чем заменить материал», «что в DXF».`,
    ``,
    `Чтобы включить свободные ответы, задайте в переменных окружения OPENAI_API_KEY (или OPENROUTER_API_KEY / DEEPSEEK_API_KEY / GROQ_API_KEY).`,
  ].join("\n");
}

export async function POST(req: Request) {
  let body: {
    question?: string;
    context?: JarvisSnapshot;
    history?: JarvisMessage[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }

  const question = String(body.question ?? "").trim();
  if (!question) {
    return NextResponse.json({ error: "Пустой вопрос" }, { status: 400 });
  }

  const snapshot: JarvisSnapshot = body.context ?? { kind: "idle", page: "/" };
  const history = Array.isArray(body.history) ? body.history : [];

  // 1. Инженерный движок — числа только из расчёта
  const expert = askExpert(question, snapshot);
  if (expert) {
    return NextResponse.json({
      answer: expert.answer,
      source: "expert",
      intent: expert.intent,
    });
  }

  // 2. Языковая модель — если есть ключ
  const provider = resolveProvider();
  if (provider) {
    try {
      const answer = await callLlm(provider, question, snapshot, history);
      return NextResponse.json({ answer, source: "llm", model: provider.model });
    } catch (e) {
      return NextResponse.json({
        answer: `Модель недоступна: ${e instanceof Error ? e.message : "ошибка сети"}.\n\n${fallbackAnswer(snapshot)}`,
        source: "fallback",
      });
    }
  }

  // 3. Честная заглушка с подсказками
  return NextResponse.json({ answer: fallbackAnswer(snapshot), source: "fallback" });
}
