"use client";

import { useEffect, useState } from "react";
import CreateQuoteButton from "./CreateQuoteButton";

interface OrderSummary {
  id: number;
  customerName: string;
  subtotal: string;
  totalPrice: string;
  status: string;
  quoteId: number | null;
  createdAt: string;
}

interface HardwareItem {
  catalogId: number;
  quantity: number;
  priceAtOrder: string;
  name: string;
  key: string;
}

interface ServiceItem {
  catalogId: number;
  priceAtOrder: string;
  name: string;
  key: string;
}

interface SnapshotItem {
  kind: string;
  catalog_id: number;
  name: string;
  qty: number;
  unit: string;
  price: number;
  sum: number;
}

interface OrderDetail {
  order: {
    id: number;
    customerName: string;
    profileCatalogId: number;
    fillingCatalogId: number;
    externalFinishCatalogId: number | null;
    internalFinishCatalogId: number | null;
    doorWidth: number;
    doorHeight: number;
    hingeCount: number;
    priceListVersionId: number | null;
    subtotal: string;
    vatRate: string;
    vatAmount: string;
    totalPrice: string;
    status: string;
    note: string | null;
    createdAt: string;
    updatedAt: string;
    pricingSnapshot: {
      format_version: string;
      pricing_engine_version: string;
      price_list_version_id: number;
      items: SnapshotItem[];
      subtotal: number;
    };
  };
  hardware: HardwareItem[];
  services: ServiceItem[];
}

export function OrdersListClient() {
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [details, setDetails] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/doors/orders");
      if (!r.ok) throw new Error("HTTP " + r.status);
      const j = await r.json();
      setOrders(j.orders ?? []);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function expand(id: number) {
    if (expandedId === id) {
      setExpandedId(null);
      setDetails(null);
      return;
    }
    setExpandedId(id);
    setDetails(null);
    try {
      const r = await fetch("/api/doors/orders/" + id);
      if (r.ok) setDetails(await r.json());
    } catch {}
  }

  return (
    <div className="max-w-5xl mx-auto p-6 pt-24">
      <div className="flex items-baseline justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Заказы дверей</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Сохранённые заказы с pricing_snapshot
          </p>
        </div>
        <button
          onClick={load}
          className="text-xs px-3 py-1 border border-neutral-400"
        >
          Обновить
        </button>
      </div>

      {error && (
        <div className="border border-red-500 bg-red-50 text-red-900 p-3 mb-4 text-sm">
          {error}
        </div>
      )}

      {loading && <p className="text-sm text-neutral-500">Загрузка…</p>}

      {!loading && orders.length === 0 && (
        <p className="text-sm text-neutral-500">Нет заказов</p>
      )}

      <div className="space-y-2">
        {orders.map((o) => (
          <div key={o.id} className="border border-neutral-300 p-3">
            <button
              onClick={() => expand(o.id)}
              className="w-full text-left flex items-baseline justify-between"
            >
              <div>
                <div className="font-bold">
                  #{o.id} · {o.customerName}
                  <span className="ml-2 text-xs font-normal px-2 py-0.5 border border-neutral-500 text-neutral-700">
                    {o.status}
                  </span>
                </div>
                <div className="text-xs text-neutral-500 mt-1">
                  {new Date(o.createdAt).toLocaleString("ru-RU")}
                  {o.quoteId && " · КП #" + o.quoteId}
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono text-sm">{o.subtotal} ₽</div>
                <div className="font-mono text-xs text-neutral-500">
                  итого: {o.totalPrice} ₽
                </div>
              </div>
            </button>
            {!o.quoteId && <CreateQuoteButton orderId={o.id} />}

            {expandedId === o.id && (
              <div className="mt-4 pt-4 border-t border-neutral-200">
                {!details && (
                  <p className="text-sm text-neutral-500">Загрузка…</p>
                )}
                {details && <OrderDetailView data={details} />}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function OrderDetailView({ data }: { data: OrderDetail }) {
  const { order, hardware, services } = data;
  const snapshot = order.pricingSnapshot;

  return (
    <div className="text-sm">
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <h3 className="text-xs font-bold uppercase mb-2">Конфигурация</h3>
          <div className="text-xs space-y-1">
            <div>Ширина: {order.doorWidth} мм</div>
            <div>Высота: {order.doorHeight} мм</div>
            <div>Петель: {order.hingeCount}</div>
            <div>Профиль: #{order.profileCatalogId}</div>
            <div>Наполнение: #{order.fillingCatalogId}</div>
            <div>Отделка внеш.: {order.externalFinishCatalogId ?? "—"}</div>
            <div>Отделка внутр.: {order.internalFinishCatalogId ?? "—"}</div>
          </div>
        </div>
        <div>
          <h3 className="text-xs font-bold uppercase mb-2">Финансы</h3>
          <div className="text-xs space-y-1 font-mono">
            <div>Subtotal: {order.subtotal} ₽</div>
            <div>НДС {order.vatRate}%: {order.vatAmount} ₽</div>
            <div className="font-bold">Total: {order.totalPrice} ₽</div>
          </div>
          <div className="text-xs text-neutral-500 mt-2">
            Прайс v{order.priceListVersionId} · формат {snapshot.format_version} ·
            движок {snapshot.pricing_engine_version}
          </div>
        </div>
      </div>

      <h3 className="text-xs font-bold uppercase mb-2 mt-4">
        Фурнитура ({hardware.length})
      </h3>
      {hardware.length === 0 && <p className="text-xs text-neutral-500">—</p>}
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left border-b border-neutral-300">
            <th className="py-1">Код</th>
            <th>Название</th>
            <th className="text-right">Кол-во</th>
            <th className="text-right">Цена</th>
          </tr>
        </thead>
        <tbody>
          {hardware.map((h) => (
            <tr key={h.catalogId} className="border-b border-neutral-100">
              <td className="py-1 font-mono">{h.key}</td>
              <td>{h.name}</td>
              <td className="text-right font-mono">{h.quantity}</td>
              <td className="text-right font-mono">{h.priceAtOrder}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3 className="text-xs font-bold uppercase mb-2 mt-4">
        Услуги ({services.length})
      </h3>
      {services.length === 0 && <p className="text-xs text-neutral-500">—</p>}
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left border-b border-neutral-300">
            <th className="py-1">Код</th>
            <th>Название</th>
            <th className="text-right">Цена</th>
          </tr>
        </thead>
        <tbody>
          {services.map((s) => (
            <tr key={s.catalogId} className="border-b border-neutral-100">
              <td className="py-1 font-mono">{s.key}</td>
              <td>{s.name}</td>
              <td className="text-right font-mono">{s.priceAtOrder}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <details className="mt-4">
        <summary className="text-xs text-neutral-500 cursor-pointer">
          Снапшот ({snapshot.items.length} позиций)
        </summary>
        <table className="w-full text-xs mt-2">
          <thead>
            <tr className="text-left border-b border-neutral-300">
              <th className="py-1">Тип</th>
              <th>Название</th>
              <th className="text-right">Кол-во</th>
              <th className="text-right">Цена</th>
              <th className="text-right">Сумма</th>
            </tr>
          </thead>
          <tbody>
            {snapshot.items.map((it, i) => (
              <tr key={i} className="border-b border-neutral-100">
                <td className="py-1 text-neutral-500">{it.kind}</td>
                <td>{it.name}</td>
                <td className="text-right font-mono">{it.qty} {it.unit}</td>
                <td className="text-right font-mono">{it.price}</td>
                <td className="text-right font-mono">{it.sum}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
