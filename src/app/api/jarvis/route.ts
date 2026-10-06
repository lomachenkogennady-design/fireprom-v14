import { NextResponse } from "next/server";
import { askExpert, contextSummary } from "@/lib/jarvis/expert";
import type { JarvisSnapshot, JarvisMessage } from "@/lib/jarvis/types";
import { resolveProvider, type LlmProvider } from "@/lib/jarvis/llm";
import { askMes } from "@/lib/jarvis/mes";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const SYSTEM = `Ты — Jarvis, инженер-технолог листовой обработки металла компании ФАЙЕРПРОМ (Санкт-Петербург): лазерная резка, гибка на листогибочном прессе, порошковая покраска.

ЖЁСТКИЕ ПРАВИЛА:
- Отвечай на русском, кратко и по делу. Без вступлений, без "Здравствуйте", без "Как я могу помочь".
- Никаких самохарактеристик ("Я — нейросеть", "Я — модель", "Я создан компанией...").
- Никакого reasoning: не показывай цепочки мыслей, не пиши "сначала подумаем", "давайте разберём по шагам".
- Числа — ТОЛЬКО из контекста расчёта ниже. Не выдумывай, не округляй без причины.
- Если данных в контексте нет — честно скажи "В контексте расчёта этой величины нет" одной строкой.
- Формулы приводи, только если объясняют ответ.
- Ограничение: 3–5 предложений на ответ. Если нужно больше — структурируй списком по 1 строке.`;

const VALID_MATERIALS = ["steel", "stainless", "aluminum"] as const;

/**
 * Валидация снапшота, приходящего с клиента.
 *
 * Раньше неполный context (например, {kind:"bending",material:"Ст3"} без
 * results) приводил к чтению свойств undefined в expert.ts / contextSummary,
 * что на WASM-сборке Next.js под ARM превращалось в Rust-панику и HTTP 500.
 * Теперь неполный снапшот отбрасывается в idle до попадания в движок.
 */
function sanitizeSnapshot(raw: unknown): JarvisSnapshot {
  if (!raw || typeof raw !== "object") return { kind: "idle", page: "/" };
  const s = raw as Record<string, unknown>;
  const page = typeof s.page === "string" ? s.page : "/";

  if (s.kind === "bending") {
    const materialOk = VALID_MATERIALS.includes(s.material as (typeof VALID_MATERIALS)[number]);
    const hasResults = s.results && typeof s.results === "object";
    const hasFlanges = Array.isArray(s.flanges);
    const hasBends = Array.isArray(s.bends);
    const hasHoles = Array.isArray(s.holes);
    if (!materialOk || !hasResults || !hasFlanges || !hasBends || !hasHoles) {
      return { kind: "idle", page };
    }
    return raw as JarvisSnapshot;
  }

  if (s.kind === "quote") {
    if (!Array.isArray(s.items) || !s.totals || typeof s.totals !== "object") {
      return { kind: "idle", page };
    }
    return raw as JarvisSnapshot;
  }

  return { kind: "idle", page };
}

/** Рассуждающие модели (qwen3, deepseek-r1) оборачивают мысли в теги */
function stripThinking(text: string): string {
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, "")
    .replace(/^[\s\S]*?<\/think>/i, "")
    .trim();
}

