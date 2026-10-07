"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PRIORITIES, STATUSES, formatDate, money, sourceMeta, statusMeta } from "@/lib/bot-constants";
import type { LeadDTO, LeadEventDTO, NotificationDTO } from "@/lib/bot-types";

type Detail = { lead: LeadDTO; events: LeadEventDTO[]; notifications: NotificationDTO[] };

export default function LeadsClient() {
  const router = useRouter();
  const params = useSearchParams();
  const initialId = Number(params.get("id")) || null;

  const [list, setList] = useState<LeadDTO[]>([]);
  const [status, setStatus] = useState<string>("all");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<number | null>(initialId);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);

  const flash = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3200);
  }, []);

  const loadList = useCallback(async () => {
    setLoading(true);
    const url = new URL("/api/leads", window.location.origin);
    if (status !== "all") url.searchParams.set("status", status);
    if (q.trim()) url.searchParams.set("q", q.trim());
    const res = await fetch(url.toString(), { cache: "no-store" });
    const data = (await res.json()) as { leads: LeadDTO[] };
    setList(data.leads);
    setLoading(false);
    setSelected((cur) => cur ?? data.leads[0]?.id ?? null);
  }, [status, q]);

  const loadDetail = useCallback(async (id: number) => {
    const res = await fetch(`/api/leads/${id}`, { cache: "no-store" });
    if (!res.ok) {
      setDetail(null);
      return;
    }
    setDetail((await res.json()) as Detail);
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    if (selected) void loadDetail(selected);
  }, [selected, loadDetail]);

  const patch = async (body: Record<string, unknown>) => {
    if (!selected) return;
    await fetch(`/api/leads/${selected}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    await Promise.all([loadDetail(selected), loadList()]);
  };

  const notify = async () => {
    if (!selected) return;
    const res = await fetch(`/api/leads/${selected}/notify`, { method: "POST" });
    const data = (await res.json()) as { status: string; error?: string | null };
    flash(
      data.status === "sent"
        ? "✅ Уведомление ушло менеджеру в Telegram"
        : `⚠️ Симуляция: ${data.error ?? "токен/chat_id не заданы"} — текст записан в журнал`,
    );
    await loadDetail(selected);
  };

  const remove = async () => {
    if (!selected) return;
    await fetch(`/api/leads/${selected}`, { method: "DELETE" });
    setSelected(null);
    setDetail(null);
    await loadList();
    flash("Заявка удалена");
  };

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const l of list) map.set(l.status, (map.get(l.status) ?? 0) + 1);
    return map;
  }, [list]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-2xl font-semibold">🔥 Заявки</h1>
          <p className="text-sm text-slate-400">Сайт + Telegram-боты в одной ленте для менеджера</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Поиск: имя, телефон, текст…"
            className="w-56 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none placeholder:text-slate-500 focus:border-orange-400/50"
          />
          <button
            onClick={() => setShowNew(true)}
            className="rounded-xl bg-orange-500 px-3 py-2 text-sm font-medium text-white transition hover:bg-orange-400"
          >
            + Заявка
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {[{ key: "all", label: "Все", emoji: "📋" }, ...STATUSES].map((s) => (
          <button
            key={s.key}
            onClick={() => setStatus(s.key)}
            className={`rounded-xl border px-3 py-1.5 text-sm transition ${
              status === s.key
                ? "border-orange-400/60 bg-orange-500/15 text-orange-200"
                : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
            }`}
          >
            {s.emoji} {s.label}
            {s.key !== "all" && counts.get(s.key) ? (
              <span className="ml-1 text-xs text-slate-400">{counts.get(s.key)}</span>
            ) : null}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
        <div className="space-y-2">
          {loading && <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-slate-400">Загрузка…</div>}
          {!loading && list.length === 0 && (
            <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-center text-sm text-slate-400">
              Ничего не найдено
            </div>
          )}
          {list.map((lead) => {
            const st = statusMeta(lead.status);
            const src = sourceMeta(lead.source);
            const active = selected === lead.id;
            return (
              <button
                key={lead.id}
                onClick={() => {
                  setSelected(lead.id);
                  router.replace(`/leads?id=${lead.id}`, { scroll: false });
                }}
                className={`w-full rounded-2xl border p-4 text-left transition ${
                  active
                    ? "border-orange-400/60 bg-orange-500/10"
                    : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">
                    {lead.priority === "hot" ? "🔥 " : ""}
                    {lead.name}
                  </span>
                  <span className="ml-auto text-[11px] text-slate-500">#{lead.id}</span>
                </div>
                <div className="mt-1 line-clamp-2 text-xs text-slate-400">{lead.product ?? lead.message ?? "—"}</div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className={`rounded-full border px-2 py-0.5 text-[11px] ${st.color}`}>
                    {st.emoji} {st.label}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {src.emoji} {src.label}
                  </span>
                  <span className="ml-auto text-[11px] text-slate-500">{formatDate(lead.createdAt)}</span>
                </div>
              </button>
            );
          })}
        </div>

        <div>
          {!detail && (
            <div className="grid h-64 place-items-center rounded-2xl border border-white/10 bg-white/[0.03] text-sm text-slate-400">
              Выберите заявку слева
            </div>
          )}
          {detail && (
            <LeadDetail
              detail={detail}
              note={note}
              setNote={setNote}
              onPatch={patch}
              onNotify={notify}
              onDelete={remove}
            />
          )}
        </div>
      </div>

      {showNew && (
        <NewLeadModal
          onClose={() => setShowNew(false)}
          onCreated={async (id, notifyStatus) => {
            setShowNew(false);
            setSelected(id);
            await loadList();
            flash(
              notifyStatus === "sent"
                ? `Заявка #${id} создана, менеджер уведомлён в Telegram`
                : `Заявка #${id} создана (уведомление: ${notifyStatus})`,
            );
          }}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-white/10 bg-[#111827] px-4 py-3 text-sm shadow-2xl">
          {toast}
        </div>
      )}
    </div>
  );
}

