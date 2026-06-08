"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import type { CurrencyCode, EnrichedHolding, FeeSettings } from "@/lib/types";
import { computeHoldingRowMetrics, profitLossTone, badgeTone } from "@/lib/holdingDisplay";
import { formatMoney } from "@/lib/profileUtils";
import { HoldingDetails } from "./HoldingDetails";

type Props = {
  holdings: EnrichedHolding[];
  settings: FeeSettings;
  currency: CurrencyCode;
  onChange?: (holding: EnrichedHolding) => void;
  readOnly?: boolean;
};

function badge(value?: string) {
  const tone = badgeTone(value);
  const color = tone === "danger" ? "bg-coral/15 text-coral" : tone === "warning" ? "bg-amber/20 text-ink" : "bg-mint text-marine";
  return <span className={`rounded px-2 py-1 text-xs font-semibold ${color}`}>{value || "N/A"}</span>;
}

function valueClass(value?: number) {
  const tone = profitLossTone(value);
  return tone === "loss" ? "text-coral" : tone === "gain" ? "text-marine" : "";
}

export function HoldingsTable({ holdings, settings, currency, onChange, readOnly = false }: Props) {
  const [open, setOpen] = useState<Record<string, boolean>>({});

  return (
    <div className="table-scroll -mx-4 hidden overflow-x-auto border-y border-ink/10 bg-white sm:-mx-5 md:block">
      <table className="min-w-[1120px] w-full border-collapse text-left text-xs sm:min-w-[1320px] sm:text-sm">
        <thead className="bg-marine text-xs uppercase text-white">
          <tr className="hidden border-b border-white/15 sm:table-row">
            <th className="px-3 py-2 text-center" colSpan={4}>Position</th>
            <th className="border-l-2 border-white/30 px-3 py-2 text-center" colSpan={3}>Market</th>
            <th className="border-l-2 border-white/30 px-3 py-2 text-center" colSpan={2}>Analysis</th>
            <th className="border-l-2 border-white/30 px-3 py-2 text-center" colSpan={2}>Stop</th>
            <th className="border-l-2 border-white/30 px-3 py-2 text-center" colSpan={2}>Target</th>
            <th className="border-l-2 border-white/30 px-3 py-2 text-center">Risk</th>
          </tr>
          <tr className="bg-marine/95">
            <th className="sticky left-0 z-20 bg-marine/95 px-2 py-2 sm:px-3 sm:py-3" aria-label="Expand row" />
            <th className="sticky left-10 z-20 bg-marine/95 px-2 py-2 sm:left-12 sm:px-3 sm:py-3">Symbol</th>
            <th className="px-2 py-2 sm:px-3 sm:py-3">Shares</th>
            <th className="px-2 py-2 sm:px-3 sm:py-3">Avg cost</th>
            <th className="border-l-2 border-white/30 px-2 py-2 sm:px-3 sm:py-3">Current price</th>
            <th className="px-2 py-2 sm:px-3 sm:py-3">Current value</th>
            <th className="px-2 py-2 sm:px-3 sm:py-3">Current P/L</th>
            <th className="border-l-2 border-white/30 px-2 py-2 sm:px-3 sm:py-3">AI action</th>
            <th className="px-2 py-2 sm:px-3 sm:py-3">Confidence</th>
            <th className="border-l-2 border-white/30 px-2 py-2 sm:px-3 sm:py-3">Suggested stop-loss</th>
            <th className="px-2 py-2 sm:px-3 sm:py-3">P/L if stop hits</th>
            <th className="border-l-2 border-white/30 px-2 py-2 sm:px-3 sm:py-3">Target sell price</th>
            <th className="px-2 py-2 sm:px-3 sm:py-3">P/L at target</th>
            <th className="border-l-2 border-white/30 px-2 py-2 sm:px-3 sm:py-3">Risk</th>
          </tr>
        </thead>
        <tbody>
          {holdings.map((holding) => {
            const quote = holding.quote;
            const metrics = computeHoldingRowMetrics(holding, settings);
            const canExpand = !readOnly && Boolean(onChange);
            return [
              <tr className="border-t border-ink/10 even:bg-paper/50 hover:bg-mint/20" key={`${holding.id}-summary`}>
                <td className="sticky left-0 z-10 bg-inherit px-2 py-2 sm:px-3 sm:py-3">
                  {canExpand ? (
                    <button className="min-h-8 rounded p-1 hover:bg-mint" type="button" onClick={() => setOpen({ ...open, [holding.id]: !open[holding.id] })} aria-label={`Expand ${holding.symbol}`} aria-expanded={Boolean(open[holding.id])}>
                      {open[holding.id] ? <ChevronDown className="h-4 w-4" aria-hidden /> : <ChevronRight className="h-4 w-4" aria-hidden />}
                    </button>
                  ) : null}
                </td>
                <td className="sticky left-10 z-10 bg-inherit px-2 py-2 font-bold sm:left-12 sm:px-3 sm:py-3">{holding.symbol}<span className="block max-w-32 truncate text-[11px] font-normal text-ink/55 sm:max-w-44 sm:text-xs">{holding.name}</span></td>
                <td className="px-2 py-2 sm:px-3 sm:py-3">{holding.shares}</td>
                <td className="px-2 py-2 sm:px-3 sm:py-3">{formatMoney(holding.averageCost, currency)}</td>
                <td className="border-l-2 border-ink/15 bg-marine/5 px-2 py-2 font-semibold text-marine sm:px-3 sm:py-3">{quote ? formatMoney(quote.currentPrice, currency) : "Loading"}</td>
                <td className="px-2 py-2 sm:px-3 sm:py-3">{metrics.current ? formatMoney(metrics.current.grossValue, currency) : "N/A"}</td>
                <td className={`bg-marine/5 px-2 py-2 font-semibold sm:px-3 sm:py-3 ${valueClass(metrics.current?.profitLoss)}`}>{metrics.current ? `${formatMoney(metrics.current.profitLoss, currency)} (${metrics.current.profitLossPercent}%)` : "N/A"}</td>
                <td className="border-l-2 border-ink/15 px-2 py-2 sm:px-3 sm:py-3">{badge(holding.analysis?.action)}</td>
                <td className="px-2 py-2 sm:px-3 sm:py-3">{badge(holding.analysis?.confidence)}</td>
                <td className="border-l-2 border-ink/15 bg-amber/10 px-2 py-2 font-semibold sm:px-3 sm:py-3">{metrics.stopPrice ? formatMoney(metrics.stopPrice, currency) : "N/A"}</td>
                <td className="px-2 py-2 sm:px-3 sm:py-3">{metrics.stopPl ? `${formatMoney(metrics.stopPl.profitLoss, currency)} (${metrics.stopPl.profitLossPercent}%)` : "N/A"}</td>
                <td className="border-l-2 border-ink/15 bg-mint/70 px-2 py-2 font-bold text-marine sm:px-3 sm:py-3">{metrics.targetPrice ? formatMoney(metrics.targetPrice, currency) : "N/A"}</td>
                <td className={`bg-mint/70 px-2 py-2 font-bold sm:px-3 sm:py-3 ${valueClass(metrics.targetPl?.profitLoss)}`}>{metrics.targetPl ? `${formatMoney(metrics.targetPl.profitLoss, currency)} (${metrics.targetPl.profitLossPercent}%)` : "N/A"}</td>
                <td className="border-l-2 border-ink/15 px-2 py-2 sm:px-3 sm:py-3">{badge(holding.analysis?.riskLevel)}</td>
              </tr>,
              canExpand && onChange && open[holding.id] ? (
                <tr className="border-t border-ink/10" key={`${holding.id}-details`}>
                  <td colSpan={14} className="p-0"><HoldingDetails holding={holding} settings={settings} currency={currency} onChange={onChange} /></td>
                </tr>
              ) : null
            ];
          })}
        </tbody>
      </table>
    </div>
  );
}
