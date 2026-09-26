import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  DraftingCompass,
  FileSpreadsheet,
  Users,
  Banknote,
  FileDown,
  Shapes,
  Scan,
  Factory,
} from "lucide-react";
import { db } from "@/db";
import { bendingCalculations, quotes, clients } from "@/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import { dt, rub } from "@/lib/format";

export const dynamic = "force-dynamic";

interface Stats {
  bends: number;
  quotes: number;
  clients: number;
  turnover: number;
}

interface FeedItem {
  kind: "bending" | "quote";
  id: number;
  title: string;
  subtitle: string;
  href: string;
  createdAt: Date;
}

async function loadData(): Promise<{ stats: Stats; feed: FeedItem[] }> {
  try {
    const [[b], [q], [c], [t]] = await Promise.all([
      db.select({ c: sql<number>`count(*)::int` }).from(bendingCalculations),
      db.select({ c: sql<number>`count(*)::int` }).from(quotes),
      db.select({ c: sql<number>`count(*)::int` }).from(clients),
      db.select({ s: sql<number>`coalesce(sum(${quotes.total}),0)::float` }).from(quotes),
    ]);

    const [bends, qps] = await Promise.all([
      db
        .select({
          id: bendingCalculations.id,
          name: bendingCalculations.name,
          thickness: bendingCalculations.thickness,
          createdAt: bendingCalculations.createdAt,
          clientName: clients.name,
        })
        .from(bendingCalculations)
        .leftJoin(clients, eq(bendingCalculations.clientId, clients.id))
        .orderBy(desc(bendingCalculations.createdAt))
        .limit(6),
      db
        .select({
          id: quotes.id,
          number: quotes.number,
          total: quotes.total,
          createdAt: quotes.createdAt,
          clientName: clients.name,
        })
        .from(quotes)
        .leftJoin(clients, eq(quotes.clientId, clients.id))
        .orderBy(desc(quotes.createdAt))
        .limit(6),
    ]);

    const feed: FeedItem[] = [
      ...bends.map((x) => ({
        kind: "bending" as const,
        id: x.id,
        title: x.name,
        subtitle: [`s=${x.thickness} мм`, x.clientName].filter(Boolean).join(" · "),
        href: `/bending?load=${x.id}`,
        createdAt: x.createdAt,
      })),
      ...qps.map((x) => ({
        kind: "quote" as const,
        id: x.id,
        title: x.number,
        subtitle: [x.clientName ?? "без клиента", rub(x.total)].join(" · "),
        href: `/kp?load=${x.id}`,
        createdAt: x.createdAt,
      })),
    ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return {
      stats: { bends: b.c, quotes: q.c, clients: c.c, turnover: t.s },
      feed: feed.slice(0, 7),
    };
  } catch {
    return {
      stats: { bends: 0, quotes: 0, clients: 0, turnover: 0 },
      feed: [],
    };
  }
}

const PIPELINE = [
  { icon: Scan, label: "Чертёж / ТЗ" },
  { icon: Shapes, label: "Развёртка" },
  { icon: Banknote, label: "Цена" },
  { icon: FileDown, label: "DXF" },
  { icon: Factory, label: "Производство" },
  { icon: FileSpreadsheet, label: "КП клиенту" },
];

export default async function Dashboard() {
  const { stats, feed } = await loadData();

  const statCards = [
    { icon: DraftingCompass, label: "Расчётов развёрток", value: stats.bends },
    { icon: FileSpreadsheet, label: "КП выставлено", value: stats.quotes },
    { icon: Users, label: "Клиентов в базе", value: stats.clients },
    { icon: Banknote, label: "Оборот по КП", value: rub(stats.turnover) },
  ];

  return (
    <div className="space-y-10">
      {/* ---------- HERO ---------- */}
      <section className="grid gap-6 lg:grid-cols-[1.25fr_1fr]">
        <div className="panel corner panel-pad relative flex flex-col justify-between overflow-hidden p-8 sm:p-10">
          <div className="sweep" />
          <div>
            <p className="micro rise">Единый портал · консолидация завершена</p>
            <h1 className="rise rise-1 mt-5 font-display text-[clamp(26px,4vw,44px)] font-semibold leading-[1.08]">
              От чертежа до цены
              <br />
              <span className="text-accent">в одном окне</span>
            </h1>
            <p className="rise rise-2 mt-5 max-w-md text-sm leading-relaxed text-steel">
              Инженерное ядро гибки и коммерческий модуль КП объединены:
              общая база клиентов, единая история расчётов и один экспорт DXF
              для лазера и гибочного станка.
            </p>
          </div>
          <div className="rise rise-3 mt-8 flex flex-wrap gap-3">
            <Link href="/bending" className="btn btn-primary">
              <DraftingCompass size={14} /> Расчёт развёртки
            </Link>
            <Link href="/kp" className="btn btn-outline">
              <FileSpreadsheet size={14} /> Новое КП
            </Link>
          </div>
        </div>

        <div className="panel corner relative min-h-[280px] overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://images.pexels.com/photos/17180807/pexels-photo-17180807.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200"
            alt="Лазерная резка металла"
            className="absolute inset-0 h-full w-full object-cover opacity-70"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-bg via-transparent to-transparent" />
          <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between">
            <div>
              <p className="micro">Цех · Санкт-Петербург</p>
              <p className="mt-1 font-display text-sm font-medium">
                Лазер · Гибка · Порошковая покраска
              </p>
            </div>
            <p className="num text-[11px] text-steel">50.1247 / 2026</p>
          </div>
        </div>
      </section>

      {/* ---------- STATS ---------- */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {statCards.map((s, i) => {
          const Icon = s.icon;
          return (
            <div
              key={s.label}
              className={`panel panel-pad rise rise-${(i + 1) as 1 | 2 | 3 | 4}`}
            >
              <div className="flex items-center justify-between">
                <p className="micro">{s.label}</p>
                <Icon size={15} className="text-steel" strokeWidth={1.6} />
              </div>
              <p className="num mt-3 text-2xl text-ink sm:text-3xl">{s.value}</p>
            </div>
          );
        })}
      </section>

      {/* ---------- MODULES ---------- */}
      <section className="grid gap-4 lg:grid-cols-2">
        <Link
          href="/bending"
          className="panel corner group relative overflow-hidden p-7 transition-colors hover:border-accent/50"
        >
          <div className="flex items-start justify-between">
            <div className="flex h-11 w-11 items-center justify-center border border-line bg-panel2">
              <DraftingCompass size={20} className="text-accent" strokeWidth={1.6} />
            </div>
            <ArrowUpRight
              size={18}
              className="text-steel transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-accent"
            />
          </div>
          <p className="micro mt-6">Модуль · технологу</p>
          <h2 className="mt-2 font-display text-xl font-semibold">
            Гибка и развёртка
          </h2>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-steel">
            K-фактор, BD/BA, подбор матрицы V и радиуса, усилие в тоннах,
            минимальные полки. Превью профиля на SVG — работает на любом
            телефоне без WebGL. Экспорт DXF со слоями CUT / BEND / TEXT.
          </p>
          <p className="mt-5 font-mono text-[11px] uppercase tracking-[0.14em] text-accent">
            Открыть калькулятор <ArrowRight size={11} className="inline" />
          </p>
        </Link>

        <Link
          href="/kp"
          className="panel corner group relative overflow-hidden p-7 transition-colors hover:border-accent/50"
        >
          <div className="flex items-start justify-between">
            <div className="flex h-11 w-11 items-center justify-center border border-line bg-panel2">
              <FileSpreadsheet size={20} className="text-accent" strokeWidth={1.6} />
            </div>
            <ArrowUpRight
              size={18}
              className="text-steel transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-accent"
            />
          </div>
          <p className="micro mt-6">Модуль · менеджеру</p>
          <h2 className="mt-2 font-display text-xl font-semibold">
            Коммерческое предложение
          </h2>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-steel">
            Тарифная сетка лазерной резки и гибки, масса и металл, врезки,
            покраска, скидки и НДС. Кнопка «Развёртка» у позиции прокидывает
            параметры в инженерный модуль. Печать КП в PDF.
          </p>
          <p className="mt-5 font-mono text-[11px] uppercase tracking-[0.14em] text-accent">
            Собрать КП <ArrowRight size={11} className="inline" />
          </p>
        </Link>
      </section>

      {/* ---------- PIPELINE + FEED ---------- */}
      <section className="grid gap-4 lg:grid-cols-[1fr_1.15fr]">
        <div className="panel panel-pad">
          <p className="micro">Полный цикл</p>
          <div className="mt-5 space-y-1">
            {PIPELINE.map((p, i) => {
              const Icon = p.icon;
              return (
                <div
                  key={p.label}
                  className="flex items-center gap-4 border-b border-line/50 py-3 last:border-none"
                >
                  <span className="num w-6 text-[11px] text-steel">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <Icon size={15} className="text-steel" strokeWidth={1.6} />
                  <span className="font-mono text-[12px] uppercase tracking-[0.12em] text-ghost">
                    {p.label}
                  </span>
                  {i < PIPELINE.length - 1 && (
                    <span className="ml-auto hidden text-steel/40 sm:block">───→</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="panel panel-pad">
          <div className="flex items-center justify-between">
            <p className="micro">Последние операции</p>
            <Link href="/history" className="btn btn-ghost py-1! text-[10px]!">
              Вся история <ArrowRight size={11} />
            </Link>
          </div>
          <div className="mt-4">
            {feed.length === 0 && (
              <p className="py-10 text-center text-sm text-steel">
                Пока пусто — сделайте первый расчёт или КП.
              </p>
            )}
            {feed.map((f) => (
              <Link
                key={`${f.kind}-${f.id}`}
                href={f.href}
                className="group flex items-center gap-4 border-b border-line/50 py-3 transition-colors last:border-none hover:bg-ink/[0.02]"
              >
                <span
                  className={`chip ${
                    f.kind === "bending" ? "text-amber!" : "text-accent!"
                  }`}
                >
                  {f.kind === "bending" ? "Развёртка" : "КП"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-ink">
                    {f.title}
                  </span>
                  <span className="block truncate text-xs text-steel">
                    {f.subtitle || "—"}
                  </span>
                </span>
                <span className="num hidden text-[11px] text-steel sm:block">
                  {dt(f.createdAt)}
                </span>
                <ArrowRight
                  size={14}
                  className="text-steel opacity-0 transition-opacity group-hover:opacity-100"
                />
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
