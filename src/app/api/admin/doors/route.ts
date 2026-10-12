import { NextResponse } from "next/server";
import { countByType } from "@/lib/doors/catalog-service";

export async function GET() {
  try {
    const counts = await countByType();
    return NextResponse.json({ counts });
  } catch (e) {
    return NextResponse.json(
      { error: "internal_error", message: String(e) },
      { status: 500 },
    );
  }
}
