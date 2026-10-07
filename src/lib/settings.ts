// ═══════════════════════════════════════════════════════════
// Bot Studio — настройки бота (key/value)
// ═══════════════════════════════════════════════════════════
import { db } from "@/db";
import { botSettings } from "@/db/schema-studio";
import { sql } from "drizzle-orm";

export type Settings = Record<string, string>;

export async function getSettings(): Promise<Settings> {
  const rows = await db.select().from(botSettings);
  const out: Settings = {};
  for (const row of rows) out[row.key] = row.value;
  return out;
}

export async function setSettings(values: Settings) {
  const entries = Object.entries(values);
  if (!entries.length) return;
  for (const [key, value] of entries) {
    await db
      .insert(botSettings)
      .values({ key, value: String(value ?? "") })
      .onConflictDoUpdate({
        target: botSettings.key,
        set: { value: String(value ?? ""), updatedAt: sql`now()` },
      });
  }
}
