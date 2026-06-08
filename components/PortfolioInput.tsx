"use client";

import Papa from "papaparse";
import {
  ChevronDown,
  Download,
  FileUp,
  PencilLine,
  Plus,
  Sparkles,
  Trash2
} from "lucide-react";
import { useState } from "react";
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

function fieldLabel(text: string) {
  return <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink/55">{text}</span>;
}

function inputClassName(extra = "") {
  return `min-h-11 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-base text-ink outline-none transition focus:border-marine/45 focus:ring-2 focus:ring-marine/15 ${extra}`;
}

type MobileHoldingCardProps = {
  holding: HoldingInput;
  onUpdate: (id: string, key: keyof HoldingInput, value: string) => void;
  onDelete: (id: string) => void;
};

function MobileHoldingCard({ holding, onUpdate, onDelete }: MobileHoldingCardProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const label = holding.symbol || "New holding";

  return (
    <article className="overflow-hidden rounded-lg border border-ink/10 bg-paper/50">
      <div className="flex items-start gap-2 p-3">
        <div className="min-w-0 flex-1">
          <label className="block">
            {fieldLabel("Symbol")}
            <input
              aria-label={`Symbol for ${label}`}
              className={`${inputClassName()} font-bold uppercase`}
              value={holding.symbol}
              onChange={(event) => onUpdate(holding.id, "symbol", event.target.value.toUpperCase())}
            />
          </label>
        </div>
        <button
          className="mt-5 inline-flex min-h-10 min-w-10 items-center justify-center rounded-md text-coral hover:bg-coral/10"
          type="button"
          aria-label={`Delete ${label}`}
          onClick={() => onDelete(holding.id)}
        >
          <Trash2 className="h-4 w-4" aria-hidden />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 px-3 pb-3">
        <label>
          {fieldLabel("Shares")}
          <input
            aria-label={`Shares for ${label}`}
            className={inputClassName()}
            type="number"
            inputMode="decimal"
            value={holding.shares || ""}
            onChange={(event) => onUpdate(holding.id, "shares", event.target.value)}
          />
        </label>
        <label>
          {fieldLabel("Avg cost")}
          <input
            aria-label={`Average cost for ${label}`}
            className={inputClassName()}
            type="number"
            inputMode="decimal"
            value={holding.averageCost || ""}
            onChange={(event) => onUpdate(holding.id, "averageCost", event.target.value)}
          />
        </label>
      </div>

      <button
        className="flex w-full items-center justify-between border-t border-ink/10 px-3 py-2.5 text-left text-sm font-semibold text-ink/70"
        type="button"
        aria-expanded={detailsOpen}
        onClick={() => setDetailsOpen((value) => !value)}
      >
        <span>More details</span>
        <ChevronDown className={`h-4 w-4 transition-transform ${detailsOpen ? "rotate-180" : ""}`} aria-hidden />
      </button>

      {detailsOpen ? (
        <div className="space-y-3 border-t border-ink/10 bg-white px-3 py-3">
          <label>
            {fieldLabel("Company / ETF")}
            <input
              aria-label={`Company or ETF name for ${label}`}
              className={inputClassName()}
              value={holding.name}
              onChange={(event) => onUpdate(holding.id, "name", event.target.value)}
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label>
              {fieldLabel("Total cost")}
              <input
                aria-label={`Total cost for ${label}`}
                className={inputClassName()}
                type="number"
                inputMode="decimal"
                value={holding.totalCost || ""}
                onChange={(event) => onUpdate(holding.id, "totalCost", event.target.value)}
              />
            </label>
            <label>
              {fieldLabel("Broker value")}
              <input
                aria-label={`Broker value for ${label}`}
                className={inputClassName()}
                type="number"
                inputMode="decimal"
                value={holding.brokerCurrentValue ?? ""}
                onChange={(event) => onUpdate(holding.id, "brokerCurrentValue", event.target.value)}
              />
            </label>
          </div>
          <label>
            {fieldLabel("Notes")}
            <input
              aria-label={`Notes for ${label}`}
              className={inputClassName()}
              value={holding.notes ?? ""}
              onChange={(event) => onUpdate(holding.id, "notes", event.target.value)}
            />
          </label>
        </div>
      ) : null}
    </article>
  );
}

