"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CATEGORIES, money } from "@/lib/bot-constants";
import type { BotCommandDTO, ProductDTO } from "@/lib/bot-types";

type Tab = "sandbox" | "scripts" | "price" | "settings";

const TABS: { key: Tab; label: string; emoji: string }[] = [
  { key: "sandbox", label: "Песочница", emoji: "💬" },
  { key: "scripts", label: "Сценарии", emoji: "🧩" },
  { key: "price", label: "Прайс", emoji: "💰" },
  { key: "settings", label: "Настройки", emoji: "⚙️" },
];

export default function BotStudio() {
  const [tab, setTab] = useState<Tab>("sandbox");
  const [commands, setCommands] = useState<BotCommandDTO[]>([]);
  const [products, setProducts] = useState<ProductDTO[]>([]);

  const loadCommands = useCallback(async () => {
    const res = await fetch("/api/bot/commands", { cache: "no-store" });
    const data = (await res.json()) as { commands: BotCommandDTO[] };
    setCommands(data.commands);
  }, []);

  const loadProducts = useCallback(async () => {
    const res = await fetch("/api/products", { cache: "no-store" });
    const data = (await res.json()) as { products: ProductDTO[] };
    setProducts(data.products);
  }, []);

  useEffect(() => {
    void loadCommands();
    void loadProducts();
  }, [loadCommands, loadProducts]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-2xl font-semibold">🤖 Бот-студия</h1>
          <p className="text-sm text-slate-400">
            Сценарии @Fireprombot, прайс, уведомления и песочница — всё редактируется без деплоя
          </p>
        </div>
        <div className="ml-auto flex gap-1 rounded-xl border border-white/5 bg-white/5 p-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`rounded-lg px-3 py-1.5 text-sm transition ${
                tab === t.key ? "bg-orange-500 text-white" : "text-slate-300 hover:bg-white/5"
              }`}
            >
              {t.emoji} <span className="hidden sm:inline">{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {tab === "sandbox" && <Sandbox commands={commands} />}
      {tab === "scripts" && <Scripts commands={commands} reload={loadCommands} />}
      {tab === "price" && <Price products={products} reload={loadProducts} />}
      {tab === "settings" && <SettingsTab />}
    </div>
  );
}

/* ----------------------------- Песочница ----------------------------- */

type Msg = { from: "user" | "bot"; text: string };

function Sandbox({ commands }: { commands: BotCommandDTO[] }) {
  const [messages, setMessages] = useState<Msg[]>([
    { from: "bot", text: "Песочница бота. Нажмите кнопку меню или напишите запрос — логика та же, что в Telegram." },
  ]);
  const [input, setInput] = useState("");
  const [keyboard, setKeyboard] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const chatId = useRef(`sandbox-${Math.random().toString(36).slice(2, 8)}`);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setKeyboard(commands.filter((c) => c.active && c.button).map((c) => c.button!));
  }, [commands]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async (text: string) => {
    if (!text.trim() || busy) return;
    setMessages((m) => [...m, { from: "user", text }]);
    setInput("");
    setBusy(true);
    const res = await fetch("/api/bot/simulate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, chatId: chatId.current }),
    });
    const data = (await res.json()) as { replies: string[]; keyboard: string[]; leadId?: number };
    setMessages((m) => [...m, ...data.replies.map((r) => ({ from: "bot" as const, text: r }))]);
    if (data.keyboard?.length) setKeyboard(data.keyboard);
    if (data.leadId) {
      setMessages((m) => [...m, { from: "bot", text: `🛎 Менеджер уведомлён. Заявка #${data.leadId} в портале /leads.` }]);
    }
    setBusy(false);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="flex h-[560px] flex-col rounded-2xl border border-white/10 bg-white/[0.03]">
        <div className="flex items-center gap-2 border-b border-white/5 px-4 py-3">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-sky-500/20">✈️</span>
          <div>
            <div className="text-sm font-medium">@Fireprombot</div>
            <div className="text-[11px] text-emerald-400">онлайн · песочница</div>
          </div>
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto p-4">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.from === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${
                  m.from === "user"
                    ? "rounded-br-sm bg-orange-500 text-white"
                    : "rounded-bl-sm border border-white/5 bg-white/[0.06] text-slate-100"
                }`}
                dangerouslySetInnerHTML={{ __html: escapeAllowB(m.text) }}
              />
            </div>
          ))}
          {busy && <div className="text-xs text-slate-500">бот печатает…</div>}
          <div ref={bottom} />
        </div>

        <div className="border-t border-white/5 p-3">
          <div className="mb-2 flex flex-wrap gap-1.5">
            {keyboard.map((k) => (
              <button
                key={k}
                onClick={() => send(k)}
                className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs transition hover:bg-white/10"
              >
                {k}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send(input)}
              placeholder="Сообщение клиента…"
              className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-orange-400/50"
            />
            <button
              onClick={() => send(input)}
              className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-400"
            >
              ➤
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Что умеет бот</h3>
          <ul className="mt-3 space-y-2 text-slate-300">
            <li>🧩 команды и кнопки из БД (вкладка «Сценарии»)</li>
            <li>💰 прайс подставляется автоматически</li>
            <li>🔎 поиск по каталогу в свободном тексте</li>
            <li>📞 распознаёт телефон и создаёт заявку</li>
            <li>✈️ сразу уведомляет менеджера в Telegram</li>
          </ul>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Попробуйте</h3>
          <div className="mt-3 space-y-1.5">
            {["/price", "нужна дверь EI-60 900х2100", "стеллажи на склад", "Перезвоните: +7 916 555-12-34"].map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="block w-full rounded-lg border border-white/5 bg-white/5 px-3 py-1.5 text-left text-xs hover:bg-white/10"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function escapeAllowB(text: string) {
  const esc = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return esc.replace(/&lt;b&gt;/g, "<b>").replace(/&lt;\/b&gt;/g, "</b>");
}

/* ------------------------------ Сценарии ------------------------------ */

function Scripts({ commands, reload }: { commands: BotCommandDTO[]; reload: () => Promise<void> }) {
  const [draft, setDraft] = useState({ command: "", button: "", title: "", reply: "" });

  const update = async (id: number, patch: Partial<BotCommandDTO>) => {
    await fetch(`/api/bot/commands/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    await reload();
  };

  const create = async () => {
    if (!draft.command.trim()) return;
    await fetch("/api/bot/commands", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...draft, title: draft.title || draft.command }),
    });
    setDraft({ command: "", button: "", title: "", reply: "" });
    await reload();
  };

  return (
    <div className="space-y-3">
      {commands.map((c) => (
        <CommandRow key={c.id} cmd={c} onSave={(patch) => update(c.id, patch)} onDelete={async () => {
          await fetch(`/api/bot/commands/${c.id}`, { method: "DELETE" });
          await reload();
        }} />
      ))}

      <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-4">
        <h3 className="text-sm font-semibold">Новая команда</h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <input
            value={draft.command}
            onChange={(e) => setDraft({ ...draft, command: e.target.value })}
            placeholder="/montage"
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-orange-400/50"
          />
          <input
            value={draft.button}
            onChange={(e) => setDraft({ ...draft, button: e.target.value })}
            placeholder="🔧 Монтаж"
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-orange-400/50"
          />
          <input
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            placeholder="Название"
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-orange-400/50"
          />
        </div>
        <textarea
          value={draft.reply}
          onChange={(e) => setDraft({ ...draft, reply: e.target.value })}
          rows={2}
          placeholder="Текст ответа бота"
          className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-orange-400/50"
        />
        <button
          onClick={create}
          className="mt-2 rounded-xl bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-400"
        >
          Добавить
        </button>
      </div>
    </div>
  );
}

