"use client";

import { useRef, useState } from "react";
import { FileUp, Loader2, X } from "lucide-react";
import { scanDxf } from "@/lib/dxf-import";
import type { CuttingPart } from "@/lib/cutting";

interface Props {
  onImport: (parts: CuttingPart[]) => void;
}

interface Progress {
  total: number;
  done: number;
  failed: number;
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export default function CuttingDxfImport({ onImport }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const list = Array.from(files).filter((f) => /\.dxf$/i.test(f.name));
    if (list.length === 0) {
      setErrors(["Не найдено ни одного .dxf файла"]);
      return;
    }

    setErrors([]);
    setProgress({ total: list.length, done: 0, failed: 0 });

    const parts: CuttingPart[] = [];
    const failed: string[] = [];

    for (const file of list) {
      try {
        const text = await file.text();
        const scan = scanDxf(text);
        if (!scan.ok || scan.widthMm <= 0 || scan.heightMm <= 0) {
          failed.push(file.name);
        } else {
          parts.push({
            id: uid(),
            title: file.name.replace(/\.dxf$/i, "").slice(0, 40) || "Деталь",
            width: Math.round(scan.widthMm),
            height: Math.round(scan.heightMm),
            qty: 1,
            cutLength: Math.round(scan.lengthMm),
            pierces: scan.pierces,
          });
        }
      } catch (e) {
        failed.push(file.name);
      }
      setProgress((p) => (p ? { ...p, done: p.done + 1 } : p));
    }

    if (parts.length > 0) onImport(parts);
    if (failed.length > 0) setErrors(failed.map((f) => `Не распознан: ${f}`));

    setProgress(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept=".dxf"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={progress !== null}
          className="inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-[12px] font-bold text-amber-900 transition-colors hover:border-amber-400 hover:bg-amber-100 disabled:opacity-50"
        >
          {progress ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Загружаю {progress.done}/{progress.total}…
            </>
          ) : (
            <>
              <FileUp size={14} />
              📎 Загрузить DXF
            </>
          )}
        </button>

        <span className="text-[11px] text-slate-500">
          Габариты, длина реза и врезки подтянутся автоматически
        </span>
      </div>

      {errors.length > 0 && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-2 text-[12px] text-red-800">
          <button
            type="button"
            onClick={() => setErrors([])}
            className="float-right -mt-1 -mr-1 rounded p-1 hover:bg-red-100"
            aria-label="Закрыть"
          >
            <X size={12} />
          </button>
          {errors.map((e, i) => (
            <div key={i}>{e}</div>
          ))}
        </div>
      )}
    </div>
  );
}
