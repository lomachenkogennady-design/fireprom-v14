"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutGrid,
  DraftingCompass,
  FileSpreadsheet,
  History,
  Cog,
  Scissors,
  Factory,
  Inbox,
  Bot,
} from "lucide-react";
import { clsx } from "@/lib/format";
import { ThemeSwitcher } from "@/components/theme-switcher";

const NAV = [
  { href: "/", label: "Панель", icon: LayoutGrid },
  { href: "/bending", label: "Технологу", icon: DraftingCompass },
  { href: "/cutting", label: "Резка", icon: Scissors },
  { href: "/kp", label: "Менеджеру", icon: FileSpreadsheet },
  { href: "/leads",   label: "Заявки", icon: Inbox },
  { href: "/bot",     label: "Бот",    icon: Bot },
  { href: "/history", label: "История", icon: History },
  { href: "/mes/queue", label: "Цех", icon: Factory },
  { href: "/machine", label: "Станок", icon: Cog },
];

function BrandMark() {
  return (
    <svg width="30" height="30" viewBox="0 0 30 30" fill="none" aria-hidden>
      <path
        d="M4 26V12.5C4 11.1 5.1 10 6.5 10H26"
        stroke="var(--color-accent)"
        strokeWidth="3"
      />
      <path
        d="M4 20V6.5C4 5.1 5.1 4 6.5 4H18"
        stroke="var(--color-steel)"
        strokeWidth="2"
        opacity="0.6"
      />
    </svg>
  );
}

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header
      className="app-header sticky top-0 z-40 border-b border-line backdrop-blur-md"
      style={{ background: "color-mix(in srgb, var(--color-bg) 85%, transparent)" }}
    >
      <div className="mx-auto flex h-16 w-full max-w-[1440px] items-center gap-3 px-4 sm:px-6 lg:px-10">
        <Link href="/" className="group flex items-center gap-3">
          <BrandMark />
          <span className="flex flex-col leading-none">
            <span className="font-display text-[13px] font-semibold tracking-wide text-ink">
              ФАЙЕРПРОМ
            </span>
            <span className="micro mt-1">Metalworks · СПБ</span>
          </span>
        </Link>

        <nav className="ml-4 flex flex-1 items-center gap-1 overflow-x-auto">
          {NAV.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "relative flex items-center gap-2 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.14em] transition-colors",
                  active ? "text-accent" : "text-steel hover:text-ink"
                )}
              >
                <Icon size={14} strokeWidth={1.8} />
                <span className="hidden sm:inline">{item.label}</span>
                <span
                  className={clsx(
                    "absolute inset-x-2 -bottom-[13px] h-px bg-accent transition-opacity",
                    active ? "opacity-100" : "opacity-0"
                  )}
                  style={{ boxShadow: "var(--ui-glow)" }}
                />
              </Link>
            );
          })}
        </nav>

        <ThemeSwitcher />

        <a
          href="https://fire-prom.ru"
          target="_blank"
          rel="noreferrer"
          className="hidden items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-steel transition-colors hover:text-ink xl:flex"
        >
          fire-prom.ru
          <span
            className="inline-block h-1.5 w-1.5 bg-ok"
            style={{ boxShadow: "0 0 8px var(--color-ok)" }}
          />
        </a>
      </div>
    </header>
  );
}
