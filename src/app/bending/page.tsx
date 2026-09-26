import { Suspense } from "react";
import { BendingCalculator } from "@/components/bending-calculator";

export const metadata = {
  title: "Технологу — гибка и развёртка · ФАЙЕРПРОМ",
};

export default function BendingPage() {
  return (
    <Suspense
      fallback={
        <div className="panel panel-pad mt-6 text-sm text-steel">
          Загрузка калькулятора…
        </div>
      }
    >
      <BendingCalculator />
    </Suspense>
  );
}
