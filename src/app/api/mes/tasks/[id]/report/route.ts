import { NextResponse } from "next/server";
import { db } from "@/db";
import { machineTasks, machineEvents } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const id = Number((await params).id);
  const body = await req.json().catch(() => ({}));
  const done  = Number(body.done  ?? 0) || 0;
  const scrap = Number(body.scrap ?? 0) || 0;

  if (!done && !scrap) {
    return NextResponse.json({ error: "no delta" }, { status: 400 });
  }

  await db.insert(machineEvents).values({
    taskId: id,
    kind: scrap ? "scrap" : "+1",
    payload: { done, scrap, note: body.note ?? null },
  });

  const [row] = await db
    .update(machineTasks)
    .set({
      done:  sql`${machineTasks.done}  + ${done}`,
      scrap: sql`${machineTasks.scrap} + ${scrap}`,
      ...(body.note ? { note: body.note } : {}),
    })
    .where(eq(machineTasks.id, id))
    .returning();

  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });

  if (row.done >= row.qty && row.status !== "done") {
    const [closed] = await db
      .update(machineTasks)
      .set({ status: "done", finishedAt: new Date() })
      .where(eq(machineTasks.id, id))
      .returning();
    return NextResponse.json({ ok: true, task: closed });
  }
  return NextResponse.json({ ok: true, task: row });
}
