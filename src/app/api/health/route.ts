import { db, isDbConfigured } from "@/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isDbConfigured()) {
    return Response.json(
      {
        ok: false,
        db: "unconfigured",
        hint: "Задайте DATABASE_URL в .env (шаблон — .env.example), затем: npx drizzle-kit push",
      },
      { status: 503 }
    );
  }

  try {
    await db.execute(sql`select 1`);
    return Response.json({ ok: true, db: "connected" });
  } catch (e) {
    return Response.json(
      {
        ok: false,
        db: "error",
        message: e instanceof Error ? e.message : "unknown error",
      },
      { status: 500 }
    );
  }
}
