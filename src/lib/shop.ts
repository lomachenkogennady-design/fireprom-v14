import { MATERIALS, type MaterialKey } from "./materials";

/**
 * Регламент производства ФАЙЕРПРОМ — что цех реально делает.
 *
 * Это источник истины, который главнее теоретических формул: прайс может
 * содержать тариф на 12 мм, но если лазер режет сталь только до 5 мм, такую
 * позицию нельзя ни посчитать, ни пообещать клиенту.
 */

/* ------------------------------------------------------------------ */
/* Лазерная резка                                                      */
/* ------------------------------------------------------------------ */

export const LASER = {
  /** рабочее поле станка, мм */
  fieldW: 2990,
  fieldH: 1490,
  /** максимальный размер раскроя (реза), мм */
  cutW: 2490,
  cutH: 1240,
  /** стандартный лист, мм */
  sheetW: 2500,
  sheetH: 1250,
} as const;

/** Предельная толщина реза по материалу, мм. null — только по запросу */
export const LASER_MAX_T: Record<MaterialKey, number | null> = {
  steel: 5,
  galvanized: 5,
  stainless: 3,
  aluminum: 3,
  copper: null,
  brass: null,
};

/* ------------------------------------------------------------------ */
/* Гибка                                                               */
/* ------------------------------------------------------------------ */

export const BEND = {
  /** штатный диапазон толщин, мм */
  minT: 0.2,
  /** свыше — только по согласованию */
  maxT: 2,
  /** максимальная ширина гиба, мм */
  maxWidth: 2490,
  /** максимальная глубина гиба при полной ширине, мм */
  maxDepthWide: 280,
  /** максимальная глубина при ширине до 2000 мм, мм */
  maxDepthNarrow: 470,
  /** ширина, до которой действует увеличенная глубина, мм */
  narrowWidth: 2000,
  /** минимальная высота полки, мм */
  minFlange: 11,
  /** минимальный внутренний размер замкнутого профиля, мм */
  minInternal: 12,
} as const;

/** Максимальная глубина гиба для заданной ширины детали */
export function maxBendDepth(width: number): number {
  return width <= BEND.narrowWidth ? BEND.maxDepthNarrow : BEND.maxDepthWide;
}

/**
 * Регламентный радиус гиба: внутренний радиус равен толщине (R = t).
 *
 * Расходится с воздушной гибкой на V12, которая даёт R ≈ 0.16·V ≈ 1.9 мм
 * независимо от толщины. Значения совпадают около t = 2 мм; на тонком металле
 * регламентный радиус достижим только калибровкой или узким ручьём.
 */
export function shopRadius(thickness: number): number {
  return Math.max(thickness, 0.2);
}

export type RadiusMode = "shop" | "air";

/* ------------------------------------------------------------------ */
/* Доступные толщины                                                   */
/* ------------------------------------------------------------------ */

const ALL_T = [0.2, 0.3, 0.5, 0.7, 0.8, 1, 1.2, 1.5, 2, 2.5, 3, 4, 5];

/** Толщины, доступные для резки данного материала */
export function laserThicknesses(material: MaterialKey): number[] {
  const max = LASER_MAX_T[material];
  if (max === null) return ALL_T;
  return ALL_T.filter((t) => t <= max);
}

/** Толщины, доступные для гибки (штатный диапазон + запас по согласованию) */
export function bendThicknesses(): number[] {
  return ALL_T.filter((t) => t >= BEND.minT && t <= 3);
}

/* ------------------------------------------------------------------ */
/* Услуги                                                              */
/* ------------------------------------------------------------------ */

export const SERVICES = [
  { key: "laser", label: "Лазерная резка металла" },
  { key: "bend", label: "Гибка металла" },
  { key: "weld", label: "Сварочные работы" },
  { key: "sandblast", label: "Пескоструйная обработка" },
  { key: "powder", label: "Порошковая покраска" },
] as const;

/* ------------------------------------------------------------------ */
/* Комплект документов на заказ                                        */
/* ------------------------------------------------------------------ */

export interface DocRequirement {
  id: string;
  title: string;
  required: boolean;
  detail: string;
}

export const ORDER_DOCS: DocRequirement[] = [
  {
    id: "dxf",
    title: "DXF-развёртка 1:1",
    required: true,
    detail:
      "Векторный файл с развёрткой в масштабе 1:1. Только контуры реза — без размерных линий, рамок, штампов и служебных надписей.",
  },
  {
    id: "drawing",
    title: "Конструкторский чертёж",
    required: true,
    detail:
      "Габаритные размеры, толщина и марка материала, места и углы гиба. Без чертежа заказ принимается только по развёртке — под ответственность заказчика.",
  },
  {
    id: "tz",
    title: "Техническое задание",
    required: true,
    detail:
      "Количество деталей. При необходимости: сторона защитной плёнки, порошковая окраска и цвет по RAL.",
  },
];

/* ------------------------------------------------------------------ */
/* Проверка выполнимости позиции                                       */
/* ------------------------------------------------------------------ */

export type ShopStatus = "ok" | "warn" | "fail";

export interface ShopIssue {
  status: ShopStatus;
  code: string;
  text: string;
}