function LeadDetail({
  detail,
  note,
  setNote,
  onPatch,
  onNotify,
  onDelete,
}: {
  detail: Detail;
  note: string;
  setNote: (v: string) => void;
  onPatch: (body: Record<string, unknown>) => Promise<void>;
  onNotify: () => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const { lead, events, notifications } = detail;
  const [amount, setAmount] = useState(lead.amount ? String(lead.amount) : "");
  const [manager, setManager] = useState(lead.manager ?? "");

  useEffect(() => {
    setAmount(lead.amount ? String(lead.amount) : "");
    setManager(lead.manager ?? "");
  }, [lead.id, lead.amount, lead.manager]);

  const src = sourceMeta(lead.source);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="flex flex-wrap items-start gap-3">
          <div>
            <h2 className="text-xl font-semibold">
              {lead.priority === "hot" ? "🔥 " : ""}
              {lead.name}
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-slate-400">
              <span>#{lead.id}</span>
              <span>
                {src.emoji} {src.label}
                {lead.botUsername ? ` · ${lead.botUsername}` : ""}
              </span>
              <span>{formatDate(lead.createdAt)}</span>
            </div>
          </div>
          <div className="ml-auto flex gap-2">
            <button
              onClick={onNotify}
              className="rounded-xl bg-sky-500/90 px-3 py-2 text-sm font-medium text-white transition hover:bg-sky-400"
            >
              ✈️ Уведомить менеджера
            </button>
            <button
              onClick={onDelete}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm transition hover:bg-rose-500/20"
            >
              🗑
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Телефон" value={lead.phone ?? "—"} href={lead.phone ? `tel:${lead.phone}` : undefined} />
          <Field label="E-mail" value={lead.email ?? "—"} href={lead.email ? `mailto:${lead.email}` : undefined} />
          <Field label="Telegram" value={lead.tgUsername ?? "—"} />
          <Field label="Продукт" value={lead.product ?? "—"} />
        </div>

        {lead.message && (
          <div className="mt-3 rounded-xl border border-white/5 bg-white/5 p-3 text-sm text-slate-200">
            💬 {lead.message}
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          {STATUSES.map((s) => (
            <button
              key={s.key}
              onClick={() => onPatch({ status: s.key })}
              className={`rounded-xl border px-3 py-1.5 text-sm transition ${
                lead.status === s.key ? s.color : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
              }`}
            >
              {s.emoji} {s.label}
            </button>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {PRIORITIES.map((p) => (
            <button
              key={p.key}
              onClick={() => onPatch({ priority: p.key })}
              className={`rounded-lg border px-2.5 py-1 text-xs transition ${
                lead.priority === p.key
                  ? "border-orange-400/60 bg-orange-500/15 text-orange-200"
                  : "border-white/10 bg-white/5 text-slate-400 hover:bg-white/10"
              }`}
            >
              {p.emoji} {p.label}
            </button>
          ))}
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))}
            onBlur={() => onPatch({ amount: amount === "" ? null : Number(amount) })}
            placeholder="Сумма, ₽"
            className="w-32 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs outline-none focus:border-orange-400/50"
          />
          <input
            value={manager}
            onChange={(e) => setManager(e.target.value)}
            onBlur={() => onPatch({ manager })}
            placeholder="Менеджер"
            className="w-32 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs outline-none focus:border-orange-400/50"
          />
          <span className="ml-auto text-xs text-slate-500">
            {lead.amount ? `Сделка: ${money(lead.amount)}` : "Сумма не указана"}
          </span>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Таймлайн</h3>
          <div className="mt-3 space-y-3">
            {events.map((e) => (
              <div key={e.id} className="relative border-l border-white/10 pl-4">
                <span className="absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full bg-orange-400" />
                <div className="text-sm text-slate-200">{e.text}</div>
                <div className="mt-0.5 text-[11px] text-slate-500">
                  {e.author} · {formatDate(e.createdAt)}
                </div>
              </div>
            ))}
            {events.length === 0 && <p className="text-sm text-slate-500">Событий пока нет.</p>}
          </div>

          <div className="mt-4">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Комментарий менеджера…"
              className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-sm outline-none placeholder:text-slate-500 focus:border-orange-400/50"
            />
            <button
              onClick={async () => {
                if (!note.trim()) return;
                await onPatch({ note });
                setNote("");
              }}
              className="mt-2 rounded-xl bg-white/10 px-3 py-1.5 text-sm transition hover:bg-white/20"
            >
              Добавить запись
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Уведомления менеджеру</h3>
          <div className="mt-3 space-y-2 text-xs">
            {notifications.length === 0 && <p className="text-slate-500">Ещё не отправлялись.</p>}
            {notifications.map((n) => (
              <div key={n.id} className="rounded-xl border border-white/5 bg-white/5 p-3">
                <div className="flex justify-between">
                  <span
                    className={
                      n.status === "sent" ? "text-emerald-400" : n.status === "failed" ? "text-rose-400" : "text-amber-400"
                    }
                  >
                    {n.status === "sent" ? "отправлено" : n.status === "failed" ? "ошибка" : "симуляция"}
                  </span>
                  <span className="text-slate-500">{formatDate(n.createdAt)}</span>
                </div>
                <pre className="mt-2 whitespace-pre-wrap font-sans text-slate-300">{n.text}</pre>
                {n.error && <div className="mt-1 text-rose-300/80">{n.error}</div>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, href }: { label: string; value: string; href?: string }) {
  return (
    <div className="rounded-xl border border-white/5 bg-white/5 px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
      {href ? (
        <a href={href} className="text-sm text-orange-300 hover:text-orange-200">
          {value}
        </a>
      ) : (
        <div className="text-sm">{value}</div>
      )}
    </div>
  );
}

function NewLeadModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (id: number, notifyStatus: string) => void | Promise<void>;
}) {
  const [form, setForm] = useState({ name: "", phone: "", product: "", message: "", source: "phone" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = (await res.json()) as { lead?: { id: number }; notify?: { status: string }; error?: string };
    setBusy(false);
    if (!res.ok || !data.lead) {
      setError(data.error ?? "Не удалось сохранить");
      return;
    }
    await onCreated(data.lead.id, data.notify?.status ?? "—");
  };

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0f1523] p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold">Новая заявка</h3>
        <div className="mt-4 space-y-2">
          {(
            [
              ["name", "Имя / компания"],
              ["phone", "Телефон"],
              ["product", "Что нужно"],
            ] as const
          ).map(([key, label]) => (
            <input
              key={key}
              value={form[key]}
              onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              placeholder={label}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-orange-400/50"
            />
          ))}
          <textarea
            value={form.message}
            onChange={(e) => setForm({ ...form, message: e.target.value })}
            rows={3}
            placeholder="Комментарий"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-orange-400/50"
          />
          <select
            value={form.source}
            onChange={(e) => setForm({ ...form, source: e.target.value })}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-orange-400/50"
          >
            <option value="phone">📞 Телефон</option>
            <option value="site">🌐 Сайт</option>
            <option value="telegram">✈️ Telegram</option>
            <option value="email">📧 Почта</option>
          </select>
        </div>
        {error && <p className="mt-2 text-sm text-rose-400">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-xl border border-white/10 px-3 py-2 text-sm hover:bg-white/5">
            Отмена
          </button>
          <button
            onClick={submit}
            disabled={busy}
            className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-orange-400 disabled:opacity-50"
          >
            {busy ? "Сохраняю…" : "Создать и уведомить"}
          </button>
        </div>
      </div>
    </div>
  );
}
