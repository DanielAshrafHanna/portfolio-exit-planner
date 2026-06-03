"use client";

import Papa from "papaparse";
import { Download, FileUp, Plus, Sparkles } from "lucide-react";
import type { HoldingInput } from "@/lib/types";
import { totalCostFor } from "@/lib/calculations";
import { sampleHoldings } from "@/lib/sampleData";

type Props = {
  holdings: HoldingInput[];
  onChange: (holdings: HoldingInput[]) => void;
  onAnalyze: () => void;
  isAnalyzing: boolean;
};

const emptyHolding = (): HoldingInput => ({
  id: crypto.randomUUID(),
  symbol: "",
  name: "",
  shares: 0,
  averageCost: 0,
  totalCost: 0,
  notes: ""
});

export function PortfolioInput({ holdings, onChange, onAnalyze, isAnalyzing }: Props) {
  const update = (id: string, key: keyof HoldingInput, value: string) => {
    onChange(holdings.map((holding) => {
      if (holding.id !== id) return holding;
      const next = { ...holding, [key]: ["shares", "averageCost", "totalCost", "brokerCurrentValue"].includes(key) ? Number(value) || 0 : value };
      if (key === "shares" || key === "averageCost") next.totalCost = totalCostFor(next.shares, next.averageCost);
      return next;
    }));
  };

  const importCsv = (file?: File) => {
    if (!file) return;
    Papa.parse<Record<string, string>>(file, {
      header: true,
      complete: (result) => {
        const rows = result.data.filter((row) => row.Symbol || row.symbol).map((row) => {
          const shares = Number(row.Shares || row.shares || 0);
          const averageCost = Number(row["Average cost"] || row.averageCost || row.avgCost || 0);
          return {
            id: crypto.randomUUID(),
            symbol: String(row.Symbol || row.symbol || "").toUpperCase(),
            name: String(row.Name || row.name || ""),
            shares,
            averageCost,
            totalCost: Number(row["Total cost"] || row.totalCost || totalCostFor(shares, averageCost)),
            brokerCurrentValue: row["Broker current value"] ? Number(row["Broker current value"]) : undefined,
            notes: String(row.Notes || row.notes || "")
          };
        });
        onChange(rows);
      }
    });
  };

  const exportCsv = () => {
    const csv = Papa.unparse(holdings.map((holding) => ({
      Symbol: holding.symbol,
      Name: holding.name,
      Shares: holding.shares,
      "Average cost": holding.averageCost,
      "Total cost": holding.totalCost,
      "Broker current value": holding.brokerCurrentValue ?? "",
      Notes: holding.notes ?? ""
    })));
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "portfolio-exit-planner.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Portfolio input</h2>
          <p className="text-sm text-ink/65">Stored locally by default. Data is sent to market/news APIs only when you run analysis.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="inline-flex items-center gap-2 rounded-md bg-marine px-3 py-2 text-sm font-semibold text-white" type="button" onClick={() => onChange([...holdings, emptyHolding()])}>
            <Plus className="h-4 w-4" aria-hidden /> Add row
          </button>
          <button className="rounded-md border border-ink/15 px-3 py-2 text-sm font-semibold" type="button" onClick={() => onChange(sampleHoldings)}>Replace with demo</button>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-ink/15 px-3 py-2 text-sm font-semibold">
            <FileUp className="h-4 w-4" aria-hidden /> Import CSV
            <input className="sr-only" type="file" accept=".csv" onChange={(event) => importCsv(event.target.files?.[0])} />
          </label>
          <button className="inline-flex items-center gap-2 rounded-md border border-ink/15 px-3 py-2 text-sm font-semibold" type="button" onClick={exportCsv}>
            <Download className="h-4 w-4" aria-hidden /> Export CSV
          </button>
          <button className="inline-flex items-center gap-2 rounded-md bg-coral px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" type="button" onClick={onAnalyze} disabled={isAnalyzing || holdings.every((h) => !h.symbol)}>
            <Sparkles className="h-4 w-4" aria-hidden /> {isAnalyzing ? "Analyzing..." : "Analyze"}
          </button>
        </div>
      </div>
      <div className="table-scroll overflow-x-auto border-y border-ink/10 bg-white">
        <table className="min-w-[1050px] w-full text-left text-sm">
          <thead className="bg-mint/60 text-xs uppercase text-ink/65">
            <tr>
              {["Symbol", "Company/ETF", "Shares", "Avg cost", "Total cost", "Broker value", "Notes", ""].map((head) => <th className="px-3 py-2" key={head}>{head}</th>)}
            </tr>
          </thead>
          <tbody>
            {holdings.map((holding) => (
              <tr className="border-t border-ink/10" key={holding.id}>
                <td className="px-3 py-2"><input className="w-24 rounded border border-ink/15 px-2 py-1 font-semibold uppercase" value={holding.symbol} onChange={(event) => update(holding.id, "symbol", event.target.value.toUpperCase())} /></td>
                <td className="px-3 py-2"><input className="w-52 rounded border border-ink/15 px-2 py-1" value={holding.name} onChange={(event) => update(holding.id, "name", event.target.value)} /></td>
                <td className="px-3 py-2"><input className="w-24 rounded border border-ink/15 px-2 py-1" type="number" value={holding.shares} onChange={(event) => update(holding.id, "shares", event.target.value)} /></td>
                <td className="px-3 py-2"><input className="w-28 rounded border border-ink/15 px-2 py-1" type="number" value={holding.averageCost} onChange={(event) => update(holding.id, "averageCost", event.target.value)} /></td>
                <td className="px-3 py-2"><input className="w-28 rounded border border-ink/15 px-2 py-1" type="number" value={holding.totalCost} onChange={(event) => update(holding.id, "totalCost", event.target.value)} /></td>
                <td className="px-3 py-2"><input className="w-28 rounded border border-ink/15 px-2 py-1" type="number" value={holding.brokerCurrentValue ?? ""} onChange={(event) => update(holding.id, "brokerCurrentValue", event.target.value)} /></td>
                <td className="px-3 py-2"><input className="w-56 rounded border border-ink/15 px-2 py-1" value={holding.notes ?? ""} onChange={(event) => update(holding.id, "notes", event.target.value)} /></td>
                <td className="px-3 py-2"><button className="text-sm font-semibold text-coral" type="button" onClick={() => onChange(holdings.filter((item) => item.id !== holding.id))}>Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
