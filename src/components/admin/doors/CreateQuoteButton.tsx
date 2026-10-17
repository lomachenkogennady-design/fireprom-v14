"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CreateQuoteButton({ orderId }: { orderId: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleClick() {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(`/api/doors/orders/${orderId}/to-quote`, {
        method: "POST",
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        throw new Error(
          (data && (data.message || data.error)) || `HTTP ${r.status}`,
        );
      }
      router.push(`/kp?load=${data.quoteId}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        className="text-xs px-2 py-1 border border-blue-500 text-blue-700 hover:bg-blue-50 disabled:opacity-50"
      >
        {busy ? "Создаём…" : "Создать КП"}
      </button>
      {err && <span className="ml-2 text-xs text-red-600">{err}</span>}
    </div>
  );
}
