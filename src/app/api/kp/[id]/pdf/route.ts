import { NextResponse } from "next/server";
import { renderKpPdf } from "@/lib/kp-pdf";
import { loadKpData } from "@/lib/kp-data";

export const dynamic = "force-dynamic";

/** GET /api/kp/:id/pdf — PDF конкретного КП из БД */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const id = Number((await params).id);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: "bad id" }, { status: 400 });
  }

  try {
    const kp = await loadKpData(id);
    if (!kp) {
      return NextResponse.json(
        { error: "КП не найдено или нет позиций" },
        { status: 404 },
      );
    }

    const buf = await renderKpPdf(kp);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/pdf",
        // Кириллица в имени файла → ByteString error. Отдаём ASCII + filename* (RFC 5987)
        "Content-Disposition":
          `inline; filename="kp-${id}.pdf"; filename*=UTF-8''${encodeURIComponent("kp-" + kp.number + ".pdf")}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("[kp-pdf] id=" + id, e);
    return NextResponse.json(
      { error: "pdf render failed" },
      { status: 500 },
    );
  }
}
