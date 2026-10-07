// ═══════════════════════════════════════════════════════════
// Bot Studio — справочники и форматирование
// Обёртки над format.ts (rub, dt) — единый стиль
// ═══════════════════════════════════════════════════════════
import { rub, dt } from "./format";

export const STATUSES = [
  { key: "new",         label: "Новая",         emoji: "🆕", color: "bg-sky-500/15 text-sky-300 border-sky-500/30" },
  { key: "in_progress", label: "В работе",      emoji: "🛠", color: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  { key: "quoted",      label: "КП отправлено", emoji: "📄", color: "bg-violet-500/15 text-violet-300 border-violet-500/30" },
  { key: "won",         label: "Сделка",        emoji: "✅", color: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  { key: "lost",        label: "Отказ",         emoji: "❌", color: "bg-rose-500/15 text-rose-300 border-rose-500/30" },
] as const;

export type StatusKey = (typeof STATUSES)[number]["key"];
export const STATUS_KEYS = STATUSES.map((s) => s.key) as StatusKey[];

export function statusMeta(key: string) {
  return STATUSES.find((s) => s.key === key) ?? STATUSES[0];
}

export const PRIORITIES = [
  { key: "low",    label: "Низкий",  emoji: "🧊" },
  { key: "normal", label: "Обычный", emoji: "•" },
  { key: "hot",    label: "Горячий", emoji: "🔥" },
] as const;

export const SOURCES = [
  { key: "site",     label: "Сайт",     emoji: "🌐" },
  { key: "telegram", label: "Telegram", emoji: "✈️" },
  { key: "phone",    label: "Телефон",  emoji: "📞" },
  { key: "email",    label: "Почта",    emoji: "📧" },
] as const;

export function sourceMeta(key: string) {
  return SOURCES.find((s) => s.key === key) ?? SOURCES[0];
}

export const CATEGORIES = [
  { key: "doors",   label: "Двери",    emoji: "🚪" },
  { key: "shelves", label: "Стеллажи", emoji: "🗄" },
  { key: "service", label: "Услуги",   emoji: "🔧" },
] as const;

/** Обёртки над format.ts для Bot Studio */
export function money(value: number | null | undefined): string {
  if (value == null) return "—";
  return rub(value);
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  return dt(value);
}
