import PDFDocument from "pdfkit";
import { COMPANY } from "./company";
import fs from "node:fs";
import path from "node:path";

/**
 * Серверный рендер PDF-КП.
 *
 * Нюансы кириллицы, ради которых всё затевалось:
 *  1. Стандартные PDF-шрифты (Helvetica и др.) НЕ содержат кириллицу —
 *     обязательно встраиваем TTF. DejaVu Sans лежит в репо (fonts/),
 *     чтобы рендер был одинаков на Termux/Amvera/локально.
 *  2. Шрифт передаём в конструктор PDFDocument — иначе pdfkit тащит
 *     Helvetica.afm из своих data-файлов, которые теряются при бандлинге.
 *  3. toLocaleString("ru-RU") вставляет неразрывный пробел U+00A0 —
 *     заменяем на обычный, не каждый шрифт его имеет.
 *  4. Знак ₽ (U+20BD) в DejaVu есть с версии 2.35 — проверено тестом.
 */

export interface KpItem {
  name: string;
  qty: number;
  unit: string;
  /** цена за единицу без НДС, руб */
  price: number;
}

export interface KpData {
  number: string;
  date: string;
  validUntil?: string;
  company: { name: string; inn?: string; phone?: string; email?: string };
  customer: string;
  items: KpItem[];
  /** НДС, % (по умолчанию 20) */
  vatRate?: number;
  note?: string;
  manager?: string;
}

/**
 * Поиск папки шрифтов. Порядок:
 *  1. FONT_DIR из env (явное переопределение)
 *  2. cwd/fonts — dev-режим и обычный next start
 *  3. cwd/../../fonts — standalone-сборка (cwd = .next/standalone,
 *     если fonts/ не скопирован внутрь, берём из корня проекта)
 * Не нашли — падаем с понятной ошибкой и подсказкой про cp.
 */
const FONT_CANDIDATES = [
  process.env.FONT_DIR,
  path.join(process.cwd(), "fonts"),
  path.join(process.cwd(), "..", "..", "fonts"),
].filter((p): p is string => Boolean(p));

function fontPath(file: string): string {
  for (const dir of FONT_CANDIDATES) {
    const p = path.join(dir, file);
    if (fs.existsSync(p)) return p;
  }
  throw new Error(
    `Шрифт ${file} не найден. Искали: ${FONT_CANDIDATES.join(" | ")}. ` +
      `Для standalone: cp -r fonts .next/standalone/ (или задайте FONT_DIR).`,
  );
}

const PAGE = { w: 595.28, h: 841.89 }; // A4, pt
const M = 40; // поля

