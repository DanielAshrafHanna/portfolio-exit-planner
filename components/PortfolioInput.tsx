"use client";

import Papa from "papaparse";
import { Download, FileUp, Plus, Sparkles } from "lucide-react";
import type { HoldingInput } from "@/lib/types";
import { totalCostFor } from "@/lib/calculations";

type Props = {
  holdings: HoldingInput[];
  onChange: (holdings: HoldingInput[]) => void;
  onAnalyze: () => void;
  isAnalyzing: boolean;
  isRefreshingMarket: boolean;
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

type FieldProps = {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  type?: "text" | "number";
  inputMode?: "decimal" | "text";
  className?: string;
};

function MobileField({ label, value, onChange, type = "text", inputMode, className = "" }: FieldProps) {
  return (
    <label className={`block text-xs font-semibold text-ink/65 ${className}`}>
      {label}
      <input
        className="mt-1 min-h-11 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-base text-ink outline-none focus:border-marine focus:ring-2 focus:ring-marine/20"
        inputMode={inputMode}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

export function PortfolioInput({ holdings, onChange, onAnalyze, isAnalyzing, isRefreshingMarket }: Props) {
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
      <div className="mb-4 grid gap-3 md:flex md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Portfolio input</h2>
          {isRefreshingMarket ? <p className="text-sm text-ink/55">Refreshing prices...</p> : null}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-marine px-3 py-2 text-sm font-semibold text-white" type="button" onClick={() => onChange([...holdings, emptyHolding()])}>
            <Plus className="h-4 w-4" aria-hidden /> Add row
          </button>
          <label className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-md border border-ink/15 bg-white px-3 py-2 text-sm font-semibold">
            <FileUp className="h-4 w-4" aria-hidden /> Import CSV
            <input className="sr-only" type="file" accept=".csv" onChange={(event) => importCsv(event.target.files?.[0])} />
          </label>
          <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-ink/15 bg-white px-3 py-2 text-sm font-semibold" type="button" onClick={exportCsv}>
            <Download className="h-4 w-4" aria-hidden /> Export CSV
          </button>
          <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-coral px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" type="button" onClick={onAnalyze} disabled={isAnalyzing || holdings.every((h) => !h.symbol)}>
            <Sparkles className="h-4 w-4" aria-hidden /> {isAnalyzing ? "Analyzing..." : "Run analysis"}
          </button>
        </div>
      </div>
      <div className="grid gap-3 md:hidden">
        {holdings.map((holding, index) => (
          <article className="border border-ink/10 bg-white p-4 shadow-soft" key={holding.id}>
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase text-marine">Holding {index + 1}</p>
                <h3 className="truncate text-lg font-bold">{holding.symbol || "New holding"}</h3>
                {holding.name ? <p className="break-words text-sm text-ink/60">{holding.name}</p> : null}
              </div>
              <button className="min-h-11 shrink-0 rounded-md border border-coral px-3 py-2 text-sm font-semibold text-coral" type="button" onClick={() => onChange(holdings.filter((item) => item.id !== holding.id))}>
                Delete
              </button>
            </div>
            <div className="grid gap-3">
              <MobileField label="Symbol" value={holding.symbol} onChange={(value) => update(holding.id, "symbol", value.toUpperCase())} />
              <MobileField label="Company/ETF name" value={holding.name} onChange={(value) => update(holding.id, "name", value)} />
              <div className="grid grid-cols-2 gap-3">
                <MobileField label="Shares" type="number" inputMode="decimal" value={holding.shares} onChange={(value) => update(holding.id, "shares", value)} />
                <MobileField label="Avg cost" type="number" inputMode="decimal" value={holding.averageCost} onChange={(value) => update(holding.id, "averageCost", value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <MobileField label="Total cost" type="number" inputMode="decimal" value={holding.totalCost} onChange={(value) => update(holding.id, "totalCost", value)} />
                <MobileField label="Broker value" type="number" inputMode="decimal" value={holding.brokerCurrentValue ?? ""} onChange={(value) => update(holding.id, "brokerCurrentValue", value)} />
              </div>
              <MobileField label="Notes" value={holding.notes ?? ""} onChange={(value) => update(holding.id, "notes", value)} />
            </div>
          </article>
        ))}
      </div>
      <div className="table-scroll hidden overflow-x-auto border-y border-ink/10 bg-white md:block">
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
