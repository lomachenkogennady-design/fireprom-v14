import { NextResponse } from "next/server";
import {
  getDoorOrder,
  DoorOrderError,
} from "@/lib/doors/order-service";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const orderId = Number(id);
    if (!Number.isFinite(orderId) || orderId <= 0) {
      return NextResponse.json(
        { error: "invalid_id", message: "id must be a positive integer" },
        { status: 400 },
      );
    }
    const data = await getDoorOrder(orderId);
    return NextResponse.json(data);
  } catch (e) {
    if (e instanceof DoorOrderError && e.code === "NOT_FOUND") {
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
