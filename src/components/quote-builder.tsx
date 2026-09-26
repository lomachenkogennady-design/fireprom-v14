"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Plus,
  Trash2,
  Save,
  Printer,
  UserPlus,
  DraftingCompass,
  Check,
  Banknote,
  FileUp,
  ShieldAlert,
  FileCheck2,
} from "lucide-react";
import { MATERIALS, THICKNESSES, type MaterialKey } from "@/lib/materials";
import {
  calcItem,
  calcQuote,
  TECH,
  TECH_KEYS,
  MIN_ORDER,
  type QuoteItemInput,
  type QuoteItemCalc,
  type TechKey,
} from "@/lib/pricing";
import { scanDxf } from "@/lib/dxf-import";
import { usePublishSnapshot } from "@/lib/jarvis/provider";
import { NestingView, type NestGroupInput } from "@/components/nesting-view";
import { bestSheet } from "@/lib/nesting";
import { checkShop, laserThicknesses, ORDER_DOCS } from "@/lib/shop";
import { rub, clsx } from "@/lib/format";

interface ClientRow {
  id: number;
  name: string;
  phone?: string | null;
  contact?: string | null;
}

interface ItemState extends QuoteItemInput {
  key: string;
}

let uid = 0;
const nextKey = () => `it_${++uid}_${Date.now()}`;

function emptyItem(): ItemState {
  return {
    key: nextKey(),
    name: "Деталь",
    material: "steel",
    tech: "laser",
    thickness: 2,
    len: 300,
    wid: 200,
    qty: 1,
    bends: 0,
    cutLen: null,
    pierces: null,
    paint: false,
    scrap: false,
  };
}

const nf = (v: number, d = 1) =>
  v.toLocaleString("ru-RU", { maximumFractionDigits: d });

