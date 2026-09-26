import { NextResponse } from "next/server";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { clients } from "@/db/schema";
import { dbErrorResponse } from "@/lib/api";

export async function GET() {
  try {
    const rows = await db.select().from(clients).orderBy(asc(clients.name));
    return NextResponse.json(rows);
  } catch (e) {
    return dbErrorResponse(e);
  }
}

export async function POST(req: Request) {
  const body = await req.json();
  const name = String(body.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "Укажите название клиента" }, { status: 400 });
  }
  try {
    const [row] = await db
      .insert(clients)
      .values({
        name,
        contact: body.contact ? String(body.contact) : null,
        phone: body.phone ? String(body.phone) : null,
        email: body.email ? String(body.email) : null,
        inn: body.inn ? String(body.inn) : null,
      })
      .returning();
    return NextResponse.json(row, { status: 201 });
  } catch (e) {
    return dbErrorResponse(e);
  }
}