/** деньги: 12 345,60 ₽ (обычные пробелы вместо U+00A0) */
function money(n: number): string {
  return (
    n
      .toLocaleString("ru-RU", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
      .replace(/\u00A0/g, " ") + " ₽"
  );
}

export function renderKpPdf(kp: KpData): Promise<Buffer> {
  const regular = fs.readFileSync(fontPath("DejaVuSans.ttf"));
  const bold = fs.readFileSync(fontPath("DejaVuSans-Bold.ttf"));

  const doc = new PDFDocument({
    size: "A4",
    margin: M,
    bufferPages: true, // для «стр. X из Y» в конце
    // НЕ дефолтная Helvetica — см. нюанс 2. Рантайм принимает Buffer,
    // @types/pdfkit знает только string — отсюда каст.
    font: regular as unknown as string,
    info: { Title: `КП ${kp.number}`, Author: kp.company.name },
  });
  doc.registerFont("reg", regular);
  doc.registerFont("bold", bold);

  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const result = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  // ── Шапка ──
  doc.font("bold").fontSize(16).fillColor("#1a1a1a").text(kp.company.name, M, M);
  doc.font("reg").fontSize(8.5).fillColor("#666");
  const details = [
    kp.company.inn && `ИНН ${kp.company.inn}`,
    kp.company.phone,
    kp.company.email,
  ].filter(Boolean);
  doc.text(details.join("  ·  "));

  doc
    .font("bold")
    .fontSize(13)
    .fillColor("#1a1a1a")
    .text(`Коммерческое предложение № ${kp.number} от ${kp.date}`, M, M + 50);
  doc.font("reg").fontSize(10).fillColor("#333").text(`Заказчик: ${kp.customer}`);

  doc
    .moveTo(M, doc.y + 10)
    .lineTo(PAGE.w - M, doc.y + 10)
    .strokeColor("#b4541e")
    .lineWidth(1.5)
    .stroke();

  // ── Таблица позиций ──
  const cols = [
    { key: "idx", title: "№", w: 26, align: "center" as const },
    { key: "name", title: "Наименование", w: 255, align: "left" as const },
    { key: "qty", title: "Кол-во", w: 48, align: "right" as const },
    { key: "unit", title: "Ед.", w: 32, align: "center" as const },
    { key: "price", title: "Цена", w: 75, align: "right" as const },
    { key: "sum", title: "Сумма", w: 79, align: "right" as const },
  ];
  const tableX = M;
  let y = doc.y + 22;
  const bottomLimit = PAGE.h - M - 60;

  function drawHeaderRow() {
    doc.font("bold").fontSize(8.5).fillColor("#1a1a1a");
    doc.rect(tableX, y, cols.reduce((s, c) => s + c.w, 0), 20).fill("#f0e9dc");
    doc.fillColor("#1a1a1a");
    let x = tableX;
    for (const c of cols) {
      doc.text(c.title, x + 4, y + 6, { width: c.w - 8, align: c.align });
      x += c.w;
    }
    y += 20;
  }

  drawHeaderRow();
  doc.font("reg").fontSize(9).fillColor("#1a1a1a");

  kp.items.forEach((it, i) => {
    const sum = it.qty * it.price;
    const cells: Record<string, string> = {
      idx: String(i + 1),
      name: it.name,
      qty: String(it.qty),
      unit: it.unit,
      price: money(it.price),
      sum: money(sum),
    };
    // высота строки — по самой высокой ячейке (кириллица переносится сама)
    const rowH =
      Math.max(
        ...cols.map((c) =>
          doc.heightOfString(cells[c.key], { width: c.w - 8 }),
        ),
      ) + 10;

    // перенос страницы с повтором шапки таблицы
    if (y + rowH > bottomLimit) {
      doc.addPage();
      y = M;
      drawHeaderRow();
      doc.font("reg").fontSize(9).fillColor("#1a1a1a");
    }

    if (i % 2 === 1) {
      doc
        .rect(tableX, y, cols.reduce((s, c) => s + c.w, 0), rowH)
        .fill("#faf7f0");
      doc.fillColor("#1a1a1a");
    }
    let x = tableX;
    for (const c of cols) {
      doc.text(cells[c.key], x + 4, y + 5, { width: c.w - 8, align: c.align });
      x += c.w;
    }
    doc
      .moveTo(tableX, y + rowH)
      .lineTo(tableX + cols.reduce((s, c) => s + c.w, 0), y + rowH)
      .strokeColor("#e0d8c8")
      .lineWidth(0.5)
      .stroke();
    y += rowH;
  });

  // ── Итоги ──
  const subtotal = kp.items.reduce((s, it) => s + it.qty * it.price, 0);
  const vatRate = kp.vatRate ?? 22;
  const vat = (subtotal * vatRate) / 100;
  const total = subtotal + vat;

  y += 14;
  if (y > bottomLimit) {
    doc.addPage();
    y = M;
  }
  const totalsX = tableX + cols[0].w + cols[1].w;
  const totalsW = cols[2].w + cols[3].w + cols[4].w + cols[5].w;
  const totalRow = (label: string, value: string, isBold = false) => {
    doc
      .font(isBold ? "bold" : "reg")
      .fontSize(isBold ? 11 : 9.5)
      .fillColor("#1a1a1a");
    doc.text(label, totalsX, y, { width: totalsW - 90, align: "right" });
    doc.text(value, totalsX + totalsW - 85, y, { width: 85, align: "right" });
    y += isBold ? 20 : 16;
  };
  totalRow("Итого без НДС:", money(subtotal));
  totalRow(`НДС ${vatRate}%:`, money(vat));
  totalRow("Итого с НДС:", money(total), true);

  // ── Примечание и подпись ──
  y += 10;
  doc.font("reg").fontSize(9).fillColor("#333");
  if (kp.note) {
    doc.text(kp.note, M, y, { width: PAGE.w - 2 * M });
    y = doc.y + 6;
  }
  if (kp.validUntil) {
    doc.text(`Предложение действительно до ${kp.validUntil}.`, M, y);
    y = doc.y + 24;
  }
  if (kp.manager) {
    doc.text(`Менеджер: ${kp.manager}  ____________________`, M, y);
  }

  // ── Нумерация страниц (bufferPages) ──
  // Ловушка pdfkit: text() в зоне нижнего поля добавляет новую страницу.
  // Лечение: на время футера обнуляем margins.bottom и пишем с lineBreak:false.
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const prevBottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc
      .font("reg")
      .fontSize(8)
      .fillColor("#999")
      .text(
        `${kp.company.name} · КП ${kp.number} · стр. ${i + 1} из ${range.count}`,
        M,
        PAGE.h - 28,
        { width: PAGE.w - 2 * M, align: "center", lineBreak: false },
      );
    doc.page.margins.bottom = prevBottom;
  }

  doc.end();
  return result;
}

/** Демо-КП для обкатки рендера (в проде данные приходят из quotes) */
export function demoKp(): KpData {
  return {
    number: "1042",
    date: "06.10.2026",
    validUntil: "20.10.2026",
    company: {
      name: COMPANY.name,
      inn: COMPANY.tax.inn,
      phone: COMPANY.contacts.phone,
      email: COMPANY.contacts.email,
    },
    customer: "ООО «Невастрой», ИНН 7801000000",
    items: [
      { name: "Кронштейн 200×80, сталь Ст3, 4 мм, лазерная резка + гибка", qty: 25, unit: "шт", price: 480 },
      { name: "Пластина опорная 120×120, 09Г2С, 6 мм", qty: 50, unit: "шт", price: 210 },
      { name: "Рама опоры в сборе (сварная конструкция, грунт ГФ-021)", qty: 6, unit: "шт", price: 6400 },
      { name: "Короб 300×200×100, оцинкованная сталь 1,5 мм, порошковая окраска RAL 9003", qty: 12, unit: "шт", price: 1850 },
      { name: "Фланец Ду100, Ст20, 10 мм, плазменная резка", qty: 8, unit: "шт", price: 720 },
      { name: "Доставка до объекта (Санкт-Петербург, в пределах КАД)", qty: 1, unit: "усл", price: 3500 },
    ],
    vatRate: 22,
    note: "Срок изготовления: 10 рабочих дней с момента поступления аванса. Условия оплаты: аванс 50%, остаток — по готовности.",
    manager: COMPANY.signatory.short,
  };
}