export function PortfolioInput({ holdings, onChange, onAnalyze, isAnalyzing, isRefreshingMarket }: Props) {
  const [expanded, setExpanded] = useState(false);
  const holdingCount = holdings.filter((holding) => holding.symbol.trim()).length;

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
        setExpanded(true);
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

  const actionToolbar = (
    <div className="flex flex-wrap gap-2">
      <label className="btn-secondary min-h-10 shrink-0 px-3 py-2 text-xs sm:min-h-11 sm:text-sm">
        <FileUp className="h-4 w-4" aria-hidden />
        Import
        <input className="sr-only" type="file" accept=".csv" onChange={(event) => importCsv(event.target.files?.[0])} />
      </label>
      <button className="btn-secondary min-h-10 shrink-0 px-3 py-2 text-xs sm:min-h-11 sm:text-sm" type="button" onClick={exportCsv}>
        <Download className="h-4 w-4" aria-hidden />
        Export
      </button>
      <button
        className="btn-primary min-h-10 shrink-0 px-3 py-2 text-xs sm:min-h-11 sm:text-sm"
        type="button"
        onClick={onAnalyze}
        disabled={isAnalyzing || holdings.every((holding) => !holding.symbol)}
      >
        <Sparkles className="h-4 w-4" aria-hidden />
        {isAnalyzing ? "Analyzing..." : "Analyze"}
      </button>
    </div>
  );

  return (
    <>
      <section className="overflow-hidden rounded-xl border border-ink/10 bg-white shadow-soft md:hidden">
        <button
          className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
        >
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-mint text-marine">
            <PencilLine className="h-5 w-5" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span className="text-sm font-semibold text-ink">Adjust holdings</span>
              {holdingCount ? (
                <span className="rounded-full bg-marine/10 px-2 py-0.5 text-[11px] font-semibold text-marine">
                  {holdingCount}
                </span>
              ) : null}
            </span>
            <span className="mt-0.5 block text-xs text-ink/55">
              Edit shares, import CSV, or run analysis
            </span>
          </span>
          <ChevronDown className={`h-5 w-5 shrink-0 text-ink/45 transition-transform ${expanded ? "rotate-180" : ""}`} aria-hidden />
        </button>

        {expanded ? (
          <div className="border-t border-ink/10 bg-surface-muted/40">
            <div className="border-b border-ink/10 px-3 py-3">
              <p className={`mb-2 text-xs text-ink/55 ${isRefreshingMarket ? "" : "invisible"}`} aria-hidden={!isRefreshingMarket}>
                Refreshing prices...
              </p>
              <div className="-mx-1 overflow-x-auto px-1 pb-1">
                {actionToolbar}
              </div>
            </div>

            <div className="space-y-2 px-3 py-3">
              {holdings.length ? holdings.map((holding) => (
                <MobileHoldingCard
                  holding={holding}
                  key={holding.id}
                  onUpdate={update}
                  onDelete={(id) => onChange(holdings.filter((item) => item.id !== id))}
                />
              )) : (
                <div className="rounded-lg border border-dashed border-ink/15 bg-white px-4 py-6 text-center text-sm text-ink/60">
                  No holdings to edit yet. Add a stock above or import a CSV.
                </div>
              )}

              <button
                className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-dashed border-marine/35 bg-white text-sm font-semibold text-marine"
                type="button"
                onClick={() => onChange([...holdings, emptyHolding()])}
              >
                <Plus className="h-4 w-4" aria-hidden />
                Add holding
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <div className="hidden overflow-hidden rounded-md border border-ink/10 bg-surface-muted md:block">
        <button
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
        >
          <span>
            <span className="block text-sm font-semibold text-ink">Edit all fields</span>
            <span className="mt-0.5 block text-xs text-ink/55">CSV import/export, notes, broker value, and bulk edits</span>
          </span>
          <ChevronDown className={`h-5 w-5 shrink-0 text-ink/55 transition-transform ${expanded ? "rotate-180" : ""}`} aria-hidden />
        </button>
        {expanded ? (
          <div className="border-t border-ink/10 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/8 px-4 py-3">
              <p className={`text-sm text-ink/55 ${isRefreshingMarket ? "" : "invisible"}`} aria-hidden={!isRefreshingMarket}>
                Refreshing prices...
              </p>
              <div className="flex flex-wrap gap-2">
                <button className="btn-secondary px-3 py-2" type="button" onClick={() => onChange([...holdings, emptyHolding()])}>
                  <Plus className="h-4 w-4" aria-hidden /> Add holding
                </button>
                <label className="btn-secondary cursor-pointer px-3 py-2">
                  <FileUp className="h-4 w-4" aria-hidden /> Import CSV
                  <input className="sr-only" type="file" accept=".csv" onChange={(event) => importCsv(event.target.files?.[0])} />
                </label>
                <button className="btn-secondary px-3 py-2" type="button" onClick={exportCsv}>
                  <Download className="h-4 w-4" aria-hidden /> Export CSV
                </button>
                <button className="btn-primary px-4 py-2 disabled:opacity-50" type="button" onClick={onAnalyze} disabled={isAnalyzing || holdings.every((holding) => !holding.symbol)}>
                  <Sparkles className="h-4 w-4" aria-hidden /> {isAnalyzing ? "Analyzing..." : "Run analysis"}
                </button>
              </div>
            </div>
            <div className="table-scroll overflow-x-auto">
              <table className="min-w-[840px] w-full text-left text-xs sm:min-w-[1050px] sm:text-sm">
                <thead className="bg-mint/60 text-xs uppercase text-ink/65">
                  <tr>
                    {["Symbol", "Company/ETF", "Shares", "Avg cost", "Total cost", "Broker value", "Notes", ""].map((head) => <th className="px-2 py-2 sm:px-3" key={head}>{head}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {holdings.map((holding) => (
                    <tr className="border-t border-ink/10 even:bg-paper/60" key={holding.id}>
                      <td className="px-2 py-2 sm:px-3"><input aria-label={`Symbol for ${holding.name || "holding"}`} className="w-20 rounded border border-ink/15 px-2 py-1 font-semibold uppercase sm:w-24" value={holding.symbol} onChange={(event) => update(holding.id, "symbol", event.target.value.toUpperCase())} /></td>
                      <td className="px-2 py-2 sm:px-3"><input aria-label={`Company or ETF name for ${holding.symbol || "holding"}`} className="w-40 rounded border border-ink/15 px-2 py-1 sm:w-52" value={holding.name} onChange={(event) => update(holding.id, "name", event.target.value)} /></td>
                      <td className="px-2 py-2 sm:px-3"><input aria-label={`Shares for ${holding.symbol || "holding"}`} className="w-20 rounded border border-ink/15 px-2 py-1 sm:w-24" type="number" value={holding.shares} onChange={(event) => update(holding.id, "shares", event.target.value)} /></td>
                      <td className="px-2 py-2 sm:px-3"><input aria-label={`Average cost for ${holding.symbol || "holding"}`} className="w-24 rounded border border-ink/15 px-2 py-1 sm:w-28" type="number" value={holding.averageCost} onChange={(event) => update(holding.id, "averageCost", event.target.value)} /></td>
                      <td className="px-2 py-2 sm:px-3"><input aria-label={`Total cost for ${holding.symbol || "holding"}`} className="w-24 rounded border border-ink/15 px-2 py-1 sm:w-28" type="number" value={holding.totalCost} onChange={(event) => update(holding.id, "totalCost", event.target.value)} /></td>
                      <td className="px-2 py-2 sm:px-3"><input aria-label={`Broker value for ${holding.symbol || "holding"}`} className="w-24 rounded border border-ink/15 px-2 py-1 sm:w-28" type="number" value={holding.brokerCurrentValue ?? ""} onChange={(event) => update(holding.id, "brokerCurrentValue", event.target.value)} /></td>
                      <td className="px-2 py-2 sm:px-3"><input aria-label={`Notes for ${holding.symbol || "holding"}`} className="w-44 rounded border border-ink/15 px-2 py-1 sm:w-56" value={holding.notes ?? ""} onChange={(event) => update(holding.id, "notes", event.target.value)} /></td>
                      <td className="px-2 py-2 sm:px-3"><button className="min-h-9 rounded px-2 text-xs font-semibold text-coral sm:text-sm" type="button" onClick={() => onChange(holdings.filter((item) => item.id !== holding.id))}>Delete</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}
