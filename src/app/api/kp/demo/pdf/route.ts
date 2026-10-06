import { NextResponse } from "next/server";
import { renderKpPdf, demoKp } from "@/lib/kp-pdf";

/** GET /api/kp/demo/pdf — демо-КП. В проде: /api/kp/:id/pdf с данными из quotes */
export async function GET() {
  try {
    const buf = await renderKpPdf(demoKp());
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="kp-1042.pdf"',
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("kp-pdf:", e);
    return NextResponse.json({ error: "pdf render failed" }, { status: 500 });
  }
}
