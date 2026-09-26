"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  DraftingCompass,
  FileSpreadsheet,
  Users,
  Trash2,
  ArrowUpRight,
  UserPlus,
  RefreshCw,
} from "lucide-react";
import { dt, rub, clsx } from "@/lib/format";

interface BendRow {
  id: number;
  name: string;
  material: string;
  thickness: number;
  width: number;
  results: { flatLength?: number } | null;
  createdAt: string;
  clientName: string | null;
}

interface QuoteRow {
  id: number;
  number: string;
  total: number;
  itemCount: number;
  createdAt: string;
  clientName: string | null;
}

interface ClientRow {
  id: number;
  name: string;
  contact: string | null;
  phone: string | null;
  email: string | null;
  createdAt: string;
}

type Tab = "all" | "bending" | "quotes" | "clients";

const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "Все" },
  { key: "bending", label: "Развёртки" },
  { key: "quotes", label: "КП" },
  { key: "clients", label: "Клиенты" },
];

export function HistoryView() {
  const [tab, setTab] = useState<Tab>("all");
  const [bends, setBends] = useState<BendRow[]>([]);
  const [quotes, setQuotes] = useState<QuoteRow[]>([]);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [newClient, setNewClient] = useState("");
  const [newPhone, setNewPhone] = useState("");

  function load() {
    setLoading(true);
    Promise.all([
      fetch("/api/calculations").then((r) => r.json()).catch(() => []),
      fetch("/api/quotes").then((r) => r.json()).catch(() => []),
      fetch("/api/clients").then((r) => r.json()).catch(() => []),
    ]).then(([b, q, c]) => {
      setBends(Array.isArray(b) ? b : []);
      setQuotes(Array.isArray(q) ? q : []);
      setClients(Array.isArray(c) ? c : []);
      setLoading(false);
    });
  }

  useEffect(load, []);

  const merged = useMemo(() => {
    const all = [
      ...bends.map((b) => ({
        kind: "bending" as const,
        id: b.id,
        title: b.name,
        subtitle: [
          `s=${b.thickness} мм`,
          b.results?.flatLength ? `развёртка ${Math.round(b.results.flatLength)} мм` : null,
          b.clientName,
        ]
          .filter(Boolean)
          .join(" · "),
        href: `/bending?load=${b.id}`,
        createdAt: b.createdAt,
      })),
      ...quotes.map((q) => ({
        kind: "quote" as const,
        id: q.id,
        title: q.number,
        subtitle: [
          q.clientName ?? "без клиента",
          `${q.itemCount} поз.`,
          rub(q.total),
        ].join(" · "),
        href: `/kp?load=${q.id}`,
        createdAt: q.createdAt,
      })),
    ];
    return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [bends, quotes]);

  async function del(kind: "calculations" | "quotes" | "clients", id: number) {
    if (!confirm("Удалить запись?")) return;
    await fetch(`/api/${kind}/${id}`, { method: "DELETE" });
    load();
  }

  async function addClient() {
    const name = newClient.trim();
    if (!name) return;
    await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, phone: newPhone.trim() || null }),
    });
    setNewClient("");
    setNewPhone("");
    load();
  }

  const feed =
    tab === "all"
      ? merged
      : tab === "bending"
        ? merged.filter((m) => m.kind === "bending")
        : merged.filter((m) => m.kind === "quote");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={clsx(
              "chip transition-colors",
              tab === t.key ? "border-accent/70! text-accent!" : "hover:text-ink"
            )}
          >
            {t.key === "bending" && <DraftingCompass size={11} />}
            {t.key === "quotes" && <FileSpreadsheet size={11} />}
            {t.key === "clients" && <Users size={11} />}
            {t.label}
          </button>
        ))}
        <button className="btn btn-ghost ml-auto px-2! py-1.5!" onClick={load} title="Обновить">
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {tab !== "clients" ? (
        <div className="panel panel-pad">
          {feed.length === 0 && !loading && (
            <p className="py-12 text-center text-sm text-steel">
              Пусто. Записи появятся после первых расчётов.
            </p>
          )}
          {feed.map((f) => (
            <div
              key={`${f.kind}-${f.id}`}
              className="group flex items-center gap-4 border-b border-line/50 py-3 last:border-none"
            >
              <span className={clsx("chip", f.kind === "bending" ? "text-amber!" : "text-accent!")}>
                {f.kind === "bending" ? (
                  <DraftingCompass size={11} />
                ) : (
                  <FileSpreadsheet size={11} />
                )}
                {f.kind === "bending" ? "Развёртка" : "КП"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-ink">{f.title}</p>
                <p className="truncate text-xs text-steel">{f.subtitle}</p>
              </div>
              <span className="num hidden text-[11px] text-steel sm:block">{dt(f.createdAt)}</span>
              <Link href={f.href} className="btn btn-ghost px-2! py-1.5!" title="Открыть">
                <ArrowUpRight size={14} />
              </Link>
              <button
                className="btn btn-ghost px-2! py-1.5! opacity-0 transition-opacity hover:text-bad! group-hover:opacity-100"
                title="Удалить"
                onClick={() => del(f.kind === "bending" ? "calculations" : "quotes", f.id)}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="panel panel-pad">
            {clients.length === 0 && !loading && (
              <p className="py-12 text-center text-sm text-steel">База клиентов пуста.</p>
            )}
            {clients.map((c) => (
              <div
                key={c.id}
                className="group flex items-center gap-4 border-b border-line/50 py-3 last:border-none"
              >
                <div className="flex h-8 w-8 items-center justify-center border border-line bg-panel2">
                  <Users size={13} className="text-steel" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-ink">{c.name}</p>
                  <p className="truncate text-xs text-steel">
                    {[c.contact, c.phone, c.email].filter(Boolean).join(" · ") || "контакты не заполнены"}
                  </p>
                </div>
                <span className="num hidden text-[11px] text-steel sm:block">{dt(c.createdAt)}</span>
                <button
                  className="btn btn-ghost px-2! py-1.5! opacity-0 transition-opacity hover:text-bad! group-hover:opacity-100"
                  onClick={() => del("clients", c.id)}
                  title="Удалить"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>

          <div className="panel panel-pad h-fit">
            <p className="micro">Новый клиент</p>
            <input
              className="field mt-3"
              placeholder="ООО «Ромашка»"
              value={newClient}
              onChange={(e) => setNewClient(e.target.value)}
            />
            <input
              className="field mt-2"
              placeholder="Телефон"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
            />
            <button
              className="btn btn-primary mt-3 w-full"
              onClick={addClient}
              disabled={!newClient.trim()}
            >
              <UserPlus size={13} /> Добавить
            </button>
            <p className="mt-3 text-[11px] leading-relaxed text-steel">
              Клиенты общие для КП и расчётов гибки: при сохранении расчёта его можно
              привязать к заказчику.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
