import { NextResponse } from "next/server";
import {
  listDoorOrders,
  createDoorOrder,
  DoorOrderError,
  type CreateDoorOrderInput,
} from "@/lib/doors/order-service";
import { DoorCalcError, type DoorConfig } from "@/lib/doors/DoorPriceCalculator";

export async function GET() {
  try {
    const orders = await listDoorOrders(100);
    return NextResponse.json({ orders });
  } catch (e) {
    return NextResponse.json(
      { error: "internal_error", message: String(e) },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const config: DoorConfig = {
      profileCatalogId: Number(body.profileCatalogId),
      fillingCatalogId: Number(body.fillingCatalogId),
      externalFinishCatalogId: body.externalFinishCatalogId
        ? Number(body.externalFinishCatalogId)
        : null,
      internalFinishCatalogId: body.internalFinishCatalogId
        ? Number(body.internalFinishCatalogId)
        : null,
      hardwareCatalogIds: Array.isArray(body.hardwareCatalogIds)
        ? body.hardwareCatalogIds.map(Number)
        : [],
      serviceCatalogIds: Array.isArray(body.serviceCatalogIds)
        ? body.serviceCatalogIds.map(Number)
        : [],
      doorWidth: Number(body.doorWidth),
      doorHeight: Number(body.doorHeight),
      hingeCount: Number(body.hingeCount) as 2 | 3 | 4,
    };

    const input: CreateDoorOrderInput = {
      config,
      customerName: String(body.customerName ?? ""),
      quoteId: body.quoteId ? Number(body.quoteId) : null,
      quoteItemId: body.quoteItemId ? Number(body.quoteItemId) : null,
      note: body.note ? String(body.note) : null,
      actorId: null,
    };

    const order = await createDoorOrder(input);
    return NextResponse.json(order, { status: 201 });
  } catch (e) {
    if (e instanceof DoorOrderError) {
      const status = e.code === "INVALID_CUSTOMER" ? 400 : 422;
      return NextResponse.json(
        { error: e.code, message: e.message },
        { status },
      );
    }
    if (e instanceof DoorCalcError) {
      const status =
        e.code === "PROFILE_NOT_FOUND" ? 404 :
        e.code === "WIDTH_OUT_OF_RANGE" ||
        e.code === "HEIGHT_OUT_OF_RANGE" ||
        e.code === "INVALID_HINGE_COUNT" ||
        e.code === "NO_HARDWARE" ? 422 :
        e.code === "PRICE_MISSING" ||
        e.code === "EMPTY_PRICE_LIST" ? 409 :
        422;
      return NextResponse.json(
        { error: e.code, message: e.message },
        { status },
      );
    }
    return NextResponse.json(
      { error: "internal_error", message: String(e) },
      { status: 500 },
    );
  }
}
