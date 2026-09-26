import { Cog, Wrench, TriangleAlert, Gauge, Scan, FileCheck2, Layers } from "lucide-react";
import { MACHINE, availableVs, maxToolLength, toolAngle } from "@/lib/machine";
import { LASER, LASER_MAX_T, BEND, SERVICES, ORDER_DOCS } from "@/lib/shop";
import { MATERIALS, type MaterialKey } from "@/lib/materials";

export const metadata = {
  title: "Гибочный пресс PBA 70-2500-4C · ФАЙЕРПРОМ",
  description: "Паспорт станка, наличная оснастка и рабочие диапазоны гибки.",
};

const nf = (v: number, d = 1) =>
  v.toLocaleString("ru-RU", { maximumFractionDigits: d });

export default function MachinePage() {
  const vs = availableVs();
  const v = vs[0] ?? 12;
  const toolLen = maxToolLength();
  const tAngle = toolAngle();
  const punchH = Math.max(...MACHINE.punches.map((p) => p.height));
  const dieH = Math.max(...MACHINE.dies.map((d) => d.height));
  const daylight = MACHINE.openHeight - punchH - dieH;

  // рабочий диапазон толщин по усилию для каждого материала
  const ranges = (Object.keys(MATERIALS) as MaterialKey[]).map((k) => {
    const m = MATERIALS[k];
    // максимальная толщина по нагрузке на матрицу (100 тс/м)
    const dieMax = Math.max(...MACHINE.dies.map((d) => d.maxLoad));
    const tByDie = Math.sqrt((dieMax * 9.80665 * v) / (650 * m.forceFactor));
    // максимум по усилию пресса на всю длину оснастки
    const tByPress = Math.sqrt(
      (MACHINE.forceT * 9.80665 * v) / (650 * m.forceFactor * (toolLen / 1000))
    );
    return {
      key: k,
      label: m.label,
      opt: v / 8,
      tByDie,
      tByPress,
      limit: Math.min(tByDie, tByPress, v / 4),
    };
  });

  const KEY = [
    { icon: Gauge, label: "Усилие", value: `${MACHINE.forceT} тс`, note: `${MACHINE.forceKn} кН` },
    { icon: Cog, label: "Длина стола", value: `${MACHINE.lengthMm} мм`, note: `между стоек ${MACHINE.betweenHousings}` },
    { icon: Wrench, label: "Оснастка", value: `V${vs.join(" / V")}`, note: `${tAngle}° · ${toolLen} мм` },
    { icon: TriangleAlert, label: "Просвет съёма", value: `${daylight} мм`, note: `раскрытие ${MACHINE.openHeight}` },
  ];

  return (
    <div className="space-y-8">
      <div>
        <p className="micro">Оборудование цеха</p>
        <h1 className="mt-2 font-display text-2xl font-semibold sm:text-3xl">
          {MACHINE.model} <span className="text-accent">·</span> гибочный пресс
        </h1>
        <p className="mt-2 text-sm text-steel">
          {MACHINE.vendor} ({MACHINE.country}) · ЧПУ {MACHINE.cnc} · оси {MACHINE.axes}
        </p>
        <p className="mt-3 max-w-3xl text-[13px] leading-relaxed text-steel">
          Расчёт гибки идёт по этому паспорту: раскрыв ручья берётся из наличной
          оснастки, а не подбирается теоретически. Каждая деталь проверяется на
          усилие, нагрузку на матрицу, длину гиба, ход упора, зев и просвет для съёма.
        </p>
      </div>

      {/* ключевые параметры */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {KEY.map((k) => {
          const Icon = k.icon;
          return (
            <div key={k.label} className="panel panel-pad">
              <div className="flex items-center justify-between">
                <p className="micro">{k.label}</p>
                <Icon size={14} className="text-steel" strokeWidth={1.6} />
              </div>
              <p className="num mt-2 text-xl text-ink">{k.value}</p>
              <p className="micro mt-1">{k.note}</p>
            </div>
          );
        })}
      </div>

      {/* рабочие диапазоны */}
      <div className="panel panel-pad overflow-x-auto">
        <p className="micro">Рабочие толщины на ручье V{v}</p>
        <p className="mt-2 text-[12px] text-steel">
          Предел считается по двум условиям: несущая способность матрицы и усилие
          пресса на полной длине оснастки ({toolLen} мм).
        </p>
        <table className="tbl mt-4 min-w-[640px]">
          <thead>
            <tr>
              <th>Материал</th>
              <th>Оптимум</th>
              <th>Предел по матрице</th>
              <th>Предел по прессу</th>
              <th>Рабочий максимум</th>
            </tr>
          </thead>
          <tbody>
            {ranges.map((r) => (
              <tr key={r.key}>
                <td className="text-ghost">{r.label}</td>
                <td className="num text-accent">{nf(r.opt)} мм</td>
                <td className="num text-steel">{nf(r.tByDie)} мм</td>
                <td className="num text-steel">{nf(r.tByPress)} мм</td>
                <td className="num text-ok">до {nf(r.limit)} мм</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-[11px] leading-relaxed text-steel">
          Минимальная полка на V{v} — {nf(v * 0.7)} мм. Формируемый внутренний радиус
          ≈ {nf(0.16 * v, 2)} мм. Наконечник {tAngle}° позволяет поворот до{" "}
          {180 - tAngle}° — острее угол этой оснасткой не сделать.
        </p>
      </div>

      {/* оснастка */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="panel panel-pad overflow-x-auto">
          <p className="micro">Пуансоны</p>
          <table className="tbl mt-3 min-w-[380px]">
            <thead>
              <tr>
                <th>Наименование</th>
                <th>R</th>
                <th>H</th>
                <th>L</th>
                <th>Кол-во</th>
              </tr>
            </thead>
            <tbody>
              {MACHINE.punches.map((p) => (
                <tr key={p.id}>
                  <td className="text-ghost">
                    {p.label}
                    {p.sectioned && <span className="micro ml-2">секц.</span>}
                  </td>
                  <td className="num">{p.radius}</td>
                  <td className="num">{p.height}</td>
                  <td className="num">{p.length}</td>
                  <td className="num">{p.qty}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="panel panel-pad overflow-x-auto">
          <p className="micro">Матрицы</p>
          <table className="tbl mt-3 min-w-[380px]">
            <thead>
              <tr>
                <th>Наименование</th>
                <th>V</th>
                <th>L</th>
                <th>Нагрузка</th>
                <th>Кол-во</th>
              </tr>
            </thead>
            <tbody>
              {MACHINE.dies.map((d) => (
                <tr key={d.id}>
                  <td className="text-ghost">
                    {d.label}
                    {d.sectioned && <span className="micro ml-2">секц.</span>}
                  </td>
                  <td className="num">{d.v}</td>
                  <td className="num">{d.length}</td>
                  <td className="num text-amber">{d.maxLoad} тс/м</td>
                  <td className="num">{d.qty}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-[11px] leading-relaxed text-steel">
            Для китайских матриц паспортная нагрузка не заявлена — в расчёте принята
            консервативная 70 тс/м. Уточните у поставщика и поправьте в{" "}
            <span className="num text-ghost">src/lib/machine.ts</span>.
          </p>
        </div>
      </div>

      {/* регламент производства */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="panel panel-pad">
          <div className="flex items-center gap-2">
            <Scan size={15} className="text-accent" />
            <p className="micro">Лазерная резка</p>
          </div>
          <dl className="mt-3 space-y-2">
            {[
              ["Рабочее поле", `${LASER.fieldW} × ${LASER.fieldH} мм`],
              ["Поле раскроя", `${LASER.cutW} × ${LASER.cutH} мм`],
              ["Стандартный лист", `${LASER.sheetW} × ${LASER.sheetH} мм`],
              ["Сталь / оцинковка", `до ${LASER_MAX_T.steel} мм`],
              ["Нержавеющая сталь", `до ${LASER_MAX_T.stainless} мм`],
              ["Алюминий и сплавы", `до ${LASER_MAX_T.aluminum} мм`],
              ["Цветные металлы", "по запросу"],
            ].map(([k, v]) => (
              <div key={k} className="flex items-start justify-between gap-3 border-b border-line/40 pb-2 last:border-none">
                <dt className="text-[12px] text-steel">{k}</dt>
                <dd className="num shrink-0 text-right text-[12px] text-ghost">{v}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="panel panel-pad">
          <div className="flex items-center gap-2">
            <Layers size={15} className="text-accent" />
            <p className="micro">Гибка · регламент</p>
          </div>
          <dl className="mt-3 space-y-2">
            {[
              ["Толщина штатно", `${BEND.minT}–${BEND.maxT} мм`],
              ["Толще", "по согласованию"],
              ["Максимальная ширина", `${BEND.maxWidth} мм`],
              ["Глубина при полной ширине", `${BEND.maxDepthWide} мм`],
              [`Глубина при ширине ≤ ${BEND.narrowWidth}`, `${BEND.maxDepthNarrow} мм`],
              ["Минимальная полка", `${BEND.minFlange} мм`],
              ["Минимальный внутренний размер", `${BEND.minInternal} мм`],
              ["Радиус гиба", "R = t (равен толщине)"],
            ].map(([k, v]) => (
              <div key={k} className="flex items-start justify-between gap-3 border-b border-line/40 pb-2 last:border-none">
                <dt className="text-[12px] text-steel">{k}</dt>
                <dd className="num shrink-0 text-right text-[12px] text-ghost">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-[11px] leading-relaxed text-warn">
            R = t и радиус воздушной гибки на V{v} ({nf(0.16 * v, 1)} мм) совпадают
            около t = 2 мм. На тонком металле R = t достижим калибровкой или узким
            ручьём — в калькуляторе режим переключается.
          </p>
        </div>

        <div className="panel panel-pad">
          <div className="flex items-center gap-2">
            <FileCheck2 size={15} className="text-accent" />
            <p className="micro">Комплект на заказ</p>
          </div>
          <div className="mt-3 space-y-3">
            {ORDER_DOCS.map((d) => (
              <div key={d.id}>
                <p className="flex items-center gap-1.5 text-[12px] text-ink">
                  <span className="h-1.5 w-1.5 shrink-0 bg-accent" />
                  {d.title}
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-steel">{d.detail}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 border-t border-line pt-3">
            <p className="micro mb-2">Услуги</p>
            <div className="flex flex-wrap gap-1.5">
              {SERVICES.map((sv) => (
                <span key={sv.key} className="chip">
                  {sv.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* паспорт */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {MACHINE.spec.map((g) => (
          <div key={g.group} className="panel panel-pad">
            <p className="micro">{g.group}</p>
            <dl className="mt-3 space-y-2">
              {g.rows.map(([k, val]) => (
                <div key={k} className="flex items-start justify-between gap-3 border-b border-line/40 pb-2 last:border-none">
                  <dt className="text-[12px] text-steel">{k}</dt>
                  <dd className="num shrink-0 text-right text-[12px] text-ghost">{val}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </div>
  );
}
