"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import type { EnrichedHolding, FeeSettings } from "@/lib/types";
import { calculateProfitLoss, calculateStopLosses, defaultSellTargets } from "@/lib/calculations";
import { HoldingDetails } from "./HoldingDetails";

type Props = {
  holdings: EnrichedHolding[];
  settings: FeeSettings;
  onChange: (holding: EnrichedHolding) => void;
};

function badge(value?: string) {
  const color = value === "Sell" || value === "Very High" ? "bg-coral/15 text-coral" : value === "Trim" || value === "High" ? "bg-amber/20 text-ink" : "bg-mint text-marine";
  return <span className={`rounded px-2 py-1 text-xs font-semibold ${color}`}>{value || "N/A"}</span>;
}

function valueClass(value?: number) {
  if (value === undefined) return "";
  return value < 0 ? "text-coral" : "text-marine";
}

export function HoldingsTable({ holdings, settings, onChange }: Props) {
  const [open, setOpen] = useState<Record<string, boolean>>({});

  return (
    <section className="mx-auto max-w-7xl px-4 pb-10">
      <div className="table-scroll overflow-x-auto border-y border-ink/10 bg-white shadow-soft">
        <table className="min-w-[1250px] w-full text-left text-sm">
          <thead className="bg-ink text-xs uppercase text-white">
            <tr>
              {["", "Symbol", "Shares", "Avg cost", "Current price", "Current value", "Current P/L", "AI action", "Confidence", "Suggested stop-loss", "P/L if stop hits", "Target sell price", "P/L at target", "Risk"].map((head) => <th className="px-3 py-3" key={head}>{head}</th>)}
            </tr>
          </thead>
          <tbody>
            {holdings.map((holding) => {
              const quote = holding.quote;
              const current = quote ? calculateProfitLoss(holding.shares, holding.averageCost, quote.currentPrice, settings) : undefined;
              const stops = quote ? calculateStopLosses(holding, quote) : undefined;
              const stopPrice = stops?.[holding.selectedStopStyle].price;
              const stopPl = quote && stopPrice ? calculateProfitLoss(holding.shares, holding.averageCost, stopPrice, settings) : undefined;
              const targetPrice = quote ? holding.selectedTargetPrice || defaultSellTargets(quote.currentPrice, holding.analysis?.suggestedActionPlan.suggestedTakeProfit)[1].price : undefined;
              const targetPl = quote && targetPrice ? calculateProfitLoss(holding.shares, holding.averageCost, targetPrice, settings) : undefined;
              return [
                  <tr className="border-t border-ink/10" key={`${holding.id}-summary`}>
                    <td className="px-3 py-3">
                      <button className="rounded p-1 hover:bg-mint" type="button" onClick={() => setOpen({ ...open, [holding.id]: !open[holding.id] })} aria-label={`Expand ${holding.symbol}`}>
                        {open[holding.id] ? <ChevronDown className="h-4 w-4" aria-hidden /> : <ChevronRight className="h-4 w-4" aria-hidden />}
                      </button>
                    </td>
                    <td className="px-3 py-3 font-bold">{holding.symbol}<span className="block text-xs font-normal text-ink/55">{holding.name}</span></td>
                    <td className="px-3 py-3">{holding.shares}</td>
                    <td className="px-3 py-3">${holding.averageCost.toLocaleString()}</td>
                    <td className="bg-marine/5 px-3 py-3 font-semibold text-marine">{quote ? `$${quote.currentPrice.toLocaleString()}` : "Loading"}</td>
                    <td className="px-3 py-3">{current ? `$${current.grossValue.toLocaleString()}` : "N/A"}</td>
                    <td className={`bg-marine/5 px-3 py-3 font-semibold ${valueClass(current?.profitLoss)}`}>{current ? `$${current.profitLoss.toLocaleString()} (${current.profitLossPercent}%)` : "N/A"}</td>
                    <td className="px-3 py-3">{badge(holding.analysis?.action)}</td>
                    <td className="px-3 py-3">{badge(holding.analysis?.confidence)}</td>
                    <td className="bg-amber/10 px-3 py-3 font-semibold">{stopPrice ? `$${stopPrice.toLocaleString()}` : "N/A"}</td>
                    <td className="px-3 py-3">{stopPl ? `$${stopPl.profitLoss.toLocaleString()} (${stopPl.profitLossPercent}%)` : "N/A"}</td>
                    <td className="bg-mint/70 px-3 py-3 font-bold text-marine">{targetPrice ? `$${targetPrice.toLocaleString()}` : "N/A"}</td>
                    <td className={`bg-mint/70 px-3 py-3 font-bold ${valueClass(targetPl?.profitLoss)}`}>{targetPl ? `$${targetPl.profitLoss.toLocaleString()} (${targetPl.profitLossPercent}%)` : "N/A"}</td>
                    <td className="px-3 py-3">{badge(holding.analysis?.riskLevel)}</td>
                  </tr>,
                  open[holding.id] ? (
                    <tr className="border-t border-ink/10" key={`${holding.id}-details`}>
                      <td colSpan={14} className="p-0"><HoldingDetails holding={holding} settings={settings} onChange={onChange} /></td>
                    </tr>
                  ) : null
              ];
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
