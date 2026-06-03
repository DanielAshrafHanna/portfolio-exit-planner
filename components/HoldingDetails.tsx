"use client";

import { ExternalLink } from "lucide-react";
import type { EnrichedHolding, FeeSettings } from "@/lib/types";
import { calculatePartialSale, calculateProfitLoss, calculateStopLosses, defaultSellTargets, roundMoney } from "@/lib/calculations";
import { ProfitLossChart } from "./ProfitLossChart";
import { StopLossSelector } from "./StopLossSelector";

type Props = {
  holding: EnrichedHolding;
  settings: FeeSettings;
  onChange: (holding: EnrichedHolding) => void;
};

export function HoldingDetails({ holding, settings, onChange }: Props) {
  if (!holding.quote) return <div className="p-4 text-sm text-ink/65">Run analysis to load quote, news, and decision data.</div>;
  const stops = calculateStopLosses(holding, holding.quote);
  const targetPrice = holding.selectedTargetPrice || defaultSellTargets(holding.quote.currentPrice, holding.analysis?.suggestedActionPlan.suggestedTakeProfit)[1].price;
  const targetPl = calculateProfitLoss(holding.shares, holding.averageCost, targetPrice, settings);
  const partial = calculatePartialSale(holding, targetPrice, holding.sellPercent, settings);
  const minPrice = Math.max(0.01, holding.quote.currentPrice * 0.5);
  const maxPrice = holding.quote.currentPrice * 1.75;

  return (
    <div className="grid gap-5 bg-paper p-4 lg:grid-cols-[1fr_420px]">
      <div className="space-y-5">
        <StopLossSelector stops={stops} selected={holding.selectedStopStyle} onChange={(style) => onChange({ ...holding, selectedStopStyle: style })} />
        <div className="grid gap-4 md:grid-cols-2">
          <section className="bg-white p-4">
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
          <section className="bg-white p-4">
            <h3 className="mb-2 font-semibold">Technical indicators</h3>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <dt className="text-ink/55">20-day MA</dt><dd>${holding.quote.ma20 ?? "N/A"}</dd>
              <dt className="text-ink/55">50-day MA</dt><dd>${holding.quote.ma50 ?? "N/A"}</dd>
              <dt className="text-ink/55">200-day MA</dt><dd>${holding.quote.ma200 ?? "N/A"}</dd>
              <dt className="text-ink/55">RSI</dt><dd>{holding.quote.rsi ?? "N/A"}</dd>
              <dt className="text-ink/55">ATR</dt><dd>${holding.quote.atr ?? "N/A"}</dd>
              <dt className="text-ink/55">52W high/low</dt><dd>${holding.quote.week52High ?? "N/A"} / ${holding.quote.week52Low ?? "N/A"}</dd>
              <dt className="text-ink/55">Volume</dt><dd>{holding.quote.volume?.toLocaleString() ?? "N/A"}</dd>
              <dt className="text-ink/55">Provider</dt><dd>{holding.quote.provider}</dd>
            </dl>
          </section>
        </div>
        <section className="bg-white p-4">
          <h3 className="mb-3 font-semibold">Recent news</h3>
          {holding.news.length ? (
            <div className="grid gap-3">
              {holding.news.map((item) => (
                <a className="block border-l-4 border-mint pl-3 text-sm hover:text-marine" href={item.url} target="_blank" rel="noreferrer" key={`${item.headline}-${item.date}`}>
                  <span className="font-semibold">{item.headline}</span>
                  <span className="ml-2 inline-flex items-center gap-1 text-xs text-ink/55">{item.source} <ExternalLink className="h-3 w-3" aria-hidden /></span>
                  <span className="block text-xs text-ink/50">{item.date}</span>
                  <span className="block text-ink/70">{item.summary}</span>
                </a>
              ))}
            </div>
          ) : <p className="text-sm text-ink/60">No recent news found.</p>}
        </section>
      </div>
      <aside className="space-y-4 bg-white p-4">
        <div>
          <label className="text-sm font-semibold">Manual target sell price: ${roundMoney(targetPrice).toLocaleString()}</label>
          <input className="mt-2 w-full accent-marine" type="range" min={minPrice} max={maxPrice} step="0.01" value={targetPrice} onChange={(event) => onChange({ ...holding, selectedTargetPrice: Number(event.target.value), targetPriceEdited: true })} />
          <input className="mt-2 w-full rounded-md border border-ink/15 px-3 py-2" type="number" value={roundMoney(targetPrice)} onChange={(event) => onChange({ ...holding, selectedTargetPrice: Number(event.target.value) || targetPrice, targetPriceEdited: true })} />
        </div>
        <div>
          <label className="text-sm font-semibold">Partial sell: {holding.sellPercent}%</label>
          <input className="mt-2 w-full accent-coral" type="range" min="0" max="100" step="1" value={holding.sellPercent} onChange={(event) => onChange({ ...holding, sellPercent: Number(event.target.value) })} />
          <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
            <span className="text-ink/55">Realized P/L</span><strong>${partial.realizedProfitLoss.toLocaleString()}</strong>
            <span className="text-ink/55">Sold shares</span><strong>{partial.soldShares}</strong>
            <span className="text-ink/55">Remaining value</span><strong>${partial.remainingValue.toLocaleString()}</strong>
            <span className="text-ink/55">Target P/L</span><strong>${targetPl.profitLoss.toLocaleString()} ({targetPl.profitLossPercent}%)</strong>
          </div>
        </div>
        <ProfitLossChart holding={holding} targetPrice={targetPrice} settings={settings} />
      </aside>
    </div>
  );
}
