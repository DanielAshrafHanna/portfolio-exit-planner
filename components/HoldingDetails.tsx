"use client";

import { useEffect, useState } from "react";
import type { CurrencyCode, EnrichedHolding, FeeSettings } from "@/lib/types";
import { calculatePartialSale, calculateProfitLoss, calculateStopLosses, defaultSellTargets, roundMoney } from "@/lib/calculations";
import { formatMoney } from "@/lib/profileUtils";
import type { ApplySaleResult } from "@/lib/positionMath";
import { ProfitLossChart } from "./ProfitLossChart";
import { StopLossSelector } from "./StopLossSelector";

type Props = {
  holding: EnrichedHolding;
  settings: FeeSettings;
  currency: CurrencyCode;
  onChange: (holding: EnrichedHolding) => void;
  onApplySale?: (holding: EnrichedHolding) => ApplySaleResult | null;
};

export function HoldingDetails({ holding, settings, currency, onChange, onApplySale }: Props) {
  const [saleNotice, setSaleNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!saleNotice) return;
    const timer = window.setTimeout(() => setSaleNotice(null), 6000);
    return () => window.clearTimeout(timer);
  }, [saleNotice]);

  if (!holding.quote) return <div className="p-4 text-sm text-ink/65">Run analysis to load quote and decision data.</div>;
  const stops = calculateStopLosses(holding, holding.quote);
  const targetPrice = holding.selectedTargetPrice || defaultSellTargets(holding.quote.currentPrice, holding.analysis?.suggestedActionPlan.suggestedTakeProfit)[1].price;
  const targetPl = calculateProfitLoss(holding.shares, holding.averageCost, targetPrice, settings);
  const partial = calculatePartialSale(holding, targetPrice, holding.sellPercent, settings);
  const minPrice = Math.max(0.01, holding.quote.currentPrice * 0.5);
  const maxPrice = holding.quote.currentPrice * 1.75;
  const canApplySale = Boolean(onApplySale) && holding.sellPercent > 0 && partial.soldShares > 0;

  const handleApplySale = () => {
    if (!onApplySale || !canApplySale) return;
    const result = onApplySale(holding);
    if (!result) return;
    const action = result.closed ? "closed" : "updated";
    setSaleNotice(
      `Applied sale for ${holding.symbol}: ${formatMoney(result.realizedProfitLoss, currency)} realized P/L (${result.soldShares} shares sold). Position ${action}.`
    );
  };

  return (
    <div className="grid min-w-0 gap-4 bg-paper p-3 sm:p-4 lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-5">
      <div className="min-w-0 space-y-4 lg:space-y-5">
        <div className="bg-white p-3 text-sm text-ink/70">
          Use the target planner above to set a desired profit/loss, then fine-tune with the manual slider below. Choose how much downside you can tolerate with stop-loss styles. Nothing is traded automatically.
        </div>
        <StopLossSelector stops={stops} selected={holding.selectedStopStyle} currency={currency} onChange={(style) => onChange({ ...holding, selectedStopStyle: style })} />
        <div className="grid gap-4 md:grid-cols-2">
          <section className="min-w-0 bg-white p-4">
            <h3 className="mb-2 font-semibold">AI decision engine</h3>
            {holding.analysis ? (
              <div className="space-y-3 text-sm">
                <p>{holding.analysis.summary}</p>
                <div>
                  <p className="font-semibold text-marine">Bull case</p>
                  <ul className="list-disc pl-5 text-ink/75">{holding.analysis.reasonsToHold.map((item) => <li key={item}>{item}</li>)}</ul>
                </div>
                <div>
                  <p className="font-semibold text-coral">Bear case</p>
                  <ul className="list-disc pl-5 text-ink/75">{holding.analysis.reasonsToSell.map((item) => <li key={item}>{item}</li>)}</ul>
                </div>
                <div>
                  <p className="font-semibold">Catalysts</p>
                  {holding.analysis.upcomingCatalysts.length ? holding.analysis.upcomingCatalysts.map((catalyst) => (
                    <p className="text-ink/75" key={`${catalyst.name}-${catalyst.date}`}>{catalyst.name} {catalyst.date ? `on ${catalyst.date}` : ""} ({catalyst.importance})</p>
                  )) : <p className="text-ink/60">No verified upcoming catalyst found.</p>}
                </div>
              </div>
            ) : <p className="text-sm text-ink/60">AI analysis unavailable.</p>}
          </section>
          <section className="min-w-0 bg-white p-4">
            <h3 className="mb-2 font-semibold">Technical indicators</h3>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <dt className="text-ink/55">20-day MA</dt><dd className="min-w-0 break-words">{holding.quote.ma20 ? formatMoney(holding.quote.ma20, currency) : "N/A"}</dd>
              <dt className="text-ink/55">50-day MA</dt><dd className="min-w-0 break-words">{holding.quote.ma50 ? formatMoney(holding.quote.ma50, currency) : "N/A"}</dd>
              <dt className="text-ink/55">200-day MA</dt><dd className="min-w-0 break-words">{holding.quote.ma200 ? formatMoney(holding.quote.ma200, currency) : "N/A"}</dd>
              <dt className="text-ink/55">RSI</dt><dd className="min-w-0 break-words">{holding.quote.rsi ?? "N/A"}</dd>
              <dt className="text-ink/55">ATR</dt><dd className="min-w-0 break-words">{holding.quote.atr ? formatMoney(holding.quote.atr, currency) : "N/A"}</dd>
              <dt className="text-ink/55">52W high/low</dt><dd className="min-w-0 break-words">{holding.quote.week52High ? formatMoney(holding.quote.week52High, currency) : "N/A"} / {holding.quote.week52Low ? formatMoney(holding.quote.week52Low, currency) : "N/A"}</dd>
              <dt className="text-ink/55">Volume</dt><dd className="min-w-0 break-words">{holding.quote.volume?.toLocaleString() ?? "N/A"}</dd>
              <dt className="text-ink/55">Provider</dt><dd className="min-w-0 break-words">{holding.quote.provider}</dd>
            </dl>
          </section>
        </div>
      </div>
      <aside className="min-w-0 space-y-4 bg-white p-4">
        <div>
          <label className="text-sm font-semibold">Manual target sell price: {formatMoney(roundMoney(targetPrice), currency)}</label>
          <input className="mt-2 w-full accent-marine" type="range" min={minPrice} max={maxPrice} step="0.01" value={targetPrice} onChange={(event) => onChange({ ...holding, selectedTargetPrice: Number(event.target.value), targetPriceEdited: true })} />
          <input className="mt-2 min-h-11 w-full rounded-md border border-ink/15 px-3 py-2 text-base" type="number" value={roundMoney(targetPrice)} onChange={(event) => onChange({ ...holding, selectedTargetPrice: Number(event.target.value) || targetPrice, targetPriceEdited: true })} />
        </div>
        <div>
          <label className="text-sm font-semibold">Partial sell: {holding.sellPercent}%</label>
          <input className="mt-2 w-full accent-coral" type="range" min="0" max="100" step="1" value={holding.sellPercent} onChange={(event) => onChange({ ...holding, sellPercent: Number(event.target.value) })} />
          <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
            <span className="text-ink/55">Realized P/L</span><strong>{formatMoney(partial.realizedProfitLoss, currency)}</strong>
            <span className="text-ink/55">Sold shares</span><strong>{partial.soldShares}</strong>
            <span className="text-ink/55">Remaining value</span><strong>{formatMoney(partial.remainingValue, currency)}</strong>
            <span className="text-ink/55">Target P/L</span><strong>{formatMoney(targetPl.profitLoss, currency)} ({targetPl.profitLossPercent}%)</strong>
          </div>
          {onApplySale ? (
            <button
              className="btn-secondary mt-3 w-full min-h-10 disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
              disabled={!canApplySale}
              onClick={handleApplySale}
            >
              Apply sale to portfolio
            </button>
          ) : null}
          {saleNotice ? (
            <p className="mt-2 rounded-md border border-mint bg-mint/20 px-3 py-2 text-xs text-marine" role="status">
              {saleNotice}
            </p>
          ) : null}
        </div>
        <ProfitLossChart holding={holding} targetPrice={targetPrice} settings={settings} currency={currency} />
      </aside>
    </div>
  );
}