async function callLlm(
  provider: LlmProvider,
  question: string,
  snapshot: JarvisSnapshot,
  history: JarvisMessage[]
): Promise<string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (provider.key) headers.Authorization = `Bearer ${provider.key}`;

  const summary = (() => {
    try {
      return contextSummary(snapshot);
    } catch (e) {
      console.error("[jarvis] contextSummary failed, falling back to empty:", e);
      return "(контекст расчёта недоступен)";
    }
  })();

  const res = await fetch(`${provider.baseUrl}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: provider.model,
      temperature: 0.25,
      max_tokens: 700,
      stream: false,
      messages: [
        {
          role: "system",
          content: `${SYSTEM}\n\n=== ТЕКУЩИЙ КОНТЕКСТ ===\n${summary}`,
        },
        ...history.slice(-6).map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content: question },
      ],
    }),
    signal: AbortSignal.timeout(provider.timeoutMs),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${provider.name} ${res.status}: ${text.slice(0, 180)}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const raw = data.choices?.[0]?.message?.content ?? "";
  const answer = stripThinking(raw);
  if (!answer) throw new Error("Пустой ответ модели");
  return answer;
}

function fallbackAnswer(snapshot: JarvisSnapshot, reason?: string): string {
  let base: string;
  if (snapshot.kind === "bending" && snapshot.results) {
    base = `Я отвечаю по вашему расчёту «${snapshot.name}» (${snapshot.material}, s=${snapshot.thickness} мм, развёртка ${Math.round(snapshot.results.flatLength)} мм).`;
  } else if (snapshot.kind === "quote" && snapshot.totals) {
    base = `Я вижу текущее КП: ${snapshot.items.length} позиций на ${Math.round(snapshot.totals.totalClient).toLocaleString("ru-RU")} ₽.`;
  } else {
    base = `Откройте «Технологу» или «Менеджеру» — я подхвачу параметры с экрана.`;
  }

  return [
    reason ?? `Не нашёл эту тему в инженерной базе, а языковая модель не подключена.`,
    ``,
    base,
    ``,
    `Спросите иначе — например: «минимальная полка», «какое усилие», «проверь деталь», «сколько листов», «сможем согнуть на нашем станке», «что прислать для заказа».`,
    ``,
    `Свободные ответы включаются переменной OLLAMA_URL (локальная модель) либо ключом OPENAI_API_KEY / OPENROUTER_API_KEY / DEEPSEEK_API_KEY / GROQ_API_KEY.`,
  ].join("\n");
}

/** Диагностика: какой провайдер подхватился и жив ли он */
export async function GET() {
  const p = resolveProvider();
  if (!p) {
    return NextResponse.json({
      llm: false,
      provider: null,
      hint: "Задайте OLLAMA_URL (например http://192.168.10.21:11434) или ключ облачного провайдера.",
    });
  }

  let reachable = false;
  let detail = "";
  try {
    const headers: Record<string, string> = {};
    if (p.key) headers.Authorization = `Bearer ${p.key}`;
    const r = await fetch(`${p.baseUrl}/models`, {
      headers,
      signal: AbortSignal.timeout(6000),
    });
    reachable = r.ok;
    if (!r.ok) detail = `HTTP ${r.status}`;
  } catch (e) {
    detail = e instanceof Error ? e.message : "нет связи";
  }

  return NextResponse.json({
    llm: true,
    provider: p.name,
    model: p.model,
    baseUrl: p.baseUrl,
    reachable,
    detail: detail || undefined,
  });
}

export async function POST(req: Request) {
  let body: {
    question?: string;
    context?: unknown;
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

  const snapshot = sanitizeSnapshot(body.context);
  const history = Array.isArray(body.history) ? body.history : [];

  // 0. MES-интенты — производственная очередь (требуют БД)
  try {
    const mes = await askMes(question);
    if (mes) {
      return NextResponse.json({
        answer: mes.answer,
        source: "expert",
        intent: mes.intent,
      });
    }
  } catch (e) {
    console.error("[jarvis] askMes failed:", e);
  }

  // 1. Инженерный движок — числа только из расчёта
  let expert: { answer: string; intent: string; score: number } | null = null;
  try {
    expert = askExpert(question, snapshot);
  } catch (e) {
    console.error("[jarvis] askExpert failed:", e);
    // не роняем роут — продолжим к LLM
  }

  if (expert) {
    return NextResponse.json({
      answer: expert.answer,
      source: "expert",
      intent: expert.intent,
    });
  }

  // 2. Языковая модель
  const provider = resolveProvider();
  if (provider) {
    try {
      const answer = await callLlm(provider, question, snapshot, history);
      return NextResponse.json({
        answer,
        source: "llm",
        model: provider.model,
        provider: provider.name,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "ошибка сети";
      const timedOut = /timeout|abort/i.test(msg);
      return NextResponse.json({
        answer: fallbackAnswer(
          snapshot,
          timedOut
            ? `Модель ${provider.model} не ответила за ${Math.round(provider.timeoutMs / 1000)} с — на слабом железе это бывает при первой загрузке в память. Повторите запрос.`
            : `Модель недоступна: ${msg}`
        ),
        source: "fallback",
      });
    }
  }

  // 3. Честная заглушка с подсказками
  return NextResponse.json({ answer: fallbackAnswer(snapshot), source: "fallback" });
}
