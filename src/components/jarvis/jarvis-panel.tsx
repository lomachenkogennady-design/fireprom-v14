"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Bot, X, Send, Eraser, Cpu, Sparkles, CircleAlert } from "lucide-react";
import { useJarvis } from "@/lib/jarvis/provider";
import { suggestions } from "@/lib/jarvis/expert";
import { MATERIALS } from "@/lib/materials";
import { clsx } from "@/lib/format";

/** Мини-разметка: **жирный** и маркеры списка */
function RichText({ text }: { text: string }) {
  return (
    <>
      {text.split("\n").map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-2" />;
        const parts = line.split(/(\*\*[^*]+\*\*)/g);
        const warn = /^[⚠✓ℹ]/.test(line.trim());
        return (
          <p
            key={i}
            className={clsx(
              "leading-relaxed",
              line.startsWith("•") && "pl-2",
              warn && line.startsWith("⚠") && "text-warn",
              warn && line.startsWith("✓") && "text-ok"
            )}
          >
            {parts.map((p, j) =>
              p.startsWith("**") && p.endsWith("**") ? (
                <strong key={j} className="num font-semibold text-ink">
                  {p.slice(2, -2)}
                </strong>
              ) : (
                <span key={j}>{p}</span>
              )
            )}
          </p>
        );
      })}
    </>
  );
}

function ContextBadge() {
  const { snapshot } = useJarvis();
  if (snapshot.kind === "bending") {
    return (
      <span className="chip border-ok/40! text-ok!" title="Jarvis видит текущий расчёт">
        <Cpu size={10} /> {MATERIALS[snapshot.material].short} · s={snapshot.thickness} ·{" "}
        {snapshot.bends.length} гиб.
      </span>
    );
  }
  if (snapshot.kind === "quote") {
    return (
      <span className="chip border-ok/40! text-ok!" title="Jarvis видит текущее КП">
        <Cpu size={10} /> КП · {snapshot.items.length} поз.
      </span>
    );
  }
  return (
    <span className="chip" title="Откройте расчёт, чтобы Jarvis видел параметры">
      <CircleAlert size={10} /> нет расчёта
    </span>
  );
}

export function JarvisPanel() {
  const { snapshot, messages, pushMessage, clear, open, setOpen, unread } = useJarvis();
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [messages, open, busy]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 120);
  }, [open]);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    setInput("");
    pushMessage({ role: "user", content: q });
    setBusy(true);
    try {
      const res = await fetch("/api/jarvis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, context: snapshot, history: messages.slice(-6) }),
      });
      const data = await res.json();
      pushMessage({
        role: "assistant",
        content: data.answer ?? "Пустой ответ",
        source: data.source,
      });
    } catch {
      pushMessage({
        role: "assistant",
        content: "Сеть недоступна — повторите запрос.",
        source: "fallback",
      });
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void ask(input);
  }

  const chips = suggestions(snapshot);

  return (
    <>
      {/* ---------- плавающая кнопка ---------- */}
      <button
        onClick={() => setOpen(!open)}
        aria-label="Jarvis — инженерный ассистент"
        className={clsx(
          "fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center border transition-all",
          open
            ? "border-line bg-panel2 text-steel"
            : "border-accent/60 bg-accent text-accent-ink hover:scale-105"
        )}
        style={
          open
            ? undefined
            : { boxShadow: "0 0 28px rgba(255,92,26,.45), 0 8px 24px rgba(0,0,0,.5)" }
        }
      >
        {open ? <X size={20} /> : <Bot size={22} />}
        {!open && unread > 0 && (
          <span className="num absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center bg-ok text-[10px] text-bg">
            {unread}
          </span>
        )}
      </button>

      {/* ---------- панель ---------- */}
      <div
        className={clsx(
          "panel corner fixed z-50 flex flex-col transition-all duration-300",
          "bottom-24 right-5 left-5 sm:left-auto sm:w-[420px]",
          "h-[min(560px,calc(100dvh-160px))]",
          open
            ? "pointer-events-auto translate-y-0 opacity-100"
            : "pointer-events-none translate-y-4 opacity-0"
        )}
      >
        {/* шапка */}
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div className="flex items-center gap-2">
            <Bot size={16} className="text-accent" />
            <span className="font-display text-sm font-semibold">Jarvis</span>
            <span className="micro">технолог</span>
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <button className="btn btn-ghost px-2! py-1!" onClick={clear} title="Очистить">
                <Eraser size={13} />
              </button>
            )}
            <button className="btn btn-ghost px-2! py-1!" onClick={() => setOpen(false)}>
              <X size={14} />
            </button>
          </div>
        </div>

        {/* индикатор контекста */}
        <div className="flex items-center gap-2 border-b border-line/60 px-4 py-2">
          <ContextBadge />
          <span className="micro ml-auto">видит экран</span>
        </div>

        {/* лента сообщений */}
        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4 text-[13px]">
          {messages.length === 0 && (
            <div className="space-y-3">
              <p className="text-sm leading-relaxed text-ghost">
                Я вижу параметры на вашем экране и отвечаю по ним — не по общим
                справочникам.
              </p>
              <p className="text-xs leading-relaxed text-steel">
                Числа (полка, K-фактор, усилие, цена) считаются из вашего расчёта,
                поэтому им можно доверять.
              </p>
            </div>
          )}

          {messages.map((m, i) => (
            <div
              key={i}
              className={clsx("flex", m.role === "user" ? "justify-end" : "justify-start")}
            >
              <div
                className={clsx(
                  "max-w-[90%] border px-3 py-2",
                  m.role === "user"
                    ? "border-accent/40 bg-accent/10 text-ink"
                    : "border-line bg-panel2 text-ghost"
                )}
              >
                {m.role === "assistant" && (
                  <div className="mb-1.5 flex items-center gap-1.5">
                    {m.source === "expert" ? (
                      <span className="micro text-ok!" title="Рассчитано из ваших параметров">
                        <Cpu size={9} className="mr-1 inline" />
                        расчёт
                      </span>
                    ) : m.source === "llm" ? (
                      <span className="micro text-amber!">
                        <Sparkles size={9} className="mr-1 inline" />
                        модель
                      </span>
                    ) : (
                      <span className="micro">подсказка</span>
                    )}
                  </div>
                )}
                <RichText text={m.content} />
              </div>
            </div>
          ))}

          {busy && (
            <div className="flex items-center gap-2 text-xs text-steel">
              <span className="inline-block h-1.5 w-1.5 animate-pulse bg-accent" />
              считаю…
            </div>
          )}
        </div>

        {/* подсказки */}
        {messages.length === 0 && (
          <div className="flex flex-wrap gap-1.5 border-t border-line/60 px-4 py-3">
            {chips.map((c) => (
              <button
                key={c}
                onClick={() => void ask(c)}
                className="chip transition-colors hover:border-accent/60 hover:text-ink"
              >
                {c}
              </button>
            ))}
          </div>
        )}

        {/* ввод */}
        <form onSubmit={onSubmit} className="flex gap-2 border-t border-line px-4 py-3">
          <input
            ref={inputRef}
            className="field"
            placeholder="Спросите про расчёт…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={busy}
          />
          <button type="submit" className="btn btn-primary px-3!" disabled={busy || !input.trim()}>
            <Send size={14} />
          </button>
        </form>
      </div>
    </>
  );
}
