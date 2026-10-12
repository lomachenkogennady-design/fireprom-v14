"use client";

import { useEffect, useState } from "react";

interface CatalogRow {
  catalogId: number;
  key: string;
  name: string;
  unit: string;
  isActive: boolean;
  [k: string]: unknown;
}

interface CalcLine {
  kind: string;
  catalogId: number;
  name: string;
  qty: number;
  unit: string;
  price: number;
  sum: number;
}

interface CalcResult {
  subtotal: number;
  lines: CalcLine[];
  perimeterMm: number;
  areaM2: number;
  pricingVersionId: number;
  calculatedAt: string;
}

interface OrderResult {
  id: number;
  customerName: string;
  subtotal: string;
  vatAmount: string;
  totalPrice: string;
  status: string;
}

type MultiKey = "hardware" | "services";

export function DoorsConfiguratorClient() {
  // Справочники
  const [profiles, setProfiles] = useState<CatalogRow[]>([]);
  const [fillings, setFillings] = useState<CatalogRow[]>([]);
  const [finishes, setFinishes] = useState<CatalogRow[]>([]);
  const [hardware, setHardware] = useState<CatalogRow[]>([]);
  const [services, setServices] = useState<CatalogRow[]>([]);

  // Форма
  const [customerName, setCustomerName] = useState("");
  const [width, setWidth] = useState(900);
  const [height, setHeight] = useState(2000);
  const [hingeCount, setHingeCount] = useState(3);
  const [profileId, setProfileId] = useState<number | null>(null);
  const [fillingId, setFillingId] = useState<number | null>(null);
  const [extFinishId, setExtFinishId] = useState<number | null>(null);
  const [intFinishId, setIntFinishId] = useState<number | null>(null);
  const [hardwareIds, setHardwareIds] = useState<number[]>([]);
  const [serviceIds, setServiceIds] = useState<number[]>([]);

  // Результат
  const [calc, setCalc] = useState<CalcResult | null>(null);
  const [order, setOrder] = useState<OrderResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function loadCatalog() {
    try {
      const [p, f, fi, h, s] = await Promise.all([
        fetch("/api/admin/doors/profiles").then((r) => r.json()),
        fetch("/api/admin/doors/fillings").then((r) => r.json()),
        fetch("/api/admin/doors/finishes").then((r) => r.json()),
        fetch("/api/admin/doors/hardware").then((r) => r.json()),
        fetch("/api/admin/doors/services").then((r) => r.json()),
      ]);
      setProfiles((p.profiles ?? []).filter((x: CatalogRow) => x.isActive));
      setFillings((f.fillings ?? []).filter((x: CatalogRow) => x.isActive));
      setFinishes((fi.finishes ?? []).filter((x: CatalogRow) => x.isActive));
      setHardware((h.hardware ?? []).filter((x: CatalogRow) => x.isActive));
      setServices((s.services ?? []).filter((x: CatalogRow) => x.isActive));
    } catch (e) {
      setError(String(e));
    }
  }

  useEffect(() => { loadCatalog(); }, []);

  function toggleMulti(key: MultiKey, id: number) {
    const [list, setter] = key === "hardware"
      ? [hardwareIds, setHardwareIds] as const
      : [serviceIds, setServiceIds] as const;
    if (list.includes(id)) {
      setter(list.filter((x) => x !== id));
    } else {
      setter([...list, id]);
    }
  }

  async function calculate() {
    setBusy(true);
    setError(null);
    setOrder(null);
    try {
      const r = await fetch("/api/doors/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileCatalogId: profileId,
          fillingCatalogId: fillingId,
          externalFinishCatalogId: extFinishId,
          internalFinishCatalogId: intFinishId,
          hardwareCatalogIds: hardwareIds,
          serviceCatalogIds: serviceIds,
          doorWidth: width,
          doorHeight: height,
          hingeCount,
        }),
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body.message || ("HTTP " + r.status));
      setCalc(body);
    } catch (e) {
      setError(String(e));
      setCalc(null);
    } finally {
      setBusy(false);
    }
  }

  async function saveOrder() {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/doors/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName,
          profileCatalogId: profileId,
          fillingCatalogId: fillingId,
          externalFinishCatalogId: extFinishId,
          internalFinishCatalogId: intFinishId,
          hardwareCatalogIds: hardwareIds,
          serviceCatalogIds: serviceIds,
          doorWidth: width,
          doorHeight: height,
          hingeCount,
        }),
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body.message || ("HTTP " + r.status));
      setOrder(body);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  const canCalc = profileId != null && fillingId != null && hardwareIds.length > 0;

  return (
    <div className="max-w-5xl mx-auto p-6 pt-24">
      <h1 className="text-2xl font-bold mb-2">Конфигуратор двери</h1>
      <p className="text-sm text-neutral-500 mb-6">
        Соберите конфигурацию, рассчитайте и сохраните заказ
      </p>

      {error && (
        <div className="border border-red-500 bg-red-50 text-red-900 p-3 mb-4 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div>
          <h2 className="text-lg font-bold mb-3">Параметры</h2>

          <label className="block mb-3">
            <span className="text-xs text-neutral-500">Клиент</span>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="block w-full border border-neutral-400 px-2 py-1 mt-1"
              placeholder="Иванов И."
            />
          </label>

          <div className="flex gap-3 mb-3">
            <label className="flex-1">
              <span className="text-xs text-neutral-500">Ширина (мм)</span>
              <input
                type="number"
                value={width}
                onChange={(e) => setWidth(Number(e.target.value))}
                className="block w-full border border-neutral-400 px-2 py-1 mt-1"
              />
            </label>
            <label className="flex-1">
              <span className="text-xs text-neutral-500">Высота (мм)</span>
              <input
                type="number"
                value={height}
                onChange={(e) => setHeight(Number(e.target.value))}
                className="block w-full border border-neutral-400 px-2 py-1 mt-1"
              />
            </label>
            <label className="w-24">
              <span className="text-xs text-neutral-500">Петли</span>
              <select
                value={hingeCount}
                onChange={(e) => setHingeCount(Number(e.target.value))}
                className="block w-full border border-neutral-400 px-2 py-1 mt-1"
              >
                <option value={2}>2</option>
                <option value={3}>3</option>
                <option value={4}>4</option>
              </select>
            </label>
          </div>

          <label className="block mb-3">
            <span className="text-xs text-neutral-500">Профиль</span>
            <select
              value={profileId ?? ""}
              onChange={(e) => setProfileId(e.target.value ? Number(e.target.value) : null)}
              className="block w-full border border-neutral-400 px-2 py-1 mt-1"
            >
              <option value="">— выберите —</option>
              {profiles.map((p) => (
                <option key={p.catalogId} value={p.catalogId}>
                  {p.name} ({String(p.profileType ?? "")})
                </option>
              ))}
            </select>
          </label>

          <label className="block mb-3">
            <span className="text-xs text-neutral-500">Наполнение</span>
            <select
              value={fillingId ?? ""}
              onChange={(e) => setFillingId(e.target.value ? Number(e.target.value) : null)}
              className="block w-full border border-neutral-400 px-2 py-1 mt-1"
            >
              <option value="">— выберите —</option>
              {fillings.map((f) => (
                <option key={f.catalogId} value={f.catalogId}>{f.name}</option>
              ))}
            </select>
          </label>

          <div className="flex gap-3 mb-3">
            <label className="flex-1">
              <span className="text-xs text-neutral-500">Отделка наружная</span>
              <select
                value={extFinishId ?? ""}
                onChange={(e) => setExtFinishId(e.target.value ? Number(e.target.value) : null)}
                className="block w-full border border-neutral-400 px-2 py-1 mt-1"
              >
                <option value="">— нет —</option>
                {finishes.map((f) => (
                  <option key={f.catalogId} value={f.catalogId}>{f.name}</option>
                ))}
              </select>
            </label>
            <label className="flex-1">
              <span className="text-xs text-neutral-500">Отделка внутренняя</span>
              <select
                value={intFinishId ?? ""}
                onChange={(e) => setIntFinishId(e.target.value ? Number(e.target.value) : null)}
                className="block w-full border border-neutral-400 px-2 py-1 mt-1"
              >
                <option value="">— нет —</option>
                {finishes.map((f) => (
                  <option key={f.catalogId} value={f.catalogId}>{f.name}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="mb-3">
            <span className="text-xs text-neutral-500 block mb-1">Фурнитура</span>
            <div className="flex flex-wrap gap-2">
              {hardware.map((h) => (
                <button
                  key={h.catalogId}
                  type="button"
                  onClick={() => toggleMulti("hardware", h.catalogId)}
                  className={
                    "text-xs px-2 py-1 border " +
                    (hardwareIds.includes(h.catalogId)
                      ? "border-black bg-black text-white"
                      : "border-neutral-400")
                  }
                >
                  {h.name}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-3">
            <span className="text-xs text-neutral-500 block mb-1">Услуги</span>
            <div className="flex flex-wrap gap-2">
              {services.map((s) => (
                <button
                  key={s.catalogId}
                  type="button"
                  onClick={() => toggleMulti("services", s.catalogId)}
                  className={
                    "text-xs px-2 py-1 border " +
                    (serviceIds.includes(s.catalogId)
                      ? "border-black bg-black text-white"
                      : "border-neutral-400")
                  }
                >
                  {s.name}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <button
              onClick={calculate}
              disabled={!canCalc || busy}
              className="px-4 py-2 text-sm border border-black bg-black text-white disabled:opacity-50"
            >
              Рассчитать
            </button>
            {calc && (
              <button
                onClick={saveOrder}
                disabled={busy || !customerName}
                className="px-4 py-2 text-sm border border-blue-600 text-blue-700 disabled:opacity-50"
              >
                Сохранить заказ
              </button>
            )}
          </div>
        </div>

        <div>
          <h2 className="text-lg font-bold mb-3">Результат</h2>

          {!calc && !order && (
            <p className="text-sm text-neutral-500">
              Заполните форму и нажмите «Рассчитать»
            </p>
          )}

          {order && (
            <div className="border border-green-600 bg-green-50 text-green-900 p-3 mb-3 text-sm">
              Заказ <strong>#{order.id}</strong> сохранён ·
              {order.subtotal} ₽ + НДС = <strong>{order.totalPrice} ₽</strong>
            </div>
          )}

          {calc && (
            <>
              <table className="w-full text-xs mb-3">
                <thead>
                  <tr className="text-left border-b border-neutral-300">
                    <th className="py-1">Позиция</th>
                    <th className="text-right">Кол-во</th>
                    <th className="text-right">Цена</th>
                    <th className="text-right">Сумма</th>
                  </tr>
                </thead>
                <tbody>
                  {calc.lines.map((l, i) => (
                    <tr key={i} className="border-b border-neutral-100">
                      <td className="py-1">{l.name}</td>
                      <td className="text-right font-mono">
                        {l.qty} {l.unit}
                      </td>
                      <td className="text-right font-mono">{l.price}</td>
                      <td className="text-right font-mono">{l.sum}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="text-sm border-t border-neutral-300 pt-2">
                <div>Периметр: {calc.perimeterMm} мм</div>
                <div>Площадь: {calc.areaM2} м²</div>
                <div className="mt-2 text-lg font-bold">
                  Subtotal: {calc.subtotal} ₽
                </div>
                <div className="text-sm text-neutral-500">
                  + НДС 22% = {(calc.subtotal * 1.22).toFixed(2)} ₽
                </div>
                <div className="text-xs text-neutral-400 mt-1">
                  прайс v{calc.pricingVersionId}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
