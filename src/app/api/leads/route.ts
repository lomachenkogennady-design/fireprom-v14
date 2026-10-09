import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { leads, leadFiles } from "@/db/schema";
import { leadEvents, notifications, channels } from "@/db/schema-studio";
import { sql, eq, desc, and, or, ilike } from "drizzle-orm";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const UPLOAD_ROOT = (() => {
  if (process.env.UPLOAD_ROOT) return process.env.UPLOAD_ROOT;
  const cwd = process.cwd();
  if (cwd.endsWith("/.next/standalone")) return path.join(cwd, "..", "..", "uploads");
  return path.join(cwd, "uploads");
})();
const MAX_FILE_SIZE = 25 * 1024 * 1024;
const MAX_TOTAL_SIZE = 50 * 1024 * 1024;
const MAX_FILES = 10;

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

/** GET /api/leads?status=new&q=поиск&limit=50 — список заявок для UI */
export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get("status");
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? 100), 500);

  const conditions = [];
  if (status && status !== "all") conditions.push(eq(leads.status, status));
  if (q) {
    conditions.push(
      or(
        ilike(leads.name, `%${q}%`),
        ilike(leads.phone, `%${q}%`),
        ilike(leads.message, `%${q}%`),
      ),
    );
  }

  const rows = conditions.length
    ? await db.select().from(leads).where(and(...conditions)).orderBy(desc(leads.createdAt)).limit(limit)
    : await db.select().from(leads).orderBy(desc(leads.createdAt)).limit(limit);

  return NextResponse.json({ leads: rows });
}

/** POST /api/leads — создать (JSON или multipart) */


/** Создать pending-записи для всех активных каналов */
async function queueNotifications(
  leadId: number,
  lead: { number: string; name: string; phone?: string | null; email?: string | null; message?: string | null; source: string; requestType?: string | null },
) {
  const chans = await db.select().from(channels).where(eq(channels.enabled, true));
  for (const ch of chans) {
    const text = "🔥 Новая заявка #" + lead.number + "\n" +
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

export async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type") ?? "";

  // ─── JSON (ручная заявка менеджером) ───
  if (contentType.includes("application/json")) {
    const body = await req.json().catch(() => ({}));
    const name = String(body.name ?? "").trim();
    if (!name) return NextResponse.json({ error: "Укажите имя" }, { status: 400 });

    const number = await nextLeadNumber();
    const [newLead] = await db.insert(leads).values({
      number,
      source: String(body.source ?? "phone"),
      name,
      phone: body.phone ? String(body.phone) : null,
      email: body.email ? String(body.email) : null,
      product: body.product ? String(body.product) : null,
      message: body.message ? String(body.message) : null,
      priority: body.phone ? "hot" : "normal",
    }).returning({ id: leads.id });

    await queueNotifications(newLead.id, {
      number, name,
      phone: body.phone ? String(body.phone) : null,
      email: body.email ? String(body.email) : null,
      message: body.message ? String(body.message) : null,
      source: String(body.source ?? "phone"),
      requestType: null,
    });

    await db.insert(leadEvents).values({
      leadId: newLead.id,
      type: "note",
      text: "Заявка создана вручную из панели /leads",
      author: "менеджер",
    });

    return NextResponse.json({ lead: { id: newLead.id, number } }, { status: 201 });
  }

  // ─── multipart (Telegram-бот, сайт) ───
  let fd: FormData;
  try { fd = await req.formData(); }
  catch { return NextResponse.json({ error: "Не удалось прочитать форму" }, { status: 400 }); }

  const name = String(fd.get("name") ?? "").trim();
  const phone = String(fd.get("phone") ?? "").trim();
  const email = String(fd.get("email") ?? "").trim();
  const consent = fd.get("consent");
  const errors: string[] = [];
  if (!name) errors.push("Укажите имя или организацию");
  if (!phone) errors.push("Укажите телефон");
  if (phone && phone.replace(/\D/g, "").length < 11) errors.push("Телефон: нужно 11 цифр");
  if (email && !/^\S+@\S+\.\S+$/.test(email)) errors.push("Некорректный e-mail");
  if (!consent) errors.push("Нужно согласие на обработку данных");
  if (errors.length) return NextResponse.json({ error: errors.join("; "), errors }, { status: 400 });

  const files: File[] = [];
  let totalSize = 0;
  for (const [, v] of fd.entries()) {
    if (v instanceof File && v.size > 0) { files.push(v); totalSize += v.size; }
  }
  if (files.length > MAX_FILES) return NextResponse.json({ error: `Не более ${MAX_FILES} файлов` }, { status: 400 });
  if (totalSize > MAX_TOTAL_SIZE) return NextResponse.json({ error: "Общий размер больше 50 МБ" }, { status: 400 });
  for (const f of files) {
    if (f.size > MAX_FILE_SIZE) return NextResponse.json({ error: `Файл ${f.name} больше 25 МБ` }, { status: 400 });
  }

  const number = await nextLeadNumber();
  let utmJson: unknown = null;
  const utmRaw = fd.get("utmJson") as string | null;
  if (utmRaw) { try { utmJson = JSON.parse(utmRaw); } catch {} }

  const [newLead] = await db.insert(leads).values({
    number,
    source: String(fd.get("source") ?? "site"),
    name, phone,
    email: email || null,
    contactMethod: String(fd.get("contactMethod") ?? "") || null,
    region: String(fd.get("region") ?? "") || null,
    address: String(fd.get("address") ?? "") || null,
    requestType: String(fd.get("requestType") ?? "") || null,
    message: String(fd.get("message") ?? "") || null,
    utmJson,
    referrer: String(fd.get("referrer") ?? "") || null,
    userAgent: String(fd.get("userAgent") ?? "") || null,
    tgUserId: String(fd.get("tgUserId") ?? "") || null,
    tgUsername: String(fd.get("tgUsername") ?? "") || null,
    botUsername: String(fd.get("botUsername") ?? "") || null,
    priority: phone ? "hot" : "normal",
  }).returning({ id: leads.id });

  await queueNotifications(newLead.id, {
    number, name, phone,
    email: email || null,
    message: String(fd.get("message") ?? "") || null,
    source: String(fd.get("source") ?? "site"),
    requestType: String(fd.get("requestType") ?? "") || null,
  });

  if (files.length > 0) {
    const leadDir = path.join(UPLOAD_ROOT, String(newLead.id));
    fs.mkdirSync(leadDir, { recursive: true });
    for (const file of files) {
      const buf = Buffer.from(await file.arrayBuffer());
      const sha = crypto.createHash("sha256").update(buf).digest("hex");
      const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(0, 200);
      const stored = Date.now() + "_" + safeName;
      const absPath = path.join(leadDir, stored);
      fs.writeFileSync(absPath, buf);
      await db.insert(leadFiles).values({
        leadId: newLead.id,
        filename: file.name,
        path: path.relative(process.cwd(), absPath),
        size: file.size,
        mime: file.type || "application/octet-stream",
        sha256: sha,
      });
    }
  }

  await db.insert(leadEvents).values({
    leadId: newLead.id,
    type: "bot",
    text: `Заявка создана (${String(fd.get("source") ?? "site")})`,
    author: "система",
  });

  return NextResponse.json({ ok: true, id: newLead.id, number, lead: { id: newLead.id, number } }, { status: 201 });
}