export interface ShopCheckInput {
  material: MaterialKey;
  thickness: number;
  /** габарит детали (развёртки), мм */
  len: number;
  wid: number;
  bends: number;
  /** длина линии гиба, мм — если известна */
  bendWidth?: number;
  /** наибольшая глубина (высота отогнутой части), мм */
  bendDepth?: number;
  /** наименьшая полка, мм */
  minFlange?: number;
  /** внутренний размер замкнутого профиля, мм */
  internalSize?: number;
}

/** Проверяет позицию по регламенту цеха */
export function checkShop(i: ShopCheckInput): ShopIssue[] {
  const out: ShopIssue[] = [];
  const mat = MATERIALS[i.material];

  /* --- резка --- */
  const maxT = LASER_MAX_T[i.material];
  if (maxT === null) {
    out.push({
      status: "warn",
      code: "laser-request",
      text: `${mat.label}: цветные металлы режем по запросу — согласуйте возможность и срок до отправки КП.`,
    });
  } else if (i.thickness > maxT) {
    out.push({
      status: "fail",
      code: "laser-thickness",
      text: `${mat.label} ${i.thickness} мм: лазер режет этот материал до ${maxT} мм. Нужна плазма, гидроабразив или кооперация.`,
    });
  }

  const longSide = Math.max(i.len, i.wid);
  const shortSide = Math.min(i.len, i.wid);
  const fitsCut =
    (longSide <= LASER.cutW && shortSide <= LASER.cutH) ||
    (longSide <= LASER.cutH && shortSide <= LASER.cutW);
  if (!fitsCut) {
    out.push({
      status: "fail",
      code: "laser-size",
      text: `Габарит ${Math.round(i.len)} × ${Math.round(i.wid)} мм не помещается в поле раскроя ${LASER.cutW} × ${LASER.cutH} мм. Деталь придётся членить и сваривать.`,
    });
  } else if (longSide > LASER.cutW * 0.95 || shortSide > LASER.cutH * 0.95) {
    out.push({
      status: "warn",
      code: "laser-size-tight",
      text: `Деталь почти во всё поле раскроя (${LASER.cutW} × ${LASER.cutH} мм) — на листе не останется места под перемычки и другие детали.`,
    });
  }

  /* --- гибка --- */
  if (i.bends > 0) {
    if (i.thickness > BEND.maxT) {
      out.push({
        status: "warn",
        code: "bend-thickness",
        text: `Гибка ${i.thickness} мм: штатный диапазон ${BEND.minT}–${BEND.maxT} мм, толще — только по согласованию с цехом.`,
      });
    }
    if (i.thickness < BEND.minT) {
      out.push({
        status: "fail",
        code: "bend-thin",
        text: `Толщина ${i.thickness} мм меньше минимальной для гибки (${BEND.minT} мм).`,
      });
    }

    const bw = i.bendWidth ?? shortSide;
    if (bw > BEND.maxWidth) {
      out.push({
        status: "fail",
        code: "bend-width",
        text: `Длина гиба ${Math.round(bw)} мм превышает ${BEND.maxWidth} мм.`,
      });
    }

    if (i.bendDepth != null) {
      const limit = maxBendDepth(bw);
      if (i.bendDepth > limit) {
        out.push({
          status: "fail",
          code: "bend-depth",
          text: `Глубина гиба ${Math.round(i.bendDepth)} мм больше допустимой ${limit} мм при ширине ${Math.round(bw)} мм${
            bw > BEND.narrowWidth
              ? ` (до ${BEND.narrowWidth} мм ширины допускается ${BEND.maxDepthNarrow} мм)`
              : ""
          }.`,
        });
      }
    }

    if (i.minFlange != null && i.minFlange > 0 && i.minFlange < BEND.minFlange) {
      out.push({
        status: "fail",
        code: "bend-flange",
        text: `Полка ${i.minFlange} мм меньше регламентной ${BEND.minFlange} мм — деталь не удержать на ручье.`,
      });
    }

    if (i.internalSize != null && i.internalSize > 0 && i.internalSize < BEND.minInternal) {
      out.push({
        status: "fail",
        code: "bend-internal",
        text: `Внутренний размер замкнутого профиля ${i.internalSize} мм меньше минимального ${BEND.minInternal} мм.`,
      });
    }
  }

  return out;
}

/** Итоговый статус по набору замечаний */
export function shopStatus(issues: ShopIssue[]): ShopStatus {
  if (issues.some((x) => x.status === "fail")) return "fail";
  if (issues.some((x) => x.status === "warn")) return "warn";
  return "ok";
}

/** Краткая сводка возможностей — для карточек и Jarvis */
export function capabilitySummary(): string[] {
  return [
    `Лазер: поле раскроя ${LASER.cutW} × ${LASER.cutH} мм, лист ${LASER.sheetW} × ${LASER.sheetH} мм.`,
    `Резка: сталь и оцинковка до ${LASER_MAX_T.steel} мм, нержавейка до ${LASER_MAX_T.stainless} мм, алюминий до ${LASER_MAX_T.aluminum} мм, цветные — по запросу.`,
    `Гибка: ${BEND.minT}–${BEND.maxT} мм штатно, ширина до ${BEND.maxWidth} мм, глубина до ${BEND.maxDepthWide} мм (до ${BEND.maxDepthNarrow} мм при ширине ≤ ${BEND.narrowWidth} мм).`,
    `Минимальная полка ${BEND.minFlange} мм, минимальный внутренний размер ${BEND.minInternal} мм, радиус R = t.`,
  ];
}
