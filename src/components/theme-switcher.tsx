"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Palette, Check, ArrowUpRight } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { THEMES, THEME_KEYS } from "@/lib/theme";
import { clsx } from "@/lib/format";

export function ThemeSwitcher() {
  const { theme, setTheme, setThemeAuto, isAuto, ready } = useTheme();
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  const current = THEMES[theme];
  const label = !ready ? "…" : isAuto ? "Авто" : current.name;

  return (
    <div ref={boxRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="btn btn-ghost gap-2"
        title="Оформление интерфейса"
        aria-label="Сменить тему"
      >
        <Palette size={15} strokeWidth={1.8} />
        <span className="hidden lg:inline">{label}</span>
      </button>

      {open && (
        <div className="panel absolute right-0 top-[calc(100%+10px)] z-50 w-[320px] p-2">
          <p className="micro px-2 py-2">Оформление</p>

          <button
            onClick={() => {
              setThemeAuto();
              setOpen(false);
            }}
            className={clsx(
              "flex w-full items-center gap-3 border px-2 py-2 text-left transition-colors",
              isAuto
                ? "border-accent/50 bg-accent/10"
                : "border-transparent hover:bg-ink/5",
            )}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center border border-dashed border-line">
              <span className="font-mono text-[11px] font-bold text-steel">
                A
              </span>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] text-ink">
                Автоматически
              </span>
              <span className="micro block truncate">
                По модулю (чертёж · КП · цех)
              </span>
            </span>
            {isAuto && <Check size={14} className="shrink-0 text-accent" />}
          </button>

          <div className="my-1 border-t border-line" />

          {THEME_KEYS.map((k) => {
            const t = THEMES[k];
            const active = k === theme && !isAuto;
            return (
              <button
                key={k}
                onClick={() => {
                  setTheme(k);
                  setOpen(false);
                }}
                className={clsx(
                  "flex w-full items-center gap-3 border px-2 py-2 text-left transition-colors",
                  active
                    ? "border-accent/50 bg-accent/10"
                    : "border-transparent hover:bg-ink/5",
                )}
              >
                <span
                  className="flex h-8 w-8 shrink-0 overflow-hidden border"
                  style={{ borderColor: t.swatch.line, background: t.swatch.bg }}
                >
                  <span
                    className="h-full w-1/2"
                    style={{ background: t.swatch.panel }}
                  />
                  <span
                    className="h-full w-1/2"
                    style={{ background: t.swatch.accent }}
                  />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] text-ink">
                    {t.name}
                  </span>
                  <span className="micro block truncate">{t.tagline}</span>
                </span>

                {active && <Check size={14} className="shrink-0 text-accent" />}
              </button>
            );
          })}

          <Link
            href="/ui"
            onClick={() => setOpen(false)}
            className="mt-1 flex items-center justify-between border-t border-line px-2 py-2.5 text-[12px] text-steel transition-colors hover:text-ink"
          >
            Сравнить все варианты
            <ArrowUpRight size={13} />
          </Link>
        </div>
      )}
    </div>
  );
}
