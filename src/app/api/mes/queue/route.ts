import { NextResponse } from "next/server";
import { db } from "@/db";
import { machineTasks } from "@/db/schema";
import { inArray, asc, desc } from "drizzle-orm";

export async function GET() {
  const rows = await db
    .select().from(machineTasks)
    .where(inArray(machineTasks.status, ["queued", "running", "paused"]))
    .orderBy(asc(machineTasks.station), desc(machineTasks.createdAt));
  return NextResponse.json(rows);
}
