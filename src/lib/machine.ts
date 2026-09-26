import { MATERIALS, type MaterialKey } from "./materials";

/**
 * Паспорт гибочного пресса цеха и проверка детали на выполнимость.
 *
 * Теоретический подбор матрицы (V = 6…10·s) в реальном цехе не работает:
 * гнуть можно только тем, что стоит на станке. У PBA 70-2500-4C это V12,
 * поэтому раскрыв фиксирован, а вместе с ним — радиус, минимальная полка
 * и допустимый диапазон толщин.
 */

export interface PunchTool {
  id: string;
  label: string;
  /** угол наконечника, ° */
  angle: number;
  /** радиус наконечника, мм */
  radius: number;
  /** высота, мм */
  height: number;
  /** длина, мм */
  length: number;
  sectioned: boolean;
  qty: number;
  origin: string;
}

export interface DieTool {
  id: string;
  label: string;
  /** раскрыв ручья V, мм */
  v: number;
  angle: number;
  /** радиус плеча ручья, мм */
  radius: number;
  height: number;
  length: number;
  /** предельная удельная нагрузка, тс/м */
  maxLoad: number;
  sectioned: boolean;
  qty: number;
  origin: string;
}

export interface MachineProfile {
  model: string;
  vendor: string;
  country: string;
  /** номинальное усилие, тс */
  forceT: number;
  forceKn: number;
  /** рабочая длина, мм */
  lengthMm: number;
  /** расстояние между стойками, мм */
  betweenHousings: number;
  /** ход траверсы, мм */
  stroke: number;
  /** раскрытие (максимальный просвет), мм */
  openHeight: number;
  /** зев (вылет), мм */
  throat: number;
  /** ход заднего упора по X, мм */
  backgaugeX: number;
  /** ход заднего упора по R, мм */
  backgaugeR: number;
  accuracy: number;
  cnc: string;
  axes: string;
  mount: string;
  crowning: string;
  punches: PunchTool[];
  dies: DieTool[];
  /** прочие паспортные данные для карточки станка */
  spec: { group: string; rows: [string, string][] }[];
}

