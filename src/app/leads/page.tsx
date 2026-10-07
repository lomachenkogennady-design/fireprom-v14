import { Suspense } from "react";
import LeadsClient from "@/components/LeadsClient";

export const dynamic = "force-dynamic";

export default function LeadsPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-slate-400">Загружаем заявки…</div>}>
      <LeadsClient />
    </Suspense>
  );
}
