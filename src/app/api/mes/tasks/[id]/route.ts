import { NextResponse } from "next/server";
import { db } from "@/db";
import { machineTasks } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const id = Number((await params).id);
  const body = await req.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};
  if (typeof body.machineId === "string") patch.machineId = body.machineId;
  if (typeof body.status    === "string") patch.status    = body.status;
  if (typeof body.note      === "string") patch.note      = body.note;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "nothing to patch" }, { status: 400 });
  }
  const [row] = await db
    .update(machineTasks).set(patch).where(eq(machineTasks.id, id)).returning();
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true, task: row });
}
