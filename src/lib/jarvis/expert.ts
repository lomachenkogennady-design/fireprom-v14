import { MATERIALS, type MaterialKey } from "@/lib/materials";
import { calcItem, TECH, laserRate } from "@/lib/pricing";
import { LASER_MAX_T, BEND, ORDER_DOCS, capabilitySummary, maxBendDepth } from "@/lib/shop";
import type { JarvisSnapshot, BendingSnapshot, QuoteSnapshot } from "./types";

/**
 * Детерминированный инженерный движок.
 *
 * Все числа берутся из фактического состояния калькулятора, а не из языковой
 * модели: минимальная полка, K-фактор, усилие, цена — это расчёт, в нём
 * недопустимы галлюцинации. LLM подключается только там, где нужен свободный
 * текст, и получает те же цифры в системном промпте.
 */

const n = (v: number, d = 1) =>
  v.toLocaleString("ru-RU", { maximumFractionDigits: d });
const rub = (v: number) => `${Math.round(v).toLocaleString("ru-RU")} ₽`;

/** Русская плюрализация: plural(2, ["гиб","гиба","гибов"]) → "гиба" */
function plural(count: number, forms: [string, string, string]): string {
  const n100 = Math.abs(count) % 100;
  const n10 = n100 % 10;
  if (n100 > 10 && n100 < 20) return forms[2];
  if (n10 > 1 && n10 < 5) return forms[1];
  if (n10 === 1) return forms[0];
  return forms[2];
}

const pcs = (c: number) => `${c} ${plural(c, ["гиб", "гиба", "гибов"])}`;
const flangeWord = (c: number) => `${c} ${plural(c, ["полка", "полки", "полок"])}`;

function norm(s: string): string {
  return s.toLowerCase().replace(/ё/g, "е").replace(/[^a-zа-я0-9\s.,/-]/gi, " ");
}

interface Intent {
  id: string;
  /** ключевые слова; вес 2 для точных терминов */
  keys: string[];
  strong?: string[];
  answer: (s: JarvisSnapshot) => string | null;
}

const isBending = (s: JarvisSnapshot): s is BendingSnapshot => s.kind === "bending";
const isQuote = (s: JarvisSnapshot): s is QuoteSnapshot => s.kind === "quote";

function needBending(): string {
  return "Этот вопрос про гибку — откройте вкладку «Технологу» и задайте параметры детали, тогда я отвечу по вашему расчёту.";
}

