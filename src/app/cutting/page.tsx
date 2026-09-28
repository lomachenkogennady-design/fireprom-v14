import CuttingCalculator from "@/components/cutting-calculator";

export const metadata = {
  title: "Резка металла — FireProM",
};

export default function CuttingPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Резка металла</h1>
        <p className="mt-1 text-[14px] text-slate-500">
          Раскрой листов и резка хлыстов · MaxRects · First Fit Decreasing
        </p>
      </div>
      <CuttingCalculator />
    </div>
  );
}
