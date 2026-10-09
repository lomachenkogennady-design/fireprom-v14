// ═══════════════════════════════════════════════════════════
// Email intake — превращает письмо в заявку + очередь уведомлений
// Порт из срм1, адаптирован под наш стек (09.10.2026)
// ═══════════════════════════════════════════════════════════
import { db } from "@/db";
import { leads } from "@/db/schema";
import { inboundMessages, leadEvents, notifications, channels } from "@/db/schema-studio";
import { sql, eq } from "drizzle-orm";

export type IncomingMail = {
  from: string;
  fromName?: string | null;
  subject?: string | null;
  text: string;
  messageId?: string | null;
};

const IGNORE_RE = /(no-?reply|mailer-daemon|postmaster|bounce|notification)/i;

function extractPhone(s: string): string | null {
  const m = s.match(/(?:\+7|8)[\s\-()]?\d{3}[\s\-()]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2}/);
  if (!m) return null;
  const digits = m[0].replace(/\D/g, "");
  if (digits.length !== 11) return null;
  return "+" + (digits.startsWith("8") ? "7" + digits.slice(1) : digits);
}

async function nextLeadNumber(): Promise<string> {
  const d = new Date();
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const prefix = "L-" + yy + mm + dd + "-";
  const r = await db.execute(sql`SELECT count(*)::int AS n FROM leads WHERE number LIKE ${prefix + "%"}`);
  const rows = (r as unknown as { rows: { n: number }[] }).rows;
  const n = (rows[0]?.n ?? 0) + 1;
  return prefix + String(n).padStart(3, "0");
}

async function queueNotifications(
  leadId: number,
  lead: { number: string; name: string; phone?: string | null; email?: string | null; message?: string | null; source: string; requestType?: string | null },
) {
  const chans = await db.select().from(channels).where(eq(channels.enabled, true));
  for (const ch of chans) {
    const text =
      "🔥 Новая заявка #" + lead.number + "\n" +
      "👤 " + lead.name + "\n" +
      "📞 " + (lead.phone ?? "—") + "\n" +
      "✉️ " + (lead.email ?? "—") + "\n" +
      "🧩 " + (lead.requestType ?? "—") + "\n" +
      "💬 " + (lead.message ?? "—") + "\n" +
      "📍 Источник: " + lead.source;
    await db.insert(notifications).values({
      leadId,
      channel: ch.kind,
      target: ch.target,
      subject: ch.subject ? ch.subject.replace("{number}", lead.number) : null,
      text,
      status: "pending",
    });
  }
}

export async function ingestMail(mail: IncomingMail) {
  if (IGNORE_RE.test(mail.from)) {
    await db.insert(inboundMessages).values({
      channel: "email",
      externalId: mail.messageId ?? null,
      fromAddr: mail.from,
      subject: mail.subject ?? null,
      body: mail.text.slice(0, 4000),
    });
    return { skipped: true as const, leadId: null, summary: "Служебное письмо — заявка не создана" };
  }

  if (mail.messageId) {
    const [dup] = await db
      .select({ id: inboundMessages.id, leadId: inboundMessages.leadId })
      .from(inboundMessages)
      .where(eq(inboundMessages.externalId, mail.messageId))
      .limit(1);
    if (dup) {
      return { skipped: true as const, leadId: dup.leadId, summary: "Письмо уже обработано ранее" };
    }
  }

  const body = mail.text.trim().slice(0, 4000);
  const phone = extractPhone(`${mail.subject ?? ""} ${body}`);
  const number = await nextLeadNumber();
  const name = mail.fromName?.trim() || mail.from.split("@")[0] || "Клиент (почта)";
  const product = mail.subject?.trim() || null;

  const [lead] = await db
    .insert(leads)
    .values({
      number,
      source: "email",
      name,
      email: mail.from,
      phone,
      product,
      message: body || "(пустое письмо)",
      status: "new",
      priority: phone ? "hot" : "normal",
    })
    .returning({ id: leads.id });

  await queueNotifications(lead.id, {
    number,
    name,
    phone,
    email: mail.from,
    message: body || "(пустое письмо)",
    source: "email",
    requestType: null,
  });

  await db.insert(leadEvents).values({
    leadId: lead.id,
    type: "note",
    text: "Заявка создана из письма: " + (mail.subject ?? "(без темы)"),
    author: "email-intake",
  });

  await db.insert(inboundMessages).values({
    channel: "email",
    externalId: mail.messageId ?? null,
    fromAddr: mail.from,
    subject: mail.subject ?? null,
    body,
    leadId: lead.id,
  });

  return { skipped: false as const, leadId: lead.id, number, summary: `Заявка #${number} из письма` };
}
