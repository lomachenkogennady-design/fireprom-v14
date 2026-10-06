import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { leads, leadFiles } from "@/db/schema";
import { sql, eq, desc } from "drizzle-orm";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// uploads всегда в корне проекта, а не в .next/standalone
// (в standalone cwd меняется, при пересборке — папка стирается)
const UPLOAD_ROOT = (() => {
  if (process.env.UPLOAD_ROOT) return process.env.UPLOAD_ROOT;
  const cwd = process.cwd();
  if (cwd.endsWith("/.next/standalone")) {
    return path.join(cwd, "..", "..", "uploads");
  }
  return path.join(cwd, "uploads");
})();
const MAX_FILE_SIZE = 25 * 1024 * 1024;
const MAX_TOTAL_SIZE = 50 * 1024 * 1024;
const MAX_FILES = 10;

/** L-YYMMDD-NNN — дневной счётчик, ежедневно с 001 */
async function nextLeadNumber(): Promise<string> {
  const d = new Date();
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const prefix = "L-" + yy + mm + dd + "-";
  const r = await db.execute(
    sql`SELECT count(*)::int AS n FROM leads WHERE number LIKE ${prefix + "%"}`
  );
  const rows = (r as unknown as { rows: { n: number }[] }).rows;
  const n = (rows[0]?.n ?? 0) + 1;
  return prefix + String(n).padStart(3, "0");
}

function validate(fd: FormData): { errors: string[]; name: string; phone: string; email: string } {
  const errors: string[] = [];
  const name = String(fd.get("name") ?? "").trim();
  const phone = String(fd.get("phone") ?? "").trim();
  const email = String(fd.get("email") ?? "").trim();
  const consent = fd.get("consent");

  if (!name) errors.push("Укажите имя или организацию");
  if (!phone) errors.push("Укажите телефон");
  if (phone && phone.replace(/\D/g, "").length < 11) errors.push("Телефон: нужно 11 цифр");
  if (email && !/^\S+@\S+\.\S+$/.test(email)) errors.push("Некорректный e-mail");
  if (!consent) errors.push("Нужно согласие на обработку данных");

  return { errors, name, phone, email };
}

export async function POST(req: NextRequest) {
  let fd: FormData;
  try {
    fd = await req.formData();
  } catch {
    return NextResponse.json({ error: "Не удалось прочитать форму" }, { status: 400 });
  }

  const { errors, name, phone, email } = validate(fd);
  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join("; "), errors }, { status: 400 });
  }

  const files: File[] = [];
  let totalSize = 0;
  for (const [, v] of fd.entries()) {
    if (v instanceof File && v.size > 0) {
      files.push(v);
      totalSize += v.size;
    }
  }
  if (files.length > MAX_FILES) {
    return NextResponse.json({ error: "Не более " + MAX_FILES + " файлов" }, { status: 400 });
  }
  if (totalSize > MAX_TOTAL_SIZE) {
    return NextResponse.json({ error: "Общий размер больше 50 МБ" }, { status: 400 });
  }
  for (const f of files) {
    if (f.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "Файл " + f.name + " больше 25 МБ" }, { status: 400 });
    }
  }

  const number = await nextLeadNumber();

  let utmJson: unknown = null;
  const utmRaw = fd.get("utmJson") as string | null;
  if (utmRaw) {
    try { utmJson = JSON.parse(utmRaw); } catch { /* ignore */ }
  }

  const [newLead] = await db.insert(leads).values({
    number,
    source: String(fd.get("source") ?? "site"),
    name,
    phone,
    email: email || null,
    contactMethod: String(fd.get("contactMethod") ?? "") || null,
    region: String(fd.get("region") ?? "") || null,
    address: String(fd.get("address") ?? "") || null,
    requestType: String(fd.get("requestType") ?? "") || null,
    message: String(fd.get("message") ?? "") || null,
    utmJson,
    referrer: String(fd.get("referrer") ?? "") || null,
    userAgent: String(fd.get("userAgent") ?? "") || null,
  }).returning({ id: leads.id });

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

  return NextResponse.json({ ok: true, id: newLead.id, number }, { status: 201 });
}

export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get("status");
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? 50), 200);

  const rows = status
    ? await db.select().from(leads).where(eq(leads.status, status))
        .orderBy(desc(leads.createdAt)).limit(limit)
    : await db.select().from(leads).orderBy(desc(leads.createdAt)).limit(limit);

  return NextResponse.json(rows);
}
