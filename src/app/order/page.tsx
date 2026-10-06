"use client";
import { useState } from "react";

const TYPES = [
  { v: "door_quote", l: "Дверь" },
  { v: "hatch_quote", l: "Люк" },
  { v: "entrance_door", l: "Дверь в подъезд" },
  { v: "collector_door", l: "Коллекторная дверь" },
  { v: "metal_structure", l: "Металлоконструкция" },
  { v: "metal_product", l: "Металлоизделие" },
  { v: "laser_cutting", l: "Лазерная резка" },
  { v: "bending", l: "Гибка металла" },
  { v: "painting", l: "Порошковая покраска" },
  { v: "measurement", l: "Замер" },
  { v: "installation", l: "Монтаж" },
  { v: "other", l: "Другое" },
];

const MAX_FILES = 10;
const MAX_FILE = 25 * 1024 * 1024;
const MAX_TOTAL = 50 * 1024 * 1024;

export default function OrderPage() {
  const [state, setState] = useState<"idle" | "sending" | "ok" | "error">("idle");
  const [number, setNumber] = useState<string>("");
  const [err, setErr] = useState<string>("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr("");
    const form = e.currentTarget;
    const fd = new FormData(form);

    const files = fd.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
    if (files.length > MAX_FILES) return setErr("Не более " + MAX_FILES + " файлов");
    let total = 0;
    for (const f of files) {
      if (f.size > MAX_FILE) return setErr("Файл " + f.name + " больше 25 МБ");
      total += f.size;
    }
    if (total > MAX_TOTAL) return setErr("Общий размер больше 50 МБ");

    fd.set("utmJson", JSON.stringify({
      utm_source: new URLSearchParams(location.search).get("utm_source"),
      utm_medium: new URLSearchParams(location.search).get("utm_medium"),
      utm_campaign: new URLSearchParams(location.search).get("utm_campaign"),
    }));
    fd.set("referrer", document.referrer || "");
    fd.set("userAgent", navigator.userAgent || "");

    setState("sending");
    try {
      const r = await fetch("/api/leads", { method: "POST", body: fd });
      const data = await r.json();
      if (r.ok && data.ok) {
        setNumber(data.number || "");
        setState("ok");
        form.reset();
      } else {
        setErr(data.error || "Не удалось отправить");
        setState("error");
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Ошибка сети");
      setState("error");
    }
  }

  if (state === "ok") {
    return (
      <main className="min-h-screen flex items-center justify-center p-6"
            style={{ background: "var(--bg)", color: "var(--ink)" }}>
        <div className="max-w-2xl w-full rounded-2xl p-8"
             style={{ background: "var(--panel)", border: "1px solid var(--line)" }}>
          <h1 className="text-3xl font-bold mb-3">Заявка принята</h1>
          <p className="opacity-70 mb-6">
            Номер вашей заявки: <b className="text-xl">{number}</b>
          </p>
          <p className="opacity-70 mb-6">Менеджер свяжется с вами в рабочее время.</p>
          <a href="/order" onClick={() => { setState("idle"); setNumber(""); }}
             className="inline-block px-5 py-3 rounded-xl font-semibold"
             style={{ background: "var(--accent)", color: "#000" }}>
            Оставить ещё одну заявку
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-4 sm:p-6"
          style={{ background: "var(--bg)", color: "var(--ink)" }}>
      <div className="max-w-3xl mx-auto rounded-2xl p-6 sm:p-8"
           style={{ background: "var(--panel)", border: "1px solid var(--line)" }}>
        <h1 className="text-3xl font-bold mb-2">Заявка в ФАЙЕРПРОМ</h1>
        <p className="opacity-70 mb-6">
          Заполните основные поля. Если данных нет — оставьте пустыми, менеджер уточнит.
        </p>

        <form onSubmit={onSubmit} className="space-y-5" encType="multipart/form-data">
          {/* Контакт */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="block text-sm font-semibold mb-1">Имя или организация *</span>
              <input name="name" required maxLength={100}
                     className="w-full rounded-lg p-3"
                     style={{ background: "var(--bg)", border: "1px solid var(--line)", color: "var(--ink)" }} />
            </label>
            <label className="block">
              <span className="block text-sm font-semibold mb-1">Телефон *</span>
              <input name="phone" required type="tel" inputMode="tel" placeholder="+7 (___) ___-__-__"
                     className="w-full rounded-lg p-3"
                     style={{ background: "var(--bg)", border: "1px solid var(--line)", color: "var(--ink)" }} />
            </label>
            <label className="block">
              <span className="block text-sm font-semibold mb-1">E-mail</span>
              <input name="email" type="email" maxLength={100}
                     className="w-full rounded-lg p-3"
                     style={{ background: "var(--bg)", border: "1px solid var(--line)", color: "var(--ink)" }} />
            </label>
            <label className="block">
              <span className="block text-sm font-semibold mb-1">Способ связи</span>
              <select name="contactMethod" className="w-full rounded-lg p-3"
                      style={{ background: "var(--bg)", border: "1px solid var(--line)", color: "var(--ink)" }}>
                <option value="phone">Звонок</option>
                <option value="email">E-mail</option>
                <option value="telegram">Telegram</option>
                <option value="max">MAX</option>
              </select>
            </label>
          </div>

          {/* Объект */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="block text-sm font-semibold mb-1">Город / регион</span>
              <input name="region" placeholder="Санкт-Петербург"
                     className="w-full rounded-lg p-3"
                     style={{ background: "var(--bg)", border: "1px solid var(--line)", color: "var(--ink)" }} />
            </label>
            <label className="block">
              <span className="block text-sm font-semibold mb-1">Адрес объекта</span>
              <input name="address" placeholder="Улица, дом, корпус"
                     className="w-full rounded-lg p-3"
                     style={{ background: "var(--bg)", border: "1px solid var(--line)", color: "var(--ink)" }} />
            </label>
          </div>

          {/* Тип заявки */}
          <label className="block">
            <span className="block text-sm font-semibold mb-1">Что нужно рассчитать *</span>
            <select name="requestType" required className="w-full rounded-lg p-3"
                    style={{ background: "var(--bg)", border: "1px solid var(--line)", color: "var(--ink)" }}>
              <option value="">— выберите —</option>
              {TYPES.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
            </select>
          </label>

          {/* Комментарий */}
          <label className="block">
            <span className="block text-sm font-semibold mb-1">Комментарий и нестандартные требования</span>
            <textarea name="message" rows={5}
                      placeholder="Материал, толщина, размеры, сроки, особые требования…"
                      className="w-full rounded-lg p-3"
                      style={{ background: "var(--bg)", border: "1px solid var(--line)", color: "var(--ink)" }} />
          </label>

          {/* Файлы */}
          <div className="rounded-lg p-4"
               style={{ background: "var(--bg)", border: "1px dashed var(--line)" }}>
            <span className="block text-sm font-semibold mb-2">Файлы: чертежи, фото, документы</span>
            <input type="file" name="files" multiple
                   accept=".jpg,.jpeg,.png,.webp,.pdf,.xls,.xlsx,.doc,.docx,.dwg,.dxf,.zip,.rar,.csv,.json,image/*,application/pdf"
                   className="block w-full text-sm" />
            <p className="opacity-60 text-xs mt-2">
              До {MAX_FILES} файлов, до 25 МБ каждый, всего до 50 МБ. DXF обрабатывается автоматически.
            </p>
          </div>

          {/* Согласие */}
          <label className="flex gap-3 items-start text-sm">
            <input type="checkbox" name="consent" value="1" required className="mt-1" />
            <span className="opacity-70">
              Согласен на обработку персональных данных ООО «ФАЙЕРПРОМ» *
            </span>
          </label>

          {err && (
            <div className="rounded-lg p-3 text-sm"
                 style={{ background: "#7f1d1d", color: "#fff" }}>{err}</div>
          )}

          <button type="submit" disabled={state === "sending"}
                  className="w-full py-4 rounded-xl font-bold text-lg disabled:opacity-50"
                  style={{ background: "var(--accent)", color: "#000" }}>
            {state === "sending" ? "Отправляем…" : "Отправить заявку"}
          </button>

          <p className="opacity-50 text-xs text-center">
            После отправки заявка попадёт менеджеру. Черновик формы сохраняется в браузере.
          </p>
        </form>
      </div>
    </main>
  );
}