const INTENTS: Intent[] = [
  // ---------------- минимальная полка ----------------
  {
    id: "min-flange",
    strong: ["минимальная полка", "мин полка", "минимальную полку"],
    keys: ["минимальн", "полка", "полки", "проваливается", "провалится", "короткая"],
    answer: (s) => {
      if (!isBending(s)) return needBending();
      const r = s.results;
      const bad = s.flanges
        .map((f, i) => ({ f, i }))
        .filter((x) => x.f > 0 && x.f < r.minFlange);
      const lines = [
        `Минимальная полка — **${n(r.minFlange)} мм** при V=${n(r.vDie, 0)} и s=${n(s.thickness)} мм.`,
        `Правило: 0.7·V. Полка короче упирается в плечи матрицы и проваливается в раскрыв — гиб уходит по размеру и по углу.`,
      ];
      if (bad.length) {
        lines.push(
          `\n⚠ Не проходят: ${bad.map((x) => `полка №${x.i + 1} (${n(x.f)} мм)`).join(", ")}.`,
          `Варианты: взять матрицу меньше (V=${n(s.thickness * 6, 0)}…${n(s.thickness * 8, 0)}), гнуть с технологическим припуском и обрезать после, либо переразбить деталь.`
        );
      } else {
        lines.push(`\n✓ Все ${flangeWord(s.flanges.length)} проходят по этому критерию.`);
      }
      return lines.join("\n");
    },
  },

  // ---------------- K-фактор ----------------
  {
    id: "k-factor",
    strong: ["k фактор", "к фактор", "k-фактор", "кфактор"],
    keys: ["kfactor", "нейтральн", "din", "6935", "коэффициент"],
    answer: (s) => {
      if (!isBending(s)) return needBending();
      const r = s.results;
      const rt = r.radius / s.thickness;
      return [
        `K-фактор для вашей детали — **${n(r.kFactor, 3)}**.`,
        `Определён по таблице DIN 6935 из отношения R/t = ${n(r.radius)} / ${n(s.thickness)} = ${n(rt, 2)}.`,
        `Физически это положение нейтрального слоя: он лежит на ${n(r.kFactor * 100, 1)}% толщины от внутренней поверхности, то есть на ${n(r.kFactor * s.thickness, 2)} мм.`,
        `Чем острее радиус, тем сильнее слой смещается внутрь (при R<0.5·t K падает до 0.28), при R≥5·t стремится к 0.5.`,
      ].join("\n");
    },
  },

  // ---------------- радиус / матрица ----------------
  {
    id: "radius-vdie",
    strong: ["какая матрица", "раскрыв", "подобрать матрицу", "радиус гиба"],
    keys: ["матриц", "ручей", "радиус", "vdie", "пуансон", "оснастка"],
    answer: (s) => {
      if (!isBending(s)) return needBending();
      const r = s.results;
      const m = MATERIALS[s.material];
      return [
        `Матрица **V=${n(r.vDie, 0)} мм**, внутренний радиус **R=${n(r.radius)} мм**.`,
        `Подбор: V = ${m.vFactor}·s для «${m.label}» (${m.vFactor}×${n(s.thickness)} = ${n(r.vDie, 0)}), радиус при воздушной гибке формируется сам ≈ 0.16·V.`,
        `Ширина полки минимум ${n(r.minFlange)} мм, усилие ${n(r.tonnagePerM)} тс/м.`,
        `Если нужен радиус меньше — берите матрицу уже, но проверьте усилие: оно растёт обратно пропорционально V.`,
      ].join("\n");
    },
  },

  // ---------------- усилие ----------------
  {
    id: "tonnage",
    strong: ["какое усилие", "сколько тонн", "хватит ли пресса"],
    keys: ["усили", "тонн", "тоннаж", "пресс", "давлен", "станок"],
    answer: (s) => {
      if (!isBending(s)) return needBending();
      const r = s.results;
      const m = MATERIALS[s.material];
      const lines = [
        `Усилие гибки — **${n(r.tonnageTotal)} тс** на деталь (${n(r.tonnagePerM)} тс на метр длины гиба).`,
        `Расчёт: P ≈ 650·s²/V кН/м × ${m.forceFactor} (коэффициент материала), при длине гиба ${n(s.width)} мм.`,
      ];
      if (s.bends.length > 1) {
        lines.push(
          `Это на ОДИН гиб. Гибы выполняются последовательно, поэтому пресс подбирается по этому числу, а не по сумме всех ${s.bends.length}.`
        );
      }
      lines.push(
        `Запас по прессу берите 1.3–1.5× → нужен станок от **${n(r.tonnageTotal * 1.4, 0)} тс**.`
      );
      return lines.join("\n");
    },
  },

  // ---------------- развёртка / BA / BD ----------------
  {
    id: "flat-length",
    strong: ["длина заготовки", "длина развертки", "сколько отрезать", "размер заготовки"],
    keys: ["развертк", "заготовк", "ba", "bd", "вычет", "припуск", "отрезать"],
    answer: (s) => {
      if (!isBending(s)) return needBending();
      const r = s.results;
      const sumF = s.flanges.reduce((a, b) => a + b, 0);
      const sumBa = r.bends.reduce((a, b) => a + b.ba, 0);
      const lines = [
        `Длина развёртки — **${n(r.flatLength, 2)} мм**. Режьте заготовку ${n(r.flatLength, 0)} × ${n(s.width, 0)} мм.`,
        ``,
        `Как получилось: сумма прямых полок ${n(sumF)} мм + сумма припусков на гибы ${n(sumBa, 2)} мм.`,
      ];
      r.bends.forEach((b, i) => {
        lines.push(
          `• Гиб ${i + 1} (${n(b.angle, 0)}°): BA = ${n(b.ba, 2)} мм, BD = ${n(b.bd, 2)} мм, линия гиба на ${n(b.position, 1)} мм от края`
        );
      });
      lines.push(
        ``,
        `BA = θ·(R + K·s) = θ·(${n(r.radius)} + ${n(r.kFactor, 3)}·${n(s.thickness)}). Разметку удобнее брать из колонки «Позиция» — она уже в координатах развёртки.`
      );
      return lines.join("\n");
    },
  },

  // ---------------- пружинение ----------------
  {
    id: "springback",
    strong: ["пружинит", "пружинение", "недогиб", "угол уходит"],
    keys: ["пружин", "отпружин", "перегиб", "недогиб", "угол не держит"],
    answer: (s) => {
      if (!isBending(s)) return needBending();
      const m = MATERIALS[s.material];
      const target = s.bends[0]?.angle ?? 90;
      return [
        `Для «${m.label}» пружинение — **${m.springback}**.`,
        `Практика: гните с перегибом на эту величину. Для угла ${n(target, 0)}° задавайте на станке примерно ${n(target - (m.key === "stainless" ? 4 : m.key === "aluminum" ? 2.5 : 1.5), 1)}°.`,
        `Величина растёт с радиусом и с пределом текучести: та же нержавейка на большом радиусе может отдавать до 5–7°.`,
        `Надёжнее всего — пробный гиб на обрезке той же плавки: партии металла отличаются.`,
      ].join("\n");
    },
  },

  // ---------------- масса ----------------
  {
    id: "weight",
    strong: ["сколько весит", "масса детали", "какой вес"],
    keys: ["масса", "вес", "весит", "кг"],
    answer: (s) => {
      if (isQuote(s)) {
        return `Общая масса по КП — **${n(s.totals.totalMass)} кг** (${s.items.length} ${plural(s.items.length, ["позиция", "позиции", "позиций"])} с учётом количества).`;
      }
      if (!isBending(s)) return needBending();
      const m = MATERIALS[s.material];
      return [
        `Масса заготовки — **${n(s.results.weight, 3)} кг**.`,
        `Считано по развёртке: ${n(s.results.flatLength, 0)} × ${n(s.width, 0)} × ${n(s.thickness)} мм, плотность ${m.density} кг/м³.`,
        `Это масса до раскроя; при закупке металла закладывайте отход ×1.25 → ${n(s.results.weight * 1.25, 3)} кг.`,
      ].join("\n");
    },
  },

  // ---------------- проверка детали ----------------
  {
    id: "check",
    strong: ["что не так", "проверь деталь", "есть ли ошибки", "все ли ок", "технологичн"],
    keys: ["проверь", "ошибк", "проблем", "предупрежд", "не так", "корректн"],
    answer: (s) => {
      if (!isBending(s)) return needBending();
      const r = s.results;
      const out: string[] = [];

      if (r.warnings.length) {
        out.push(`Нашёл ${r.warnings.length} ${plural(r.warnings.length, ["замечание", "замечания", "замечаний"])}:`);
        r.warnings.forEach((w) => out.push(`⚠ ${w}`));
      }

      const tightHoles = s.holes.filter((h) => h.d < s.thickness);
      if (tightHoles.length) {
        out.push(
          `⚠ Отверстий с Ø меньше толщины: ${tightHoles.length}. Лазер такие режет нестабильно — минимум Ø = s (${n(s.thickness)} мм), лучше 1.5·s.`
        );
      }

      // отверстия в зоне гиба
      const risky = s.holes.filter((h) =>
        r.bends.some((b) => h.x > b.position - 2 * s.thickness && h.x < b.position + b.ba + 2 * s.thickness)
      );
      if (risky.length) {
        out.push(
          `⚠ ${risky.length} ${plural(risky.length, ["отверстие попадает", "отверстия попадают", "отверстий попадает"])} в зону гиба — при гибке их вытянет в овал. Отнесите центр минимум на 2.5·s (${n(2.5 * s.thickness)} мм) от линии гиба.`
        );
      }

      if (s.bends.length >= 4) {
        out.push(
          `ℹ ${pcs(s.bends.length)} — проверьте порядок и доступность: на последних гибах готовая полка может упереться в станину.`
        );
      }

      if (!out.length) {
        return [
          `✓ Замечаний нет.`,
          `Полки все ≥ ${n(r.minFlange)} мм, отверстия вне зон гиба, усилие ${n(r.tonnageTotal)} тс.`,
          `Деталь технологична: развёртка ${n(r.flatLength, 0)} × ${n(s.width, 0)} мм, ${pcs(s.bends.length)} на матрице V=${n(r.vDie, 0)}.`,
        ].join("\n");
      }
      return out.join("\n");
    },
  },

  // ---------------- порядок гибов ----------------
  {
    id: "order",
    strong: ["порядок гибов", "последовательность гибов", "с какого гиба"],
    keys: ["порядок", "последовательн", "сначала", "очередн"],
    answer: (s) => {
      if (!isBending(s)) return needBending();
      if (s.bends.length < 2) return `У детали один гиб — вопрос порядка не стоит.`;
      return [
        `Для ${pcs(s.bends.length)} общее правило: **от центра к краям**, короткие полки гнём последними.`,
        `Так деталь дольше остаётся плоской и её удобнее базировать по упорам.`,
        ``,
        `По вашей детали полки: ${s.flanges.map((f) => n(f)).join(" / ")} мм.`,
        `Начните с гиба, после которого остаётся самая длинная опорная поверхность, а гиб у полки ${n(Math.min(...s.flanges))} мм делайте в конце — её труднее всего прижать.`,
        `Проверьте также, не упрётся ли уже отогнутая полка в траверсу: при высоте полки больше ~${n(s.results.vDie * 3, 0)} мм это реально.`,
      ].join("\n");
    },
  },

  // ---------------- цена текущей детали (кросс-модуль) ----------------
  {
    id: "price-of-part",
    strong: ["сколько стоит", "какая цена", "посчитай цену", "стоимость детали"],
    keys: ["цена", "стоимост", "стоит", "рубл", "смета", "деньги"],
    answer: (s) => {
      if (isQuote(s)) {
        const t = s.totals;
        const lines = [
          `Итого по КП — **${rub(t.totalClient)}**${t.minOrderApplied ? " (применён минимальный заказ)" : ""}.`,
          `Подытог ${rub(t.subtotal)}, скидка ${s.discountPct}% = −${rub(t.discount)}, НДС ${s.vatPct}% = ${rub(t.vat)}.`,
          `Масса ${n(t.totalMass)} кг, позиций ${s.items.length}.`,
        ];
        const top = [...s.items].sort((a, b) => b.totalPrice - a.totalPrice)[0];
        if (top) {
          lines.push(
            ``,
            `Самая дорогая позиция — «${top.name}»: ${rub(top.totalPrice)}. В ней металл ${rub(top.materialCost)}, резка ${rub(top.cutCost)}, гибка ${rub(top.bendCost)}${top.paintCost ? `, покраска ${rub(top.paintCost)}` : ""}.`
          );
        }
        return lines.join("\n");
      }
      if (!isBending(s)) return needBending();

      // считаем текущую деталь по прайсу как позицию КП
      const item = calcItem({
        name: s.name,
        material: s.material,
        tech: "laser",
        thickness: s.thickness,
        len: Math.round(s.results.flatLength),
        wid: Math.round(s.width),
        qty: 1,
        bends: s.bends.length,
        cutLen: null,
        pierces: null,
        paint: false,
        scrap: false,
      });
      return [
        `Ориентировочно **${rub(item.unitPrice)}** за штуку (лазер, без покраски).`,
        ``,
        `• металл: ${rub(item.materialCost)} (${n(item.mass, 3)} кг × 1.25 отход)`,
        `• резка: ${rub(item.cutCost)} (${n(item.effCutLen, 2)} м × ${n(laserRate(s.material, s.thickness), 0)} ₽/м + ${item.effPierces} врезок)`,
        `• гибка: ${rub(item.bendCost)} (${pcs(s.bends.length)})`,
        ``,
        `При тираже цена падает: от 20 шт ×0.9, от 50 ×0.8, от 100 ×0.72 на обработку. Нажмите «В коммерческое» — параметры перенесутся в КП.`,
      ].join("\n");
    },
  },

  // ---------------- замена материала ----------------
  {
    id: "material-swap",
    strong: ["чем заменить", "другой материал", "дешевле материал"],
    keys: ["заменить", "аналог", "вместо", "дешевле", "сравни"],
    answer: (s) => {
      if (!isBending(s)) return needBending();
      const cur = MATERIALS[s.material];
      const rows = (Object.keys(MATERIALS) as MaterialKey[])
        .filter((k) => k !== s.material)
        .map((k) => {
          const m = MATERIALS[k];
          const dv = m.vFactor * s.thickness;
          return `• ${m.label}: металл ${m.pricePerKg} ₽/кг (${m.pricePerKg > cur.pricePerKg ? "+" : ""}${n(((m.pricePerKg - cur.pricePerKg) / cur.pricePerKg) * 100, 0)}%), матрица V=${n(dv, 0)}, усилие ×${m.forceFactor}, пружинение ${m.springback}`;
        });
      return [
        `Сейчас «${cur.label}» — ${cur.pricePerKg} ₽/кг, V=${n(cur.vFactor * s.thickness, 0)}, усилие ×${cur.forceFactor}.`,
        ``,
        ...rows,
        ``,
        `Смена материала меняет матрицу и радиус → развёртка пересчитается. Оцинковку не грейте под покраску без подготовки, нержавейку гните с перегибом.`,
      ].join("\n");
    },
  },

  // ---------------- DXF ----------------
  {
    id: "dxf",
    strong: ["что в dxf", "какие слои", "экспорт dxf"],
    keys: ["dxf", "слои", "слой", "чертеж", "выгруз", "экспорт", "лазерщик"],
    answer: (s) => {
      const base = [
        `DXF выгружается со слоями:`,
        `• **CUT** — внешний контур (белый), по нему режет лазер`,
        `• **BEND** — линии гибов пунктиром, с подписью угла и направления UP/DOWN`,
        `• **HOLES** — отверстия окружностями + разметка центров`,
        `• **TEXT** — штамп: имя детали, материал, толщина, габарит`,
      ];
      if (isBending(s)) {
        base.push(
          ``,
          `Для вашей детали: контур ${n(s.results.flatLength, 0)} × ${n(s.width, 0)} мм, линий гиба ${s.bends.length}, отверстий ${s.holes.length}.`,
          `Один файл идёт и на лазер, и на гибочный — слои лишние отключаются в станочной программе.`
        );
      }
      return base.join("\n");
    },
  },

  // ---------------- скидка/НДС ----------------
  {
    id: "quote-terms",
    strong: ["какая скидка", "ндс", "минимальный заказ"],
    keys: ["скидк", "ндс", "наценк", "серия", "тираж", "минимальный заказ"],
    answer: (s) => {
      const lines = [
        `Серийные коэффициенты на обработку: от 20 шт **×0.9**, от 50 **×0.8**, от 100 **×0.72**. Металл по серии не дешевеет.`,
        `НДС: 0% (УСН), 20% или 22%. Минимальный заказ — 1 000 ₽.`,
        `Зачёт делового остатка возвращает стоимость отхода (25% массы) по цене лома.`,
      ];
      if (isQuote(s)) {
        lines.push(
          ``,
          `Сейчас в КП: скидка ${s.discountPct}%, НДС ${s.vatPct}%, итого ${rub(s.totals.totalClient)}.`
        );
        const series = s.items.filter((i) => i.qtyFactor < 1);
        if (series.length) {
          lines.push(`Серийный коэффициент уже применён к ${series.length} ${plural(series.length, ["позиции", "позициям", "позициям"])}.`);
        } else if (s.items.some((i) => i.qty >= 15)) {
          lines.push(`Подняв тираж до 20 шт, получите ×0.9 на обработку.`);
        }
      }
      return lines.join("\n");
    },
  },

  // ---------------- технологии резки ----------------
  {
    id: "tech",
    strong: ["лазер или плазма", "чем резать", "гидроабразив"],
    keys: ["плазм", "гидроабразив", "лазер", "резк", "технолог"],
    answer: (s) => {
      const t = [
        `Технологии в прайсе:`,
        `• **Лазер** — базовый тариф, точность ±0.1 мм, от 0.5 мм толщины`,
        `• **Плазма** — ×${TECH.plasma.factor} к цене, но от ${TECH.plasma.minT} мм и рез шире, кромка с конусом`,
        `• **Гидроабразив** — ×${TECH.waterjet.factor}, зато без зоны термовлияния: нужен для толстой нержавейки и когда нельзя греть металл`,
      ];
      if (isBending(s)) {
        t.push(
          ``,
          `Для s=${n(s.thickness)} мм: ${s.thickness >= TECH.plasma.minT ? "плазма допустима и заметно дешевле" : `плазма не подходит (минимум ${TECH.plasma.minT} мм) — режьте лазером`}.`
        );
      }
      return t.join("\n");
    },
  },

  // ---------------- возможности производства ----------------
  {
    id: "capability",
    strong: ["какую толщину режете", "что вы можете", "максимальная толщина", "какой размер листа", "режете ли"],
    keys: ["возможност", "толщин", "максималь", "предел", "режете", "гнете", "гнёте", "лист", "поле"],
    answer: (s) => {
      const lines = [`Возможности цеха:`, ``, ...capabilitySummary().map((x) => `• ${x}`)];
      if (isBending(s)) {
        const maxT = LASER_MAX_T[s.material];
        const m = MATERIALS[s.material];
        lines.push(``);
        if (maxT === null) {
          lines.push(`Ваш материал (${m.label}) режем по запросу — согласуйте до КП.`);
        } else if (s.thickness > maxT) {
          lines.push(`⚠ Ваша толщина ${n(s.thickness)} мм больше предела ${maxT} мм для «${m.label}».`);
        } else {
          lines.push(`✓ Ваши ${n(s.thickness)} мм для «${m.label}» режем (предел ${maxT} мм).`);
        }
        if (s.bends.length > 0 && s.thickness > BEND.maxT) {
          lines.push(`⚠ Гибка ${n(s.thickness)} мм — свыше штатных ${BEND.maxT} мм, только по согласованию с цехом.`);
        }
        const depth = Math.max(s.flanges[0] ?? 0, s.flanges[s.flanges.length - 1] ?? 0);
        const limit = maxBendDepth(s.width);
        if (s.bends.length > 0 && depth > limit) {
          lines.push(`⚠ Глубина гиба ${n(depth)} мм больше допустимой ${limit} мм при ширине ${n(s.width)} мм.`);
        }
      }
      return lines.join("\n");
    },
  },

  // ---------------- комплект документов ----------------
  {
    id: "docs",
    strong: ["что нужно для заказа", "какие документы", "что прислать", "как оформить заказ"],
    keys: ["документ", "чертеж", "чертёж", "файл", "прислать", "заказ оформ", "тз", "требован"],
    answer: () =>
      [
        `Для запуска в производство нужен комплект:`,
        ``,
        ...ORDER_DOCS.map((d) => `**${d.title}** — ${d.detail}`),
        ``,
        `Без чертежа заказ принимается только по развёртке — под ответственность заказчика: размеры и углы гиба проверить будет не по чему.`,
        `DXF отдавайте 1:1, только контуры реза: рамки, штампы и размерные линии станок воспримет как рез.`,
      ].join("\n"),
  },

  // ---------------- станок ----------------
  {
    id: "machine",
    strong: [
      "влезет ли",
      "сможем ли согнуть",
      "выполнима ли",
      "хватит ли станка",
      "на нашем станке",
      "пройдет ли",
    ],
    keys: ["станок", "станке", "пресс", "оснастк", "матриц", "пуансон", "упор", "зев", "раскрытие", "pba"],
    answer: (s) => {
      if (!isBending(s)) return needBending();
      const mach = s.machine;
      if (!mach) return needBending();

      const head =
        mach.status === "ok"
          ? `✓ Деталь выполнима на ${mach.model}.`
          : mach.status === "warn"
            ? `Деталь выполнима на ${mach.model}, но есть оговорки.`
            : `⚠ Деталь НЕ проходит на ${mach.model}.`;

      const lines = [head, ``];

      const bad = mach.checks.filter((c) => c.status === "fail");
      const warn = mach.checks.filter((c) => c.status === "warn");
      const good = mach.checks.filter((c) => c.status === "ok");

      for (const c of bad) {
        lines.push(`⚠ **${c.label}**: ${c.value} при пределе ${c.limit}.`, `   ${c.detail}`);
      }
      for (const c of warn) {
        lines.push(`ℹ **${c.label}**: ${c.value} (предел ${c.limit}). ${c.detail}`);
      }
      if (!bad.length && !warn.length) {
        lines.push(
          `Проверено ${good.length} параметров: усилие, нагрузка на матрицу, толщина под ручей, угол, длина гиба, полка, задний упор.`
        );
      }

      lines.push(
        ``,
        `Наладка: ручей ${mach.dieLabel}, пуансон 85° R0,6, крепление AMADA-PROMECAM. Свободный просвет для съёма ${mach.daylight} мм.`
      );
      return lines.join("\n");
    },
  },

  // ---------------- раскрой ----------------
  {
    id: "nesting",
    strong: ["сколько листов", "процент отхода", "раскрой", "использование листа", "коэффициент использования"],
    keys: ["лист", "листов", "раскро", "отход", "остаток", "утилизац", "использован", "нестинг"],
    answer: (s) => {
      if (!isQuote(s)) {
        return "Раскрой считается в модуле «Менеджеру»: добавьте позиции в КП, и я покажу число листов, процент использования и реальную стоимость металла.";
      }
      if (!s.nesting.length) return "В КП пока нет позиций — раскраивать нечего.";

      const out: string[] = [];
      let totalSheets = 0;
      let totalGross = 0;
      let totalEst = 0;

      for (const g of s.nesting) {
        const m = MATERIALS[g.material];
        totalSheets += g.sheetCount;
        totalGross += g.grossCost;
        totalEst += g.estimateCost;
        out.push(
          `**${m.short} s=${n(g.thickness)}**: ${g.sheetCount} ${plural(g.sheetCount, ["лист", "листа", "листов"])} ${g.sheetLabel}, использование ${n(g.utilization * 100)}%.`,
          `   Металл ${n(g.grossMass, 1)} кг из них в деталях ${n(g.netMass, 1)} кг, отход ${n(g.wasteArea, 2)} м²${g.remnantArea > 0 ? `, деловой остаток ${n(g.remnantArea, 2)} м² (${rub(g.remnantCredit)})` : ""}.`
        );
        if (g.oversized.length) {
          out.push(`   ⚠ Не влезают в лист: ${g.oversized.join(", ")}.`);
        }
      }

      const delta = totalGross - totalEst;
      out.push(
        ``,
        `Итого ${totalSheets} ${plural(totalSheets, ["лист", "листа", "листов"])}, металл по факту раскроя **${rub(totalGross)}**.`,
        delta > 0
          ? `Это на ${rub(delta)} дороже грубой оценки ×1.25 — закладывайте в цену, иначе уйдёте в минус.`
          : `Это на ${rub(-delta)} дешевле оценки ×1.25 — есть запас для скидки.`
      );

      const weak = s.nesting.filter((g) => g.utilization < 0.6);
      if (weak.length) {
        out.push(
          ``,
          `Слабый раскрой: ${weak.map((g) => `${MATERIALS[g.material].short} s=${n(g.thickness)} (${n(g.utilization * 100)}%)`).join(", ")}. Поднимите тираж до кратного листу или досыпьте мелких деталей из других заказов.`
        );
      }
      return out.join("\n");
    },
  },

  // ---------------- помощь ----------------
  {
    id: "help",
    strong: ["что ты умеешь", "помощь", "команды", "чем поможешь"],
    keys: ["умеешь", "помощь", "help", "возможност"],
    answer: (s) => {
      const where =
        s.kind === "bending"
          ? `Сейчас вижу расчёт «${s.name}»: ${MATERIALS[s.material].short}, s=${n(s.thickness)} мм, ${pcs(s.bends.length)}, развёртка ${n(s.results.flatLength, 0)} мм.`
          : s.kind === "quote"
            ? `Сейчас вижу КП: ${s.items.length} позиций на ${rub(s.totals.totalClient)}.`
            : `Откройте «Технологу» или «Менеджеру» — я подхвачу параметры с экрана.`;
      return [
        where,
        ``,
        `Спрашивайте по текущему расчёту:`,
        `• минимальная полка, K-фактор, радиус и матрица V`,
        `• длина развёртки, BA/BD, позиции линий гиба`,
        `• усилие пресса, масса, пружинение`,
        `• «проверь деталь» — найду нетехнологичные места`,
        `• «сколько стоит» — посчитаю по прайсу`,
        `• порядок гибов, замена материала, слои DXF`,
      ].join("\n");
    },
  },
];