function CommandRow({
  cmd,
  onSave,
  onDelete,
}: {
  cmd: BotCommandDTO;
  onSave: (patch: Partial<BotCommandDTO>) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [reply, setReply] = useState(cmd.reply);
  const [button, setButton] = useState(cmd.button ?? "");
  const dirty = reply !== cmd.reply || button !== (cmd.button ?? "");

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <code className="rounded-lg bg-orange-500/15 px-2 py-1 text-sm text-orange-300">{cmd.command}</code>
        <span className="text-sm text-slate-300">{cmd.title}</span>
        <span className="text-xs text-slate-500">{cmd.hits} вызовов</span>
        <div className="ml-auto flex items-center gap-2">
          <Toggle label="прайс" value={cmd.showPrices} onChange={(v) => onSave({ showPrices: v })} />
          <Toggle label="заявка" value={cmd.collectLead} onChange={(v) => onSave({ collectLead: v })} />
          <Toggle label="вкл" value={cmd.active} onChange={(v) => onSave({ active: v })} />
          <button onClick={onDelete} className="rounded-lg border border-white/10 px-2 py-1 text-xs hover:bg-rose-500/20">
            🗑
          </button>
        </div>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-[200px_1fr]">
        <input
          value={button}
          onChange={(e) => setButton(e.target.value)}
          placeholder="кнопка меню"
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-orange-400/50"
        />
        <textarea
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          rows={2}
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-orange-400/50"
        />
      </div>
      {dirty && (
        <button
          onClick={() => onSave({ reply, button })}
          className="mt-2 rounded-lg bg-emerald-500/90 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-400"
        >
          Сохранить
        </button>
      )}
    </div>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={`rounded-lg border px-2 py-1 text-xs transition ${
        value ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-300" : "border-white/10 bg-white/5 text-slate-400"
      }`}
    >
      {label}
    </button>
  );
}

