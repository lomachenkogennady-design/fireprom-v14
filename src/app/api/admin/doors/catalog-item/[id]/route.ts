import { NextResponse } from "next/server";
import {
  setCatalogItemActive,
  CatalogError,
} from "@/lib/doors/catalog-service";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const catalogItemId = Number(id);
    if (!Number.isFinite(catalogItemId) || catalogItemId <= 0) {
      return NextResponse.json(
        { error: "invalid_id", message: "id must be a positive integer" },
        { status: 400 },
      );
    }

    const body = await req.json();
    if (typeof body.isActive !== "boolean") {
      return NextResponse.json(
        { error: "invalid_body", message: "isActive (boolean) is required" },
        { status: 400 },
      );
    }

    const updated = await setCatalogItemActive(catalogItemId, body.isActive);
    return NextResponse.json(updated);
  } catch (e) {
    if (e instanceof CatalogError && e.code === "NOT_FOUND") {
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
