import { NextRequest, NextResponse } from "next/server";
import { getSettings, setSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  const settings = await getSettings();
  return NextResponse.json({ settings });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "bad payload" }, { status: 400 });
  }
  const values: Record<string, string> = {};
  for (const [k, v] of Object.entries(body)) {
    values[String(k)] = String(v ?? "");
  }
  await setSettings(values);
  const settings = await getSettings();
  return NextResponse.json({ ok: true, settings });
}
