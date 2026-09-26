import { HistoryView } from "@/components/history-view";

export const metadata = {
  title: "История — расчёты, КП и клиенты · ФАЙЕРПРОМ",
};

export default function HistoryPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="micro">Единое хранилище</p>
        <h1 className="mt-2 font-display text-2xl font-semibold sm:text-3xl">
          История <span className="text-accent">/</span> клиенты
        </h1>
      </div>
      <HistoryView />
    </div>
  );
}
