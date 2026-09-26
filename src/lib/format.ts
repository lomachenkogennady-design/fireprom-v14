export function rub(v: number): string {
  return `${Math.round(v).toLocaleString("ru-RU")} ₽`;
}

export function mm(v: number, digits = 1): string {
  return `${v.toLocaleString("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  })} мм`;
}

export function kg(v: number): string {
  return `${v.toLocaleString("ru-RU", { maximumFractionDigits: 2 })} кг`;
}

export function dt(v: string | Date): string {
  const d = typeof v === "string" ? new Date(v) : v;
  return d.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function clsx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}