export const MACHINE: MachineProfile = {
  model: "PBA 70-2500-4C",
  vendor: "ANHUI DONGHAI MACHINE TOOL CO., LTD",
  country: "КНР",
  forceT: 70,
  forceKn: 700,
  lengthMm: 2500,
  betweenHousings: 2050,
  stroke: 150,
  openHeight: 460,
  throat: 300,
  backgaugeX: 500,
  backgaugeR: 150,
  accuracy: 0.01,
  cnc: "ESA 630S (2D, сенсорный, Италия)",
  axes: "Y1 + Y2 + X + R",
  mount: "AMADA-PROMECAM",
  crowning: "моторизированная (бомбирование)",

  punches: [
    {
      id: "p-85-r06-cn",
      label: "Пуансон 85° R0,6 H135",
      angle: 85,
      radius: 0.6,
      height: 135,
      length: 835,
      sectioned: false,
      qty: 2,
      origin: "КНР",
    },
    {
      id: "p-85-r06-cn-sec",
      label: "Пуансон 85° R0,6 H135 секционный",
      angle: 85,
      radius: 0.6,
      height: 135,
      length: 835,
      sectioned: true,
      qty: 1,
      origin: "КНР",
    },
  ],

  dies: [
    {
      id: "d-v12-tecno",
      label: "Tecnostamp V12 85° H120",
      v: 12,
      angle: 85,
      radius: 2.75,
      height: 120,
      length: 835,
      maxLoad: 100,
      sectioned: false,
      qty: 2,
      origin: "Италия",
    },
    {
      id: "d-v12-tecno-sec",
      label: "Tecnostamp V12 85° H120 секционная",
      v: 12,
      angle: 85,
      radius: 2.75,
      height: 120,
      length: 800,
      maxLoad: 100,
      sectioned: true,
      qty: 1,
      origin: "Италия",
    },
    {
      id: "d-v12-cn",
      label: "Матрица V12 85° R2,75 H120",
      v: 12,
      angle: 85,
      radius: 2.75,
      height: 120,
      length: 835,
      // паспортная нагрузка китайской матрицы не указана — берём консервативно
      maxLoad: 70,
      sectioned: false,
      qty: 2,
      origin: "КНР",
    },
  ],

  spec: [
    {
      group: "Силовые параметры",
      rows: [
        ["Номинальное усилие", "700 кН (70 тс)"],
        ["Рабочая длина", "2500 мм"],
        ["Расстояние между стойками", "2050 мм"],
        ["Ход траверсы", "150 мм"],
        ["Раскрытие", "460 мм"],
        ["Зев", "300 мм"],
        ["Компенсация прогиба", "моторизированная (бомбирование)"],
      ],
    },
    {
      group: "Управление и точность",
      rows: [
        ["ЧПУ", "ESA 630S, 2D-графический сенсорный (Италия)"],
        ["Управляемые оси", "Y1 + Y2 + X + R"],
        ["Точность позиционирования", "0,01 мм"],
        ["Задний упор по X", "500 мм"],
        ["Задний упор по R", "150 мм"],
        ["Упорные блоки", "3 шт, автоперемещение по X и R"],
        ["Электронные линейки", "Givi (Италия) / Fagor (Испания)"],
      ],
    },
    {
      group: "Скорости",
      rows: [
        ["Подвод траверсы", "220 мм/с"],
        ["Рабочий ход", "15,5 мм/с"],
        ["Возврат", "200 мм/с"],
        ["Ось X", "400 мм/с"],
        ["Ось R", "60 мм/с"],
      ],
    },
    {
      group: "Привод и гидравлика",
      rows: [
        ["Мощность главного двигателя", "8,7 кВт"],
        ["Гидравлика", "HAWE (Германия)"],
        ["Масляный насос", "SUNNY (США)"],
        ["Объём гидробака", "170 л"],
        ["Масло", "ISO VG46"],
        ["Смазка направляющих", "консистентная"],
      ],
    },
    {
      group: "Подключение",
      rows: [
        ["Напряжение", "400 (380) В ±5%"],
        ["Частота", "50 ±1 Гц"],
        ["Кабель питания", "5 жил, клеммное подключение"],
        ["Заземление", "отдельный контур"],
      ],
    },
    {
      group: "Установка",
      rows: [
        ["Габариты (Д × Ш × В)", "3100 × 1600 × 2600 мм"],
        ["Масса", "5000 кг"],
        ["Бетон фундамента", "М400, класс ≥ C25"],
        ["Толщина плиты", "не менее 600 мм"],
        ["Анкерение", "обязательно"],
        ["Выдержка фундамента", "рекомендуется 30 дней"],
        ["Подъём", "только такелаж; вилочным погрузчиком запрещено"],
        ["Температура / влажность", "+15…+35 °C / 40–75%"],
      ],
    },
    {
      group: "Оснастка и комплектация",
      rows: [
        ["Крепление инструмента", "AMADA-PROMECAM"],
        ["Стандартная оснастка", "многоручейковая матрица и пуансон на всю длину"],
        ["Передние поддерживающие опоры", "2 шт"],
        ["Заднее защитное ограждение", "есть"],
        ["Выносная педаль", "с кнопкой аварийной остановки"],
      ],
    },
  ],
};

/** Доступные раскрывы ручья (уникальные V из наличной оснастки) */
export function availableVs(m: MachineProfile = MACHINE): number[] {
  return Array.from(new Set(m.dies.map((d) => d.v))).sort((a, b) => a - b);
}

/** Матрица с наибольшей несущей способностью для заданного V */
export function dieForV(v: number, m: MachineProfile = MACHINE): DieTool | null {
  const list = m.dies.filter((d) => d.v === v).sort((a, b) => b.maxLoad - a.maxLoad);
  return list[0] ?? null;
}

/** Наименьший радиус наконечника — влияет на формируемый радиус гиба */
export function minPunchRadius(m: MachineProfile = MACHINE): number {
  return Math.min(...m.punches.map((p) => p.radius));
}

/** Максимальный угол наконечника ограничивает остроту гиба */
export function toolAngle(m: MachineProfile = MACHINE): number {
  return Math.min(...m.punches.map((p) => p.angle));
}

/** Наибольшая длина цельной оснастки */
export function maxToolLength(m: MachineProfile = MACHINE): number {
  return Math.max(...m.dies.map((d) => d.length), ...m.punches.map((p) => p.length));
}

export type CheckStatus = "ok" | "warn" | "fail";

export interface MachineCheck {
  id: string;
  label: string;
  status: CheckStatus;
  value: string;
  limit: string;
  detail: string;
}

export interface MachineVerdict {
  checks: MachineCheck[];
  status: CheckStatus;
  /** сколько проверок не пройдено */
  failed: number;
  warned: number;
  die: DieTool | null;
  /** свободная высота для съёма детали, мм */
  daylight: number;
}

export interface MachineCheckInput {
  material: MaterialKey;
  thickness: number;
  /** длина гиба (ширина детали по оси гибки), мм */
  width: number;
  flanges: number[];
  bendAngles: number[];
  /** раскрыв применяемого ручья, мм */
  vDie: number;
  /** удельное усилие, тс/м */
  tonnagePerM: number;
  /** усилие на деталь, тс */
  tonnageTotal: number;
  minFlange: number;
}