/* -------------------------------- Прайс ------------------------------- */

function Price({ products, reload }: { products: ProductDTO[]; reload: () => Promise<void> }) {
  const [draft, setDraft] = useState({ title: "", category: "doors", priceFrom: "", unit: "шт", description: "" });

  const create = async () => {
    if (!draft.title.trim()) return;
    await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...draft, priceFrom: Number(draft.priceFrom) || 0 }),
    });
    setDraft({ title: "", category: "doors", priceFrom: "", unit: "шт", description: "" });
    await reload();
  };

  return (
    <div className="space-y-4">
      {CATEGORIES.map((cat) => {
        const rows = products.filter((p) => p.category === cat.key);
        if (!rows.length) return null;
        return (
          <div key={cat.key} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
              {cat.emoji} {cat.label}
            </h3>
            <div className="mt-3 space-y-2">
              {rows.map((p) => (
                <PriceRow key={p.id} product={p} reload={reload} />
              ))}
            </div>
          </div>
        );
      })}

      <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-4">
        <h3 className="text-sm font-semibold">Новая позиция прайса</h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-4">
          <input
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            placeholder="Название"
            className="sm:col-span-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-orange-400/50"
          />
          <select
            value={draft.category}
            onChange={(e) => setDraft({ ...draft, category: e.target.value })}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none"
          >
            {CATEGORIES.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
          <input
            value={draft.priceFrom}
            onChange={(e) => setDraft({ ...draft, priceFrom: e.target.value.replace(/\D/g, "") })}
            placeholder="Цена от, ₽"
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-orange-400/50"
          />
        </div>
        <input
          value={draft.description}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          placeholder="Короткое описание для бота"
          className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-orange-400/50"
        />
        <button
          onClick={create}
          className="mt-2 rounded-xl bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-400"
        >
          Добавить в прайс
        </button>
      </div>
    </div>
  );
}