export function QuoteBuilder() {
  const sp = useSearchParams();
  const booted = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [dxfNote, setDxfNote] = useState<string | null>(null);

  const [clients, setClients] = useState<ClientRow[]>([]);
  const [clientId, setClientId] = useState<number | null>(null);
  const [items, setItems] = useState<ItemState[]>([emptyItem()]);
  const [discountPct, setDiscountPct] = useState(0);
  const [vatPct, setVatPct] = useState(22);
  const [comment, setComment] = useState("");
  const [newClientName, setNewClientName] = useState("");
  const [addingClient, setAddingClient] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [savedNumber, setSavedNumber] = useState<string | null>(null);
  const [loadedNumber, setLoadedNumber] = useState<string | null>(null);

  // ---------- загрузка клиентов ----------
  function refreshClients(selectId?: number) {
    fetch("/api/clients")
      .then((r) => r.json())
      .then((rows) => {
        const list = Array.isArray(rows) ? rows : [];
        setClients(list);
        if (selectId) setClientId(selectId);
      })
      .catch(() => undefined);
  }

  useEffect(() => {
    refreshClients();

    if (booted.current) return;
    booted.current = true;

    // prefill из модуля гибки
    if (sp.get("prefill")) {
      const it = emptyItem();
      it.name = sp.get("name") ?? "Деталь";
      it.material = (sp.get("material") as MaterialKey) ?? "steel";
      it.thickness = Number(sp.get("thickness")) || 2;
      it.len = Number(sp.get("len")) || 300;
      it.wid = Number(sp.get("wid")) || 200;
      it.bends = Number(sp.get("bends")) || 0;
      setItems([it]);
    }

    // загрузка сохранённого КП
    const loadId = sp.get("load");
    if (loadId) {
      fetch(`/api/quotes/${loadId}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((q) => {
          if (!q) return;
          setLoadedNumber(q.number);
          setClientId(q.clientId ?? null);
          setDiscountPct(q.discountPct ?? 0);
          setVatPct(q.vatPct ?? 0);
          setComment(q.comment ?? "");
          if (Array.isArray(q.items) && q.items.length) {
            setItems(
              q.items.map((r: Record<string, unknown>) => ({
                key: nextKey(),
                name: String(r.name ?? "Деталь"),
                material: (r.material as MaterialKey) ?? "steel",
                tech: ((r.tech as TechKey) ?? "laser") as TechKey,
                thickness: Number(r.thickness) || 1,
                len: Number(r.len) || 100,
                wid: Number(r.wid) || 100,
                qty: Number(r.qty) || 1,
                bends: Number(r.bends) || 0,
                cutLen: r.cutLen ? Number(r.cutLen) : null,
                pierces: r.pierces ? Number(r.pierces) : null,
                paint: Boolean(r.paint),
                scrap: Boolean((r.breakdown as Record<string, unknown> | null)?.scrap),
              }))
            );
          }
        })
        .catch(() => undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const computed = useMemo(
    () => items.map((i) => ({ ...calcItem(i), key: i.key }) as QuoteItemCalc & { key: string }),
    [items]
  );
  const totals = useMemo(
    () => calcQuote(computed, discountPct, vatPct),
    [computed, discountPct, vatPct]
  );

  /** Проверка каждой позиции по регламенту цеха */
  const shopIssues = useMemo(() => {
    const m = new Map<string, ReturnType<typeof checkShop>>();
    for (const i of computed) {
      const issues = checkShop({
        material: i.material,
        thickness: i.thickness,
        len: i.len,
        wid: i.wid,
        bends: i.bends,
        bendWidth: Math.min(i.len, i.wid),
      });
      if (issues.length) m.set(i.key, issues);
    }
    return m;
  }, [computed]);

  const blocking = useMemo(
    () => [...shopIssues.values()].flat().filter((x) => x.status === "fail").length,
    [shopIssues]
  );

  /** Раскрой считается отдельно по каждой паре «материал + толщина» */
  const nestGroups = useMemo<NestGroupInput[]>(() => {
    const map = new Map<string, NestGroupInput>();
    for (const i of computed) {
      const key = `${i.material}|${i.thickness}|${i.tech}`;
      const entry = map.get(key) ?? {
        material: i.material,
        thickness: i.thickness,
        tech: i.tech,
        parts: [],
      };
      entry.parts.push({
        id: i.key,
        name: i.name,
        w: Math.max(i.len, 1),
        h: Math.max(i.wid, 1),
        qty: Math.max(i.qty, 1),
      });
      map.set(key, entry);
    }
    return [...map.values()].sort(
      (a, b) => b.parts.length - a.parts.length || a.thickness - b.thickness
    );
  }, [computed]);

  // Jarvis видит собираемое КП: позиции, себестоимость, итоги
  usePublishSnapshot({
    kind: "quote",
    clientName: clients.find((c) => c.id === clientId)?.name ?? null,
    discountPct,
    vatPct,
    nesting: nestGroups.map((g) => {
      const best = bestSheet(g.parts, {
        material: g.material,
        thickness: g.thickness,
        tech: g.tech,
      })[0];
      const r = best?.result;
      return {
        material: g.material,
        thickness: g.thickness,
        sheetLabel: r?.sheet.label ?? "—",
        sheetCount: r?.sheetCount ?? 0,
        utilization: r?.utilization ?? 0,
        grossMass: r?.grossMass ?? 0,
        netMass: r?.netMass ?? 0,
        grossCost: r?.grossCost ?? 0,
        estimateCost: r?.estimateCost ?? 0,
        wasteArea: r?.wasteArea ?? 0,
        remnantArea: r?.remnantArea ?? 0,
        remnantCredit: r?.remnantCredit ?? 0,
        oversized: r?.oversized ?? [],
      };
    }),
    items: computed.map((i) => ({
      name: i.name,
      material: i.material,
      tech: i.tech,
      thickness: i.thickness,
      len: i.len,
      wid: i.wid,
      qty: i.qty,
      bends: i.bends,
      paint: i.paint,
      scrap: i.scrap,
      mass: i.mass,
      materialCost: i.materialCost,
      cutCost: i.cutCost,
      bendCost: i.bendCost,
      paintCost: i.paintCost,
      qtyFactor: i.qtyFactor,
      scrapCredit: i.scrapCredit,
      unitPrice: i.unitPrice,
      totalPrice: i.totalPrice,
    })),
    totals: {
      subtotal: totals.subtotal,
      discount: totals.discount,
      vat: totals.vat,
      total: totals.total,
      totalClient: totals.totalClient,
      minOrderApplied: totals.minOrderApplied,
      totalMass: totals.totalMass,
    },
  });

  function patchItem(key: string, patch: Partial<ItemState>) {
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...patch } : i)));
    setSaveState("idle");
  }

  function removeItem(key: string) {
    setItems((prev) => (prev.length > 1 ? prev.filter((i) => i.key !== key) : prev));
  }

  async function onDxfFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const text = await f.text();
      const scan = scanDxf(text);
      if (!scan.ok) {
        alert("Не удалось найти геометрию в этом DXF (нужны LINE/LWPOLYLINE/ARC/CIRCLE)");
        return;
      }
      const it = emptyItem();
      it.name = f.name.replace(/\.dxf$/i, "").slice(0, 60) || "Деталь из DXF";
      const L = Math.max(scan.widthMm, scan.heightMm);
      const W = Math.min(scan.widthMm, scan.heightMm);
      it.len = Math.max(Math.round(L), 10);
      it.wid = Math.max(Math.round(W), 10);
      it.cutLen = Math.max(Math.round((scan.lengthMm / 1000) * 100) / 100, 0.1);
      it.pierces = Math.max(scan.pierces, 1);
      setItems((p) => [...p, it]);
      setDxfNote(
        `Из файла «${f.name}»: рез ${(scan.lengthMm / 1000).toFixed(2)} м, врезок ${scan.pierces} (отв. ${scan.holes}), габарит ${it.len}×${it.wid} мм — проверьте материал и толщину`
      );
      setSaveState("idle");
    } catch {
      alert("Ошибка чтения файла");
    } finally {
      e.target.value = "";
    }
  }

  async function addClient() {
    const name = newClientName.trim();
    if (!name) return;
    setAddingClient(true);
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const row = await res.json();
      if (res.ok) {
        setNewClientName("");
        refreshClients(row.id);
      }
    } finally {
      setAddingClient(false);
    }
  }

  async function save() {
    setSaveState("saving");
    try {
      const res = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          discountPct,
          vatPct,
          comment,
          items: items.map((i) => ({
            name: i.name,
            material: i.material,
            tech: i.tech,
            thickness: i.thickness,
            len: i.len,
            wid: i.wid,
            qty: i.qty,
            bends: i.bends,
            cutLen: i.cutLen,
            pierces: i.pierces,
            paint: i.paint,
            scrap: i.scrap,
          })),
        }),
      });
      const q = await res.json();
      if (!res.ok) throw new Error(q.error ?? "Ошибка");
      setSaveState("saved");
      setSavedNumber(q.number);
    } catch (e) {
      setSaveState("idle");
      alert(e instanceof Error ? e.message : "Не удалось сохранить КП");
    }
  }

  const client = clients.find((c) => c.id === clientId) ?? null;
  const today = new Date().toLocaleDateString("ru-RU");
  const displayNumber = savedNumber ?? loadedNumber ?? `черновик от ${today}`;

  return (
    <div className="space-y-6">
      {/* заголовок */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="micro">Модуль · менеджеру</p>
          <h1 className="mt-2 font-display text-2xl font-semibold sm:text-3xl">
            Коммерческое <span className="text-accent">предложение</span>
          </h1>
          <p className="num mt-2 text-xs text-steel">
            {loadedNumber || savedNumber ? `Редактируется: ${displayNumber}` : `Новое КП · ${today}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-outline" onClick={() => window.print()}>
            <Printer size={13} /> Печать / PDF
          </button>
          <button className="btn btn-primary" onClick={save} disabled={saveState === "saving"}>
            {saveState === "saved" ? <Check size={13} /> : <Save size={13} />}
            {saveState === "saved" ? "Сохранено" : "Сохранить КП"}
          </button>
        </div>
      </div>

      {savedNumber && (
        <div className="panel border-ok/40 px-4 py-3 text-xs text-ok">
          КП сохранено с номером <span className="num">{savedNumber}</span> — оно доступно в общей истории.
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          {/* ---------- позиции ---------- */}
          <div className="panel panel-pad overflow-x-auto">
            <div className="mb-4 flex items-center justify-between">
              <p className="micro">Позиции · {items.length}</p>
              <div className="flex gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept=".dxf"
                  className="hidden"
                  onChange={onDxfFile}
                />
                <button className="btn btn-outline py-1.5!" onClick={() => fileRef.current?.click()}>
                  <FileUp size={12} /> DXF → позиция
                </button>
                <button className="btn btn-outline py-1.5!" onClick={() => setItems((p) => [...p, emptyItem()])}>
                  <Plus size={12} /> Позиция
                </button>
              </div>
            </div>

            {dxfNote && (
              <div className="mb-3 border border-amber/40 px-3 py-2 text-[11px] text-amber">
                {dxfNote}
              </div>
            )}

            <table className="tbl min-w-[1120px]">
              <thead>
                <tr>
                  <th className="w-[180px]">Наименование</th>
                  <th>Материал</th>
                  <th>Технол.</th>
                  <th>s, мм</th>
                  <th>Габарит, мм</th>
                  <th>Кол-во</th>
                  <th>Гибов</th>
                  <th>Рез, м</th>
                  <th>Покр.</th>
                  <th title="Зачёт делового остатка">Ост.</th>
                  <th></th>
                  <th className="text-right">Масса</th>
                  <th className="text-right">Цена</th>
                  <th className="text-right">Сумма</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {computed.map((it) => (
                  <tr key={it.key} className="align-top">
                    <td>
                      <input
                        className="field py-1.5!"
                        value={it.name}
                        onChange={(e) => patchItem(it.key, { name: e.target.value })}
                      />
                      {it.techError && (
                        <p className="mt-1 text-[10px] leading-tight text-warn">{it.techError}</p>
                      )}
                      {shopIssues.get(it.key)?.map((x) => (
                        <p
                          key={x.code}
                          className={clsx(
                            "mt-1 text-[10px] leading-tight",
                            x.status === "fail" ? "text-bad" : "text-warn"
                          )}
                        >
                          {x.text}
                        </p>
                      ))}
                    </td>
                    <td>
                      <select
                        className="field w-[92px]! py-1.5!"
                        value={it.material}
                        onChange={(e) => patchItem(it.key, { material: e.target.value as MaterialKey })}
                      >
                        {Object.values(MATERIALS).map((m) => (
                          <option key={m.key} value={m.key}>
                            {m.short}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select
                        className="field w-[92px]! py-1.5!"
                        value={it.tech}
                        onChange={(e) => patchItem(it.key, { tech: e.target.value as TechKey })}
                      >
                        {TECH_KEYS.map((t) => (
                          <option key={t} value={t}>
                            {TECH[t].short}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select
                        className="field w-[76px]! py-1.5!"
                        value={it.thickness}
                        onChange={(e) => patchItem(it.key, { thickness: Number(e.target.value) })}
                      >
                        {laserThicknesses(it.material).map((t) => (
                          <option key={t} value={t}>
                            {nf(t)}
                          </option>
                        ))}
                        {!laserThicknesses(it.material).includes(it.thickness) && (
                          <option value={it.thickness}>{nf(it.thickness)} ⚠</option>
                        )}
                      </select>
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          className="field w-[72px]! py-1.5!"
                          value={it.len}
                          min={1}
                          onChange={(e) => patchItem(it.key, { len: Math.max(Number(e.target.value) || 1, 1) })}
                        />
                        <span className="text-steel">×</span>
                        <input
                          type="number"
                          className="field w-[72px]! py-1.5!"
                          value={it.wid}
                          min={1}
                          onChange={(e) => patchItem(it.key, { wid: Math.max(Number(e.target.value) || 1, 1) })}
                        />
                      </div>
                    </td>
                    <td>
                      <input
                        type="number"
                        className="field w-[64px]! py-1.5!"
                        value={it.qty}
                        min={1}
                        onChange={(e) => patchItem(it.key, { qty: Math.max(Number(e.target.value) || 1, 1) })}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        className="field w-[60px]! py-1.5!"
                        value={it.bends}
                        min={0}
                        onChange={(e) => patchItem(it.key, { bends: Math.max(Number(e.target.value) || 0, 0) })}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        className="field w-[68px]! py-1.5!"
                        value={it.cutLen ?? ""}
                        placeholder={String(it.autoCutLen)}
                        min={0}
                        step={0.1}
                        onChange={(e) =>
                          patchItem(it.key, { cutLen: e.target.value ? Number(e.target.value) : null })
                        }
                        title={`Авто: ${it.autoCutLen} м · врезок ${it.autoPierces}`}
                      />
                    </td>
                    <td className="text-center">
                      <input
                        type="checkbox"
                        checked={it.paint}
                        onChange={(e) => patchItem(it.key, { paint: e.target.checked })}
                        className="h-4 w-4"
                        title="Порошковая покраска"
                      />
                    </td>
                    <td className="text-center">
                      <input
                        type="checkbox"
                        checked={it.scrap}
                        onChange={(e) => patchItem(it.key, { scrap: e.target.checked })}
                        className="h-4 w-4"
                        title={`Зачёт делового остатка${it.scrapCredit > 0 ? `: −${rub(it.scrapCredit)}` : ""}`}
                      />
                    </td>
                    <td>
                      <Link
                        className="btn btn-ghost px-2! py-1.5! text-amber"
                        title="Рассчитать развёртку в инженерном модуле"
                        href={`/bending?name=${encodeURIComponent(it.name)}&material=${it.material}&thickness=${it.thickness}&width=${Math.min(it.len, it.wid)}&bends=${Math.max(it.bends, 1)}`}
                      >
                        <DraftingCompass size={13} />
                      </Link>
                    </td>
                    <td className="num text-right text-steel">{nf(it.mass * it.qty, 2)}</td>
                    <td className="num text-right">
                      {rub(it.unitPrice)}
                      {it.qtyFactor < 1 && (
                        <span className="block text-[10px] text-ok">серия ×{it.qtyFactor}</span>
                      )}
                      {it.scrap && it.scrapCredit > 0 && (
                        <span className="block text-[10px] text-ok">−{rub(it.scrapCredit)}</span>
                      )}
                    </td>
                    <td className="num text-right text-ink">{rub(it.totalPrice)}</td>
                    <td>
                      <button
                        className="btn btn-ghost px-2! py-1.5! hover:text-bad!"
                        onClick={() => removeItem(it.key)}
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-[11px] text-steel">
              Длина реза и врезки считаются автоматически от периметра (×1.35 на внутренние
              контуры) — можно переопределить вручную. Металл: масса ×1.25 (отход раскроя) × тариф
              материала.
            </p>
          </div>

          {blocking > 0 && (
            <div className="panel border-bad/50 px-4 py-3">
              <p className="flex items-start gap-2 text-[12px] leading-relaxed text-bad">
                <ShieldAlert size={14} className="mt-0.5 shrink-0" />
                {blocking}{" "}
                {blocking === 1 ? "позиция выходит" : "позиции выходят"} за
                возможности производства — КП с ними отправлять нельзя. Замените
                материал, толщину или разбейте деталь.
              </p>
            </div>
          )}

          {/* ---------- комплект документов ---------- */}
          <div className="panel panel-pad">
            <div className="flex items-center gap-2">
              <FileCheck2 size={15} className="text-accent" />
              <p className="micro">Что нужно от заказчика</p>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {ORDER_DOCS.map((d) => (
                <div key={d.id} className="border border-line p-3">
                  <p className="flex items-center gap-1.5 text-[12px] text-ink">
                    <span className="h-1.5 w-1.5 shrink-0 bg-accent" />
                    {d.title}
                  </p>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-steel">
                    {d.detail}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* ---------- раскрой ---------- */}
          <NestingView groups={nestGroups} />

          {/* ---------- условия ---------- */}
          <div className="panel panel-pad grid gap-4 sm:grid-cols-3">
            <div>
              <label className="micro mb-2 block">Скидка, %</label>
              <input
                type="number"
                className="field"
                value={discountPct}
                min={0}
                max={90}
                onChange={(e) => {
                  setDiscountPct(Math.min(Math.max(Number(e.target.value) || 0, 0), 90));
                  setSaveState("idle");
                }}
              />
            </div>
            <div>
              <label className="micro mb-2 block">НДС</label>
              <select
                className="field"
                value={vatPct}
                onChange={(e) => {
                  setVatPct(Number(e.target.value));
                  setSaveState("idle");
                }}
              >
                <option value={0}>Без НДС (УСН)</option>
                <option value={20}>НДС 20%</option>
                <option value={22}>НДС 22%</option>
              </select>
            </div>
            <div>
              <label className="micro mb-2 block">Комментарий в КП</label>
              <input
                className="field"
                value={comment}
                placeholder="Срок изготовления 5–7 раб. дней"
                onChange={(e) => setComment(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* ---------- правая колонка ---------- */}
        <div className="space-y-4">
          <div className="panel panel-pad">
            <p className="micro mb-3">Клиент</p>
            <select
              className="field"
              value={clientId ?? ""}
              onChange={(e) => {
                setClientId(e.target.value ? Number(e.target.value) : null);
                setSaveState("idle");
              }}
            >
              <option value="">— выбрать из базы —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <div className="mt-3 flex gap-2">
              <input
                className="field"
                placeholder="Новый клиент…"
                value={newClientName}
                onChange={(e) => setNewClientName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addClient()}
              />
              <button
                className="btn btn-outline shrink-0 px-3!"
                onClick={addClient}
                disabled={addingClient || !newClientName.trim()}
                title="Добавить клиента"
              >
                <UserPlus size={13} />
              </button>
            </div>
            {client && (
              <p className="mt-3 text-xs text-steel">
                {[client.contact, client.phone].filter(Boolean).join(" · ") || "Контакты не заполнены"}
              </p>
            )}
          </div>

          <div className="panel corner panel-pad">
            <p className="micro">Итоги</p>
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-steel">Подытог</span>
                <span className="num">{rub(totals.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-steel">Скидка {discountPct}%</span>
                <span className="num text-ok">−{rub(totals.discount)}</span>
              </div>
              {vatPct > 0 && (
                <div className="flex justify-between">
                  <span className="text-steel">НДС {vatPct}%</span>
                  <span className="num">{rub(totals.vat)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-line pt-2">
                <span className="text-steel">Общая масса</span>
                <span className="num">{nf(totals.totalMass)} кг</span>
              </div>
            </div>
            <div className="mt-5">
              <p className="micro flex items-center gap-2">
                <Banknote size={12} /> Итого к оплате
              </p>
              <p className="num mt-2 text-3xl text-accent">{rub(totals.totalClient)}</p>
              {totals.minOrderApplied && (
                <p className="mt-1 text-[11px] text-warn">
                  применён минимальный заказ {rub(MIN_ORDER)}
                </p>
              )}
              <p className="num mt-1 text-[11px] text-steel">
                {displayNumber}
              </p>
            </div>
          </div>

          <div className="panel panel-pad text-[11px] leading-relaxed text-steel">
            <p className="micro mb-2">Тарифная сетка</p>
            Лазер: 30–520 ₽/м по материалу и толщине; плазма ×0.55 (от 3 мм),
            гидроабразив ×2.9. Гибка: 60–320 ₽ за гиб, после 1000 мм ×1.5.
            Покраска: 950 ₽/м². Серия: от 20 шт ×0.9, от 50 ×0.8, от 100 ×0.72 —
            на обработку. Возможен зачёт делового остатка по цене лома.
            Минимальный заказ — {rub(MIN_ORDER)}.
          </div>
        </div>
      </div>

      {/* ---------- печатная версия ---------- */}
      <div className="print-root">
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <tbody>
            <tr>
              <td>
                <div style={{ fontSize: 20, fontWeight: 700 }}>ООО «ФАЙЕРПРОМ»</div>
                <div style={{ fontSize: 11, color: "#555" }}>
                  Санкт-Петербург · лазерная резка, гибка, порошковая покраска · fire-prom.ru
                </div>
              </td>
              <td style={{ textAlign: "right" }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>
                  Коммерческое предложение {savedNumber ?? loadedNumber ?? ""}
                </div>
                <div style={{ fontSize: 11, color: "#555" }}>от {today}</div>
              </td>
            </tr>
          </tbody>
        </table>
        <hr style={{ margin: "14px 0", border: "none", borderTop: "2px solid #111" }} />
        <div style={{ fontSize: 12, marginBottom: 12 }}>
          <b>Заказчик:</b> {client?.name ?? "____________________"}
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
          <thead>
            <tr>
              {["№", "Наименование", "Материал", "Габарит, мм", "Кол-во", "Гибов", "Масса, кг", "Цена", "Сумма"].map((h) => (
                <th key={h} style={{ border: "1px solid #999", padding: "5px 6px", textAlign: "left", background: "#f0f0f0" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {computed.map((it, i) => (
              <tr key={it.key}>
                <td style={{ border: "1px solid #999", padding: "5px 6px" }}>{i + 1}</td>
                <td style={{ border: "1px solid #999", padding: "5px 6px" }}>
                  {it.name}
                  {it.paint ? " · порошковая покраска" : ""}
                </td>
                <td style={{ border: "1px solid #999", padding: "5px 6px" }}>
                  {MATERIALS[it.material].label} s={nf(it.thickness)} · {TECH[it.tech].short}
                </td>
                <td style={{ border: "1px solid #999", padding: "5px 6px" }}>{it.len}×{it.wid}</td>
                <td style={{ border: "1px solid #999", padding: "5px 6px" }}>{it.qty}</td>
                <td style={{ border: "1px solid #999", padding: "5px 6px" }}>{it.bends || "—"}</td>
                <td style={{ border: "1px solid #999", padding: "5px 6px" }}>{nf(it.mass * it.qty, 2)}</td>
                <td style={{ border: "1px solid #999", padding: "5px 6px", textAlign: "right" }}>{rub(it.unitPrice)}</td>
                <td style={{ border: "1px solid #999", padding: "5px 6px", textAlign: "right" }}>{rub(it.totalPrice)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ marginTop: 12, fontSize: 12, textAlign: "right" }}>
          <div>Подытог: <b>{rub(totals.subtotal)}</b></div>
          {totals.discount > 0 && <div>Скидка: −{rub(totals.discount)}</div>}
          {totals.vat > 0 && <div>НДС {vatPct}%: {rub(totals.vat)}</div>}
          {totals.minOrderApplied && (
            <div>Минимальная стоимость заказа: {rub(MIN_ORDER)}</div>
          )}
          <div style={{ fontSize: 16, fontWeight: 700, marginTop: 4 }}>
            ИТОГО: {rub(totals.totalClient)} {vatPct > 0 ? `(с НДС ${vatPct}%)` : "(без НДС)"}
          </div>
        </div>
        <div style={{ marginTop: 18, fontSize: 10, color: "#555" }}>
          {comment || "Срок изготовления: 5–7 рабочих дней с момента согласования КД. Цены действительны 14 дней. Оплата: 50% аванс, 50% по готовности."}
        </div>
      </div>
    </div>
  );
}
