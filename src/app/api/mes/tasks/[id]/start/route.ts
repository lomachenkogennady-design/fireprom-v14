import { NextResponse } from "next/server";
import { db } from "@/db";
import { machineTasks, machineEvents } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const id = Number((await params).id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "bad id" }, { status: 400 });
  }
  const [row] = await db
    .update(machineTasks)
    .set({ status: "running", startedAt: new Date() })
    .where(eq(machineTasks.id, id))
    .returning();
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
  await db.insert(machineEvents).values({ taskId: id, kind: "start" });
  return NextResponse.json({ ok: true, task: row });
}
