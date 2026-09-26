import { Suspense } from "react";
import { QuoteBuilder } from "@/components/quote-builder";

export const metadata = {
  title: "Менеджеру — коммерческое предложение · ФАЙЕРПРОМ",
};

export default function KpPage() {
  return (
    <Suspense
      fallback={
        <div className="panel panel-pad mt-6 text-sm text-steel">
          Загрузка конструктора КП…
        </div>
      }
    >
      <QuoteBuilder />
    </Suspense>
  );
}
