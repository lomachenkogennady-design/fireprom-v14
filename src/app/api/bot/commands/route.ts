import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { botCommands } from "@/db/schema-studio";
import { asc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await db.select().from(botCommands).orderBy(asc(botCommands.sortOrder));
  return NextResponse.json({ commands: rows });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const command = String(body.command ?? "").trim();
  if (!command) return NextResponse.json({ error: "command обязателен" }, { status: 400 });

  const [row] = await db
    .insert(botCommands)
    .values({
      command,
      button: body.button ? String(body.button) : null,
      title: String(body.title ?? command),
      reply: String(body.reply ?? ""),
      showPrices: body.showPrices === true,
      category: body.category ? String(body.category) : null,
      collectLead: body.collectLead === true,
      active: body.active !== false,
      sortOrder: Number(body.sortOrder ?? 100) || 100,
    })
    .returning();
  return NextResponse.json({ command: row }, { status: 201 });
}
