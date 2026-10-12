import { NextResponse } from "next/server";
import {
  getPriceListVersion,
  PriceListError,
} from "@/lib/pricing/price-list-service";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const versionId = Number(id);
    if (!Number.isFinite(versionId) || versionId <= 0) {
      return NextResponse.json(
        { error: "invalid_id", message: "id must be a positive integer" },
        { status: 400 },
      );
    }
    const data = await getPriceListVersion(versionId);
    return NextResponse.json(data);
  } catch (e) {
    if (e instanceof PriceListError && e.code === "VERSION_NOT_FOUND") {
      return NextResponse.json(
        { error: e.code, message: e.message },
        { status: 404 },
      );
    }
    return NextResponse.json(
      { error: "internal_error", message: String(e) },
      { status: 500 },
    );
  }
}
