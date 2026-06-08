"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import type { CurrencyCode, EnrichedHolding, FeeSettings } from "@/lib/types";
import { calculateProfitLoss, calculateStopLosses, defaultSellTargets } from "@/lib/calculations";
import { formatMoney } from "@/lib/profileUtils";
import { HoldingDetails } from "./HoldingDetails";

type Props = {
  holdings: EnrichedHolding[];
  settings: FeeSettings;
  currency: CurrencyCode;
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

function metric(label: string, value: string, emphasis?: boolean) {
  return (
    <div className={emphasis ? "rounded-md bg-marine/5 p-3" : "rounded-md bg-paper p-3"}>
      <p className="text-xs font-semibold uppercase text-ink/55">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-ink">{value}</p>
    </div>
  );
}

export function HoldingsTable({ holdings, settings, currency, onChange }: Props) {
  const [open, setOpen] = useState<Record<string, boolean>>({});

  return (
    <section className="mx-auto max-w-7xl px-4 pb-10">
      <div className="grid gap-3 lg:hidden">
        {holdings.map((holding) => {
          const quote = holding.quote;
          const current = quote ? calculateProfitLoss(holding.shares, holding.averageCost, quote.currentPrice, settings) : undefined;
          const stops = quote ? calculateStopLosses(holding, quote) : undefined;
          const stopPrice = stops?.[holding.selectedStopStyle].price;
          const stopPl = quote && stopPrice ? calculateProfitLoss(holding.shares, holding.averageCost, stopPrice, settings) : undefined;
          const targetPrice = quote ? holding.selectedTargetPrice || defaultSellTargets(quote.currentPrice, holding.analysis?.suggestedActionPlan.suggestedTakeProfit)[1].price : undefined;
          const targetPl = quote && targetPrice ? calculateProfitLoss(holding.shares, holding.averageCost, targetPrice, settings) : undefined;
          const isOpen = Boolean(open[holding.id]);

          return (
            <article className="overflow-hidden border border-ink/10 bg-white shadow-soft" key={holding.id}>
              <div className="space-y-4 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="break-words text-xl font-bold">{holding.symbol || "N/A"}</h2>
                    <p className="break-words text-sm text-ink/60">{holding.name || "Unnamed holding"}</p>
                  </div>
                  <div className="shrink-0">{badge(holding.analysis?.riskLevel)}</div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {metric("Shares", String(holding.shares))}
                  {metric("Avg cost", formatMoney(holding.averageCost, currency))}
                  {metric("Current price", quote ? formatMoney(quote.currentPrice, currency) : "Loading", true)}
                  {metric("Current value", current ? formatMoney(current.grossValue, currency) : "N/A", true)}
                </div>

                <div className="grid gap-2 rounded-md border border-ink/10 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold uppercase text-ink/55">Current P/L</span>
                    <strong className={`text-right text-base ${valueClass(current?.profitLoss)}`}>{current ? `${formatMoney(current.profitLoss, currency)} (${current.profitLossPercent}%)` : "N/A"}</strong>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-xs font-semibold uppercase text-ink/55">AI action</p>
                      <div className="mt-1">{badge(holding.analysis?.action)}</div>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase text-ink/55">Confidence</p>
                      <div className="mt-1">{badge(holding.analysis?.confidence)}</div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {metric("Stop-loss", stopPrice ? formatMoney(stopPrice, currency) : "N/A")}
                  {metric("P/L if stop hits", stopPl ? `${formatMoney(stopPl.profitLoss, currency)} (${stopPl.profitLossPercent}%)` : "N/A")}
                  {metric("Target sell price", targetPrice ? formatMoney(targetPrice, currency) : "N/A", true)}
                  {metric("P/L at target", targetPl ? `${formatMoney(targetPl.profitLoss, currency)} (${targetPl.profitLossPercent}%)` : "N/A", true)}
                </div>

                <button
                  aria-expanded={isOpen}
                  className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-marine px-4 py-2 text-sm font-semibold text-marine"
                  type="button"
                  onClick={() => setOpen({ ...open, [holding.id]: !isOpen })}
                >
                  {isOpen ? <ChevronDown className="h-4 w-4" aria-hidden /> : <ChevronRight className="h-4 w-4" aria-hidden />}
                  {isOpen ? "Hide details" : "Show details"}
                </button>
              </div>
              {isOpen ? <HoldingDetails holding={holding} settings={settings} currency={currency} onChange={onChange} /> : null}
            </article>
          );
        })}
      </div>
      <div className="table-scroll hidden overflow-x-auto border-y border-ink/10 bg-white shadow-soft lg:block">
        <table className="min-w-[1320px] w-full border-collapse text-left text-sm">
          <thead className="bg-ink text-xs uppercase text-white">
            <tr className="border-b border-white/15">
              <th className="px-3 py-2 text-center" colSpan={4}>Position</th>
              <th className="border-l-2 border-white/30 px-3 py-2 text-center" colSpan={3}>Market</th>
              <th className="border-l-2 border-white/30 px-3 py-2 text-center" colSpan={2}>Analysis</th>
              <th className="border-l-2 border-white/30 px-3 py-2 text-center" colSpan={2}>Stop</th>
              <th className="border-l-2 border-white/30 px-3 py-2 text-center" colSpan={2}>Target</th>
              <th className="border-l-2 border-white/30 px-3 py-2 text-center">Risk</th>
            </tr>
            <tr className="bg-ink/95">
              <th className="px-3 py-3" aria-label="Expand row" />
              <th className="px-3 py-3">Symbol</th>
              <th className="px-3 py-3">Shares</th>
              <th className="px-3 py-3">Avg cost</th>
              <th className="border-l-2 border-white/30 px-3 py-3">Current price</th>
              <th className="px-3 py-3">Current value</th>
              <th className="px-3 py-3">Current P/L</th>
              <th className="border-l-2 border-white/30 px-3 py-3">AI action</th>
              <th className="px-3 py-3">Confidence</th>
              <th className="border-l-2 border-white/30 px-3 py-3">Suggested stop-loss</th>
              <th className="px-3 py-3">P/L if stop hits</th>
              <th className="border-l-2 border-white/30 px-3 py-3">Target sell price</th>
              <th className="px-3 py-3">P/L at target</th>
              <th className="border-l-2 border-white/30 px-3 py-3">Risk</th>
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
                    <td className="px-3 py-3">{formatMoney(holding.averageCost, currency)}</td>
                    <td className="border-l-2 border-ink/15 bg-marine/5 px-3 py-3 font-semibold text-marine">{quote ? formatMoney(quote.currentPrice, currency) : "Loading"}</td>
                    <td className="px-3 py-3">{current ? formatMoney(current.grossValue, currency) : "N/A"}</td>
                    <td className={`bg-marine/5 px-3 py-3 font-semibold ${valueClass(current?.profitLoss)}`}>{current ? `${formatMoney(current.profitLoss, currency)} (${current.profitLossPercent}%)` : "N/A"}</td>
                    <td className="border-l-2 border-ink/15 px-3 py-3">{badge(holding.analysis?.action)}</td>
                    <td className="px-3 py-3">{badge(holding.analysis?.confidence)}</td>
                    <td className="border-l-2 border-ink/15 bg-amber/10 px-3 py-3 font-semibold">{stopPrice ? formatMoney(stopPrice, currency) : "N/A"}</td>
                    <td className="px-3 py-3">{stopPl ? `${formatMoney(stopPl.profitLoss, currency)} (${stopPl.profitLossPercent}%)` : "N/A"}</td>
                    <td className="border-l-2 border-ink/15 bg-mint/70 px-3 py-3 font-bold text-marine">{targetPrice ? formatMoney(targetPrice, currency) : "N/A"}</td>
                    <td className={`bg-mint/70 px-3 py-3 font-bold ${valueClass(targetPl?.profitLoss)}`}>{targetPl ? `${formatMoney(targetPl.profitLoss, currency)} (${targetPl.profitLossPercent}%)` : "N/A"}</td>
                    <td className="border-l-2 border-ink/15 px-3 py-3">{badge(holding.analysis?.riskLevel)}</td>
                  </tr>,
                  open[holding.id] ? (
                    <tr className="border-t border-ink/10" key={`${holding.id}-details`}>
                      <td colSpan={14} className="p-0"><HoldingDetails holding={holding} settings={settings} currency={currency} onChange={onChange} /></td>
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