function PriceRow({ product, reload }: { product: ProductDTO; reload: () => Promise<void> }) {
  const [price, setPrice] = useState(String(product.priceFrom));

  const save = async (patch: Record<string, unknown>) => {
    await fetch(`/api/products/${product.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    await reload();
  };

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/5 bg-white/5 px-3 py-2">
      <div className="min-w-[200px] flex-1">
        <div className="text-sm font-medium">{product.title}</div>
        <div className="text-xs text-slate-400">{product.description}</div>
      </div>
      <div className="flex items-center gap-1 text-sm">
        <span className="text-slate-500">от</span>
        <input
          value={price}
          onChange={(e) => setPrice(e.target.value.replace(/\D/g, ""))}
          onBlur={() => Number(price) !== product.priceFrom && save({ priceFrom: Number(price) })}
          className="w-24 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-right text-sm outline-none focus:border-orange-400/50"
        />
        <span className="text-slate-500">₽/{product.unit}</span>
      </div>
      <span className="hidden text-xs text-slate-500 sm:inline">{money(product.priceFrom)}</span>
      <Toggle label={product.active ? "в прайсе" : "скрыт"} value={product.active} onChange={(v) => save({ active: v })} />
      <button
        onClick={async () => {
          await fetch(`/api/products/${product.id}`, { method: "DELETE" });
          await reload();
        }}
        className="rounded-lg border border-white/10 px-2 py-1 text-xs hover:bg-rose-500/20"
      >
        🗑
      </button>
    </div>
  );
}

/* ------------------------------ Настройки ------------------------------ */

function SettingsTab() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [tokenOk, setTokenOk] = useState(false);
  const [saved, setSaved] = useState(false);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
    void (async () => {
      const res = await fetch("/api/bot/settings", { cache: "no-store" });
      const data = (await res.json()) as { settings: Record<string, string>; tokenConfigured: boolean };
      setSettings(data.settings);
      setTokenOk(data.tokenConfigured);
    })();
  }, []);

  const save = async () => {
    await fetch("/api/bot/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const field = (key: string, label: string, hint?: string, textarea = false) => (
    <div>
      <label className="text-xs uppercase tracking-wide text-slate-400">{label}</label>
      {textarea ? (
        <textarea
          rows={5}
          value={settings[key] ?? ""}
          onChange={(e) => setSettings({ ...settings, [key]: e.target.value })}
          className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-orange-400/50"
        />
      ) : (
        <input
          value={settings[key] ?? ""}
          onChange={(e) => setSettings({ ...settings, [key]: e.target.value })}
          className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-orange-400/50"
        />
      )}
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Уведомления менеджеру</h3>
        {field("manager_chat_id", "Chat ID менеджера", "Узнать: напишите боту и откройте getUpdates")}
        {field("bot_username", "Бот", "например @Fireprombot")}
        {field("working_hours", "Режим работы")}
        <div className="flex items-center gap-2">
          <Toggle
            label={settings.notify_enabled === "false" ? "уведомления выключены" : "уведомления включены"}
            value={settings.notify_enabled !== "false"}
            onChange={(v) => setSettings({ ...settings, notify_enabled: String(v) })}
          />
        </div>
        {field("notify_template", "Шаблон сообщения", "Плейсхолдеры: {id} {name} {phone} {product} {message} {source} {tg}", true)}
        <button
          onClick={save}
          className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-400"
        >
          {saved ? "Сохранено ✓" : "Сохранить настройки"}
        </button>
      </div>

      <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-sm">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Подключение Telegram</h3>
        <div className="flex items-center justify-between rounded-xl border border-white/5 bg-white/5 px-3 py-2">
          <span>TELEGRAM_BOT_TOKEN</span>
          <span className={tokenOk ? "text-emerald-400" : "text-amber-400"}>
            {tokenOk ? "задан ✓" : "не задан — симуляция"}
          </span>
        </div>
        <div className="rounded-xl border border-white/5 bg-white/5 p-3">
          <div className="text-xs text-slate-400">1. Поставить webhook</div>
          <code className="mt-1 block break-all text-xs text-orange-300">
            curl &quot;https://api.telegram.org/bot$TOKEN/setWebhook?url={origin}/api/bot/webhook&quot;
          </code>
        </div>
        <div className="rounded-xl border border-white/5 bg-white/5 p-3">
          <div className="text-xs text-slate-400">2. Заявка с сайта</div>
          <code className="mt-1 block whitespace-pre-wrap break-all text-xs text-orange-300">{`curl -X POST ${origin}/api/leads -H 'Content-Type: application/json' \\
  -d '{"name":"Иван","phone":"+79161112233","product":"EI-60","message":"6 шт"}'`}</code>
        </div>
        <div className="rounded-xl border border-white/5 bg-white/5 p-3">
          <div className="text-xs text-slate-400">3. Проверка</div>
          <code className="mt-1 block break-all text-xs text-orange-300">curl {origin}/api/health</code>
        </div>
        <p className="text-xs text-slate-500">
          Если токен не задан, бот и уведомления работают в режиме симуляции: текст уведомления всё равно
          сохраняется в журнал и виден в карточке заявки.
        </p>
      </div>
    </div>
  );
}