/** Полная проверка детали на конкретном прессе */
export function checkOnMachine(
  i: MachineCheckInput,
  m: MachineProfile = MACHINE
): MachineVerdict {
  const checks: MachineCheck[] = [];
  const die = dieForV(i.vDie, m);
  const tAngle = toolAngle(m);
  const toolLen = maxToolLength(m);
  const punchH = Math.max(...m.punches.map((p) => p.height));
  const dieH = Math.max(...m.dies.map((d) => d.height));
  const daylight = m.openHeight - punchH - dieH;

  // 1. усилие на деталь
  const forceUse = i.tonnageTotal / m.forceT;
  checks.push({
    id: "force",
    label: "Усилие пресса",
    status: forceUse > 1 ? "fail" : forceUse > 0.85 ? "warn" : "ok",
    value: `${i.tonnageTotal.toFixed(1)} тс`,
    limit: `${m.forceT} тс`,
    detail:
      forceUse > 1
        ? `Не хватает усилия: нужно ${i.tonnageTotal.toFixed(1)} тс. Гните короткими участками или берите больший раскрыв.`
        : forceUse > 0.85
          ? `Загрузка ${(forceUse * 100).toFixed(0)}% — работа на пределе, износ станка ускоряется.`
          : `Загрузка ${(forceUse * 100).toFixed(0)}% от номинала.`,
  });

  // 2. удельная нагрузка на матрицу
  if (die) {
    const loadUse = i.tonnagePerM / die.maxLoad;
    checks.push({
      id: "die-load",
      label: "Нагрузка на матрицу",
      status: loadUse > 1 ? "fail" : loadUse > 0.85 ? "warn" : "ok",
      value: `${i.tonnagePerM.toFixed(1)} тс/м`,
      limit: `${die.maxLoad} тс/м · ${die.label}`,
      detail:
        loadUse > 1
          ? `Ручей будет раздавлен: ${i.tonnagePerM.toFixed(1)} тс/м против допустимых ${die.maxLoad}. Нужна матрица с большим V.`
          : loadUse > 0.85
            ? `Нагрузка ${(loadUse * 100).toFixed(0)}% от предельной — следите за плечами ручья.`
            : `Матрица работает в штатном режиме.`,
    });
  }

  // 3. толщина под раскрыв
  const vt = i.vDie / i.thickness;
  const tOpt = i.vDie / 8;
  checks.push({
    id: "thickness",
    label: "Толщина под V" + i.vDie,
    status: vt < 4 ? "fail" : vt < 6 ? "warn" : vt > 14 ? "warn" : "ok",
    value: `s=${i.thickness} мм · V/s = ${vt.toFixed(1)}`,
    limit: `рабочий диапазон V/s = 6…12`,
    detail:
      vt < 4
        ? `Слишком толсто для V${i.vDie}: нужен раскрыв от ${(i.thickness * 6).toFixed(0)} мм. Риск разрушить ручей и пуансон.`
        : vt < 6
          ? `Толсто для V${i.vDie}: усилие растёт, кромка мнётся. Оптимум для этого ручья — s≈${tOpt.toFixed(1)} мм.`
          : vt > 14
            ? `Тонко для V${i.vDie}: радиус получится крупный (${(0.16 * i.vDie).toFixed(1)} мм), угол «плавает».`
            : `Толщина в рабочем диапазоне ручья (оптимум s≈${tOpt.toFixed(1)} мм).`,
  });

  // 4. острота угла — ограничена наконечником
  const maxTurn = 180 - tAngle;
  const sharpest = Math.max(...i.bendAngles, 0);
  checks.push({
    id: "angle",
    label: "Угол гиба",
    status: sharpest > maxTurn ? "fail" : sharpest > maxTurn - 5 ? "warn" : "ok",
    value: `${sharpest.toFixed(0)}° (внутр. ${(180 - sharpest).toFixed(0)}°)`,
    limit: `≤ ${maxTurn}° · оснастка ${tAngle}°`,
    detail:
      sharpest > maxTurn
        ? `Наконечник ${tAngle}° не даст внутренний угол меньше ${tAngle}°. Нужен острый пуансон (30°/45°).`
        : sharpest > maxTurn - 5
          ? `Почти предел наконечника — запаса на перегиб под пружинение почти нет.`
          : `Запас на перегиб есть: до ${maxTurn}° поворота.`,
  });

  // 5. длина гиба и оснастка
  checks.push({
    id: "length",
    label: "Длина гиба",
    status:
      i.width > m.lengthMm ? "fail" : i.width > toolLen ? "warn" : "ok",
    value: `${i.width} мм`,
    limit: `оснастка ${toolLen} мм · стол ${m.lengthMm} мм`,
    detail:
      i.width > m.lengthMm
        ? `Длиннее рабочей длины стола (${m.lengthMm} мм) — деталь не поместится.`
        : i.width > toolLen
          ? `Длиннее цельной оснастки (${toolLen} мм) — соберите ручей из секций, стыки дадут след на детали.`
          : i.width > m.betweenHousings
            ? `Между стойками ${m.betweenHousings} мм — деталь заводится только с торца.`
            : `Помещается в цельную оснастку.`,
  });

  // 6. минимальная полка
  const shortest = Math.min(...i.flanges.filter((f) => f > 0), Infinity);
  const hasFlange = Number.isFinite(shortest);
  checks.push({
    id: "min-flange",
    label: "Минимальная полка",
    status: !hasFlange ? "ok" : shortest < i.minFlange ? "fail" : shortest < i.minFlange * 1.2 ? "warn" : "ok",
    value: hasFlange ? `${shortest} мм` : "—",
    limit: `≥ ${i.minFlange.toFixed(1)} мм (0,7·V)`,
    detail:
      hasFlange && shortest < i.minFlange
        ? `Полка провалится в ручей. Гните с припуском и обрезайте после.`
        : hasFlange && shortest < i.minFlange * 1.2
          ? `Полка близка к пределу — прижим будет неустойчивым.`
          : `Все полки опираются на плечи ручья.`,
  });

  // 7. задний упор
  const maxBackgauge = Math.max(...i.flanges, 0);
  checks.push({
    id: "backgauge",
    label: "Задний упор (ось X)",
    status: maxBackgauge > m.backgaugeX ? "warn" : "ok",
    value: `${maxBackgauge} мм`,
    limit: `${m.backgaugeX} мм`,
    detail:
      maxBackgauge > m.backgaugeX
        ? `Полка ${maxBackgauge} мм длиннее хода упора — базируйте по разметке или через приспособление, точность упадёт.`
        : `Все полки базируются задним упором.`,
  });

  // 8. зев: высота отогнутой части для П-образных
  const boxLike = i.bendAngles.length >= 2;
  const sideHeight = boxLike ? Math.max(i.flanges[0] ?? 0, i.flanges[i.flanges.length - 1] ?? 0) : 0;
  if (boxLike) {
    checks.push({
      id: "throat",
      label: "Зев станка",
      status: sideHeight > m.throat ? "fail" : sideHeight > m.throat * 0.8 ? "warn" : "ok",
      value: `борт ${sideHeight} мм`,
      limit: `${m.throat} мм`,
      detail:
        sideHeight > m.throat
          ? `Отогнутый борт упрётся в станину (зев ${m.throat} мм). Разбейте деталь или меняйте порядок гибов.`
          : sideHeight > m.throat * 0.8
            ? `Борт близко к станине — проверьте на пробной детали.`
            : `Борт свободно проходит в зев.`,
    });
  }

  // 9. раскрытие для съёма детали
  if (boxLike && sideHeight > 0) {
    checks.push({
      id: "daylight",
      label: "Просвет для съёма",
      status: sideHeight > daylight ? "fail" : sideHeight > daylight * 0.85 ? "warn" : "ok",
      value: `${sideHeight} мм`,
      limit: `${daylight} мм (раскрытие ${m.openHeight} − пуансон ${punchH} − матрица ${dieH})`,
      detail:
        sideHeight > daylight
          ? `Готовую деталь не вынуть: борт выше свободного просвета.`
          : `Деталь снимается без перестановки оснастки.`,
    });
  }

  const failed = checks.filter((c) => c.status === "fail").length;
  const warned = checks.filter((c) => c.status === "warn").length;

  return {
    checks,
    status: failed > 0 ? "fail" : warned > 0 ? "warn" : "ok",
    failed,
    warned,
    die,
    daylight,
  };
}

/** Рекомендация по перегибу под пружинение, ° */
export function overbendAngle(material: MaterialKey, angle: number): number {
  const comp: Record<MaterialKey, number> = {
    steel: 1.5,
    galvanized: 1.5,
    stainless: 4,
    aluminum: 2.5,
    copper: 3,
    brass: 2,
  };
  return Math.round((angle + comp[material]) * 10) / 10;
}

/** Строка с материалом для карточки станка */
export function materialFitForV(v: number): { key: MaterialKey; label: string; range: string }[] {
  return (Object.keys(MATERIALS) as MaterialKey[]).map((k) => ({
    key: k,
    label: MATERIALS[k].label,
    range: `${(v / 12).toFixed(1)}…${(v / 6).toFixed(1)} мм`,
  }));
}
