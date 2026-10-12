import { NextResponse } from "next/server";
import {
  listProfiles,
  listFillings,
  listFinishes,
  listHardware,
  listServices,
  createProfile,
  createFilling,
  createFinish,
  createHardware,
  createService,
  CatalogError,
} from "@/lib/doors/catalog-service";

type DoorType = "profiles" | "fillings" | "finishes" | "hardware" | "services";

const VALID_TYPES: readonly DoorType[] = [
  "profiles",
  "fillings",
  "finishes",
  "hardware",
  "services",
];

function isDoorType(s: string): s is DoorType {
  return (VALID_TYPES as readonly string[]).includes(s);
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ type: string }> },
) {
  const { type } = await params;
  if (!isDoorType(type)) {
    return NextResponse.json(
      { error: "invalid_type", message: `type must be one of: ${VALID_TYPES.join(", ")}` },
      { status: 400 },
    );
  }
  try {
    const data =
      type === "profiles" ? await listProfiles() :
      type === "fillings" ? await listFillings() :
      type === "finishes" ? await listFinishes() :
      type === "hardware" ? await listHardware() :
      await listServices();
    return NextResponse.json({ [type]: data });
  } catch (e) {
    return NextResponse.json(
      { error: "internal_error", message: String(e) },
      { status: 500 },
    );
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ type: string }> },
) {
  const { type } = await params;
  if (!isDoorType(type)) {
    return NextResponse.json(
      { error: "invalid_type", message: `type must be one of: ${VALID_TYPES.join(", ")}` },
      { status: 400 },
    );
  }

  try {
    const body = await req.json();
    const result =
      type === "profiles" ? await createProfile(body) :
      type === "fillings" ? await createFilling(body) :
      type === "finishes" ? await createFinish(body) :
      type === "hardware" ? await createHardware(body) :
      await createService(body);
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    if (e instanceof CatalogError) {
      return NextResponse.json(
        { error: e.code, message: e.message },
        { status: 422 },
      );
    }
    return NextResponse.json(
      { error: "internal_error", message: String(e) },
      { status: 500 },
    );
  }
}
