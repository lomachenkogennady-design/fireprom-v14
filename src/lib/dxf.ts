/** Минимальный DXF-генератор (AC1015): слои CUT / BEND / HOLES / TEXT */

export interface DxfBendLine {
  /** позиция по X на развёртке, мм */
  x: number;
  angle: number;
  dir: 1 | -1;
}

export interface DxfHole {
  x: number;
  y: number;
  d: number;
}

export interface DxfOptions {
  partName: string;
  flatLength: number;
  width: number;
  thickness: number;
  materialLabel: string;
  bendLines: DxfBendLine[];
  holes?: DxfHole[];
}

const n = (v: number) => String(Math.round(v * 1000) / 1000);

function textEntity(
  x: number,
  y: number,
  h: number,
  value: string,
  rot = 0
): string {
  return [
    "0", "TEXT", "8", "TEXT",
    "10", n(x), "20", n(y), "30", "0",
    "40", n(h), "1", value, "50", n(rot),
    "72", "1", "11", n(x), "21", n(y), "31", "0",
  ].join("\n");
}

export function buildPartDxf(o: DxfOptions): string {
  const W = o.flatLength;
  const H = o.width;
  const holes = o.holes ?? [];

  const header = [
    "0", "SECTION", "2", "HEADER",
    "9", "$ACADVER", "1", "AC1015",
    "9", "$INSUNITS", "70", "4", // мм
    "0", "ENDSEC",
    "0", "SECTION", "2", "TABLES",
    // линии
    "0", "TABLE", "2", "LTYPE", "70", "1",
    "0", "LTYPE", "2", "DASHED", "70", "0",
    "3", "Dashed __ __ __", "72", "65", "73", "2",
    "40", "6.0", "49", "4.0", "74", "0", "49", "-2.0", "74", "0",
    "0", "ENDTAB",
    // слои
    "0", "TABLE", "2", "LAYER", "70", "4",
    "0", "LAYER", "2", "CUT", "70", "0", "62", "7", "6", "CONTINUOUS",
    "0", "LAYER", "2", "BEND", "70", "0", "62", "1", "6", "DASHED",
    "0", "LAYER", "2", "HOLES", "70", "0", "62", "3", "6", "CONTINUOUS",
    "0", "LAYER", "2", "TEXT", "70", "0", "62", "4", "6", "CONTINUOUS",
    "0", "ENDTAB",
    "0", "ENDSEC",
  ].join("\n");

  const contour = [
    "0", "LWPOLYLINE", "8", "CUT", "90", "4", "70", "1",
    "10", "0", "20", "0",
    "10", n(W), "20", "0",
    "10", n(W), "20", n(H),
    "10", "0", "20", n(H),
  ].join("\n");

  const entities: string[] = [contour];
  const textH = Math.max(3, H * 0.02);

  // отверстия — слой HOLES
  for (const h of holes) {
    entities.push(
      [
        "0", "CIRCLE", "8", "HOLES",
        "10", n(h.x), "20", n(h.y), "30", "0",
        "40", n(h.d / 2),
      ].join("\n")
    );
    // разметка центра (крест)
    const c = Math.max(h.d * 0.35, 3);
    entities.push(
      ["0", "LINE", "8", "HOLES", "10", n(h.x - c), "20", n(h.y), "30", "0", "11", n(h.x + c), "21", n(h.y), "31", "0"].join("\n"),
      ["0", "LINE", "8", "HOLES", "10", n(h.x), "20", n(h.y - c), "30", "0", "11", n(h.x), "21", n(h.y + c), "31", "0"].join("\n")
    );
  }

  // линии гибов — слой BEND
  o.bendLines.forEach((b, i) => {
    entities.push(
      [
        "0", "LINE", "8", "BEND",
        "10", n(b.x), "20", "0", "30", "0",
        "11", n(b.x), "21", n(H), "31", "0",
      ].join("\n")
    );
    entities.push(
      textEntity(
        b.x + textH * 0.4,
        H * 0.5 + i * textH * 1.4 - ((o.bendLines.length - 1) * textH * 0.7),
        textH,
        `B${i + 1}: ${b.angle}deg ${b.dir > 0 ? "UP" : "DOWN"}`
      )
    );
  });

  entities.push(
    textEntity(
      textH,
      H + textH * 2,
      textH * 1.4,
      `${o.partName} | ${o.materialLabel} s=${o.thickness} | ${n(W)} x ${n(H)}`
    )
  );

  return `${header}\n0\nSECTION\n2\nENTITIES\n${entities.join(
    "\n"
  )}\n0\nENDSEC\n0\nEOF\n`;
}
