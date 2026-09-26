"use client";

import Link from "next/link";
import { CircleCheck, CircleAlert, CircleX, Cog, ArrowUpRight } from "lucide-react";
import type { MachineVerdict, CheckStatus } from "@/lib/machine";
import { MACHINE, overbendAngle } from "@/lib/machine";
import type { MaterialKey } from "@/lib/materials";
import { clsx } from "@/lib/format";

const ICON: Record<CheckStatus, typeof CircleCheck> = {
  ok: CircleCheck,
  warn: CircleAlert,
  fail: CircleX,
};

const TONE: Record<CheckStatus, string> = {
  ok: "text-ok",
  warn: "text-warn",
  fail: "text-bad",
};

export function MachineCheckPanel({
  verdict,
  material,
  firstAngle,
}: {
  verdict: MachineVerdict;
  material: MaterialKey;
  firstAngle: number;
}) {
  const headline =
    verdict.status === "ok"
      ? "Деталь выполнима на станке"
      : verdict.status === "warn"
        ? `Выполнима с оговорками · ${verdict.warned}`
        : `Не проходит по ${verdict.failed} ${verdict.failed === 1 ? "пункту" : "пунктам"}`;

  const HeadIcon = ICON[verdict.status];

  return (
    <div className="panel panel-pad">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Cog size={15} className="text-accent" />
          <p className="micro">Проверка на станке</p>
        </div>
        <Link href="/machine" className="micro transition-colors hover:text-accent">
          {MACHINE.model} <ArrowUpRight size={10} className="inline" />
        </Link>
      </div>

      <div
        className={clsx(
          "mt-3 flex items-center gap-2 border px-3 py-2",
          verdict.status === "ok" && "border-ok/40",
          verdict.status === "warn" && "border-warn/40",
          verdict.status === "fail" && "border-bad/50"
        )}
      >
        <HeadIcon size={15} className={clsx("shrink-0", TONE[verdict.status])} />
        <span className={clsx("text-[13px]", TONE[verdict.status])}>{headline}</span>
      </div>

      <div className="mt-3 space-y-0.5">
        {verdict.checks.map((c) => {
          const Icon = ICON[c.status];
          return (
            <details
              key={c.id}
              className="group border-b border-line/50 last:border-none"
              open={c.status !== "ok"}
            >
              <summary className="flex cursor-pointer list-none items-center gap-2 py-2">
                <Icon size={13} className={clsx("shrink-0", TONE[c.status])} />
                <span className="min-w-0 flex-1 truncate text-[12px] text-ghost">
                  {c.label}
                </span>
                <span className={clsx("num shrink-0 text-[11px]", TONE[c.status])}>
                  {c.value}
                </span>
              </summary>
              <p className="pb-2 pl-5 text-[11px] leading-relaxed text-steel">
                {c.detail}
                <span className="num mt-1 block text-steel/70">Предел: {c.limit}</span>
              </p>
            </details>
          );
        })}
      </div>

      <div className="mt-3 border-t border-line pt-3">
        <p className="micro">Наладчику</p>
        <div className="mt-2 space-y-1 text-[11px] leading-relaxed text-steel">
          <p>
            Ручей <span className="num text-ghost">{verdict.die?.label ?? "—"}</span>,
            пуансон{" "}
            <span className="num text-ghost">
              {MACHINE.punches[0].angle}° R{MACHINE.punches[0].radius}
            </span>
            , крепление {MACHINE.mount}.
          </p>
          <p>
            Перегиб под пружинение: задавать{" "}
            <span className="num text-amber">
              {overbendAngle(material, firstAngle)}°
            </span>{" "}
            для готовых {firstAngle}° — уточнить пробным гибом на обрезке.
          </p>
          <p>
            Свободный просвет для съёма{" "}
            <span className="num text-ghost">{verdict.daylight} мм</span>, бомбирование
            включить при длине гиба свыше 1000 мм.
          </p>
        </div>
      </div>
    </div>
  );
}