export interface ExpertResult {
  answer: string;
  intent: string;
  score: number;
}

/** Подбор ответа по ключевым словам; null — если уверенности мало */
export function askExpert(question: string, snapshot: JarvisSnapshot): ExpertResult | null {
  const q = norm(question);
  if (!q.trim()) return null;

  let best: { intent: Intent; score: number } | null = null;

  for (const intent of INTENTS) {
    let score = 0;
    for (const s of intent.strong ?? []) {
      if (q.includes(norm(s))) score += 4;
    }
    for (const k of intent.keys) {
      if (q.includes(norm(k))) score += 1;
    }
    if (score > 0 && (!best || score > best.score)) best = { intent, score };
  }

  if (!best || best.score < 1) return null;

  const answer = best.intent.answer(snapshot);
  if (!answer) return null;
  return { answer, intent: best.intent.id, score: best.score };
}

/** Короткая сводка состояния — уходит в системный промпт LLM */
export function contextSummary(s: JarvisSnapshot): string {
  if (s.kind === "bending") {
    const m = MATERIALS[s.material];
    const r = s.results;
    return [
      `Открыт модуль расчёта гибки.`,
      `Деталь: "${s.name}". Материал: ${m.label} (плотность ${m.density} кг/м3). Толщина s=${s.thickness} мм. Ширина по оси гибки: ${s.width} мм.`,
      `Полки (мм): ${s.flanges.join(", ")}.`,
      `Гибы: ${s.bends.map((b, i) => `№${i + 1} ${b.angle}° ${b.dir > 0 ? "вверх" : "вниз"}`).join("; ") || "нет"}.`,
      `Результаты расчёта: развёртка ${r.flatLength} мм; K-фактор ${r.kFactor}; внутренний радиус ${r.radius} мм; матрица V=${r.vDie} мм; минимальная полка ${r.minFlange} мм; масса ${r.weight} кг; усилие ${r.tonnageTotal} тс (${r.tonnagePerM} тс/м); пружинение: ${m.springback}.`,
      `Позиции линий гиба на развёртке: ${r.bends.map((b, i) => `B${i + 1} на ${b.position.toFixed(1)} мм (BA ${b.ba.toFixed(2)})`).join("; ") || "нет"}.`,
      s.holes.length ? `Отверстия: ${s.holes.map((h) => `Ø${h.d} в (${h.x}, ${h.y})`).join("; ")}.` : `Отверстий нет.`,
      r.warnings.length ? `Предупреждения расчёта: ${r.warnings.join(" | ")}.` : `Предупреждений нет.`,
      s.machine
        ? `Проверка на прессе ${s.machine.model} (ручей ${s.machine.dieLabel}): ${s.machine.checks
            .map((c) => `${c.label} — ${c.value} при пределе ${c.limit} [${c.status}]`)
            .join("; ")}.`
        : "",
    ].filter(Boolean).join("\n");
  }

  if (s.kind === "quote") {
    return [
      `Открыт модуль коммерческого предложения.`,
      `Клиент: ${s.clientName ?? "не выбран"}. Скидка ${s.discountPct}%, НДС ${s.vatPct}%.`,
      `Позиции:`,
      ...s.items.map(
        (i, idx) =>
          `${idx + 1}. "${i.name}" — ${MATERIALS[i.material].label} s=${i.thickness}, ${i.len}×${i.wid} мм, ${i.qty} шт, гибов ${i.bends}, резка ${TECH[i.tech].label}${i.paint ? ", покраска" : ""}. Цена ${i.unitPrice} ₽/шт, сумма ${i.totalPrice} ₽ (металл ${i.materialCost}, резка ${i.cutCost}, гибка ${i.bendCost}).`
      ),
      `Итоги: подытог ${s.totals.subtotal} ₽, скидка ${s.totals.discount} ₽, НДС ${s.totals.vat} ₽, к оплате ${s.totals.totalClient} ₽, масса ${s.totals.totalMass} кг.`,
      ...(s.nesting.length
        ? [
            `Раскрой:`,
            ...s.nesting.map(
              (g) =>
                `- ${MATERIALS[g.material].label} s=${g.thickness}: лист ${g.sheetLabel}, ${g.sheetCount} шт, использование ${(g.utilization * 100).toFixed(1)}%, металл по раскрою ${g.grossCost} ₽ (оценка ×1.25 дала бы ${g.estimateCost} ₽), отход ${g.wasteArea} м², деловой остаток ${g.remnantArea} м².`
            ),
          ]
        : []),
    ].join("\n");
  }

  return [
    `Пользователь на странице "${s.page}". Активного расчёта нет.`,
    `Возможности цеха: ${capabilitySummary().join(" ")}`,
  ].join("\n");
}

/** Подсказки-кнопки под конкретный экран */
export function suggestions(s: JarvisSnapshot): string[] {
  if (s.kind === "bending") {
    return [
      "Сможем согнуть на нашем станке?",
      "Проверь деталь",
      "Какая минимальная полка?",
      "Какое усилие нужно?",
      "Сколько стоит?",
    ];
  }
  if (s.kind === "quote") {
    return [
      "Сколько листов нужно?",
      "Из чего сложилась цена?",
      "Какой процент отхода?",
      "Какая скидка за серию?",
    ];
  }
  return ["Что ты умеешь?", "Что попадает в DXF?", "Лазер или плазма?"];
}
