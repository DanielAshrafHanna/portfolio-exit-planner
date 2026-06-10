"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import type { CurrencyCode, EnrichedHolding, FeeSettings } from "@/lib/types";
import { computeHoldingRowMetrics, profitLossTone, badgeTone } from "@/lib/holdingDisplay";
import { nextSortState, sortHoldings, type HoldingSortKey, type SortDirection } from "@/lib/holdingSort";
import { formatMoney } from "@/lib/profileUtils";
import { HoldingsSortControl, HoldingsSortHeader } from "./HoldingsSortControl";
import { HoldingDetails } from "./HoldingDetails";

type Props = {
  holdings: EnrichedHolding[];
  settings: FeeSettings;
  currency: CurrencyCode;
  onChange?: (holding: EnrichedHolding) => void;
  readOnly?: boolean;
};

function badge(value?: string, compact = false) {
  const tone = badgeTone(value);
  const color = tone === "danger" ? "bg-coral/15 text-coral" : tone === "warning" ? "bg-amber/20 text-ink" : "bg-mint text-marine";
  const label = compact && value && value.length > 4 ? value.slice(0, 4) : (value || "N/A");
  return <span className={`whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-semibold sm:px-2 sm:py-1 sm:text-xs ${color}`}>{label}</span>;
}

function valueClass(value?: number) {
  const tone = profitLossTone(value);
  return tone === "loss" ? "text-coral" : tone === "gain" ? "text-marine" : "";
}

function shortMoney(value: number, currency: CurrencyCode) {
  const formatted = formatMoney(value, currency);
  if (formatted.length <= 10) return formatted;
  if (Math.abs(value) >= 1000) {
    return `${currency === "EGP" ? "E£" : "$"}${(value / 1000).toFixed(1)}k`;
  }
  return formatted;
}

export function HoldingsTable({ holdings, settings, currency, onChange, readOnly = false }: Props) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [sortKey, setSortKey] = useState<HoldingSortKey>("symbol");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const sortedHoldings = useMemo(
    () => sortHoldings(holdings, settings, sortKey, sortDirection),
    [holdings, settings, sortKey, sortDirection]
  );

  const handleSort = (key: HoldingSortKey) => {
    const next = nextSortState(sortKey, sortDirection, key);
    setSortKey(next.sortKey);
    setSortDirection(next.sortDirection);
  };

  const toggle = (id: string) => setOpen((prev) => ({ ...prev, [id]: !prev[id] }));
  const canExpand = () => !readOnly && Boolean(onChange);

  const detailRow = (holding: EnrichedHolding, colSpan: number) => (
    canExpand() && onChange && open[holding.id] ? (
      <tr className="border-t border-ink/10" key={`${holding.id}-details`}>
        <td colSpan={colSpan} className="p-0"><HoldingDetails holding={holding} settings={settings} currency={currency} onChange={onChange} /></td>
      </tr>
    ) : null
  );

  return (
    <>
      <div className="md:hidden">
        {sortedHoldings.length ? (
          <div className="flex items-center justify-between gap-3 border-b border-ink/10 bg-paper/50 px-3 py-2">
            <p className="text-xs font-medium text-ink/60">Sort holdings</p>
            <HoldingsSortControl
              variant="mobile"
              sortKey={sortKey}
              sortDirection={sortDirection}
              onSortKeyChange={(key) => {
                setSortKey(key);
                setSortDirection("asc");
              }}
              onSortDirectionToggle={() => setSortDirection((value) => (value === "asc" ? "desc" : "asc"))}
            />
          </div>
        ) : null}
        <div className="table-scroll -mx-4 isolate overflow-x-auto border-b border-ink/10 bg-white">
        <table className="min-w-[600px] w-full border-collapse text-left text-[10px]">
          <thead className="bg-marine text-[10px] uppercase text-white">
            <tr>
              <th className="w-7 px-1 py-1.5" aria-label="Expand" />
              <HoldingsSortHeader label="Symbol" sortKey="symbol" activeKey={sortKey} direction={sortDirection} onSort={handleSort} className="px-1.5 py-1.5" />
              <HoldingsSortHeader label="Price" sortKey="currentPrice" activeKey={sortKey} direction={sortDirection} onSort={handleSort} className="px-1.5 py-1.5" />
              <HoldingsSortHeader label="Value" sortKey="currentValue" activeKey={sortKey} direction={sortDirection} onSort={handleSort} className="px-1.5 py-1.5" />
              <HoldingsSortHeader label="P/L" sortKey="currentProfitLoss" activeKey={sortKey} direction={sortDirection} onSort={handleSort} className="px-1.5 py-1.5" />
              <HoldingsSortHeader label="Day" sortKey="dailyProfitLoss" activeKey={sortKey} direction={sortDirection} onSort={handleSort} className="px-1.5 py-1.5" />
              <HoldingsSortHeader label="Act" sortKey="action" activeKey={sortKey} direction={sortDirection} onSort={handleSort} className="px-1.5 py-1.5" />
              <HoldingsSortHeader label="Stop" sortKey="stopPrice" activeKey={sortKey} direction={sortDirection} onSort={handleSort} className="px-1.5 py-1.5" />
              <HoldingsSortHeader label="Tgt" sortKey="targetPrice" activeKey={sortKey} direction={sortDirection} onSort={handleSort} className="px-1.5 py-1.5" />
            </tr>
          </thead>
          <tbody>
            {sortedHoldings.map((holding) => {
              const quote = holding.quote;
              const metrics = computeHoldingRowMetrics(holding, settings);
              return [
                <tr className="border-t border-ink/10 even:bg-paper/40" key={`${holding.id}-mobile`}>
                  <td className="bg-inherit px-0.5 py-1">
                    {canExpand() ? (
                      <button className="flex min-h-8 min-w-8 items-center justify-center rounded p-0.5" type="button" onClick={() => toggle(holding.id)} aria-label={`Expand ${holding.symbol}`} aria-expanded={Boolean(open[holding.id])}>
                        {open[holding.id] ? <ChevronDown className="h-3.5 w-3.5" aria-hidden /> : <ChevronRight className="h-3.5 w-3.5" aria-hidden />}
                      </button>
                    ) : null}
                  </td>
                  <td className="bg-inherit px-1.5 py-1 font-bold">{holding.symbol}</td>
                  <td className="whitespace-nowrap px-1.5 py-1 font-semibold text-marine">{quote ? shortMoney(quote.currentPrice, currency) : "…"}</td>
                  <td className="whitespace-nowrap px-1.5 py-1">{metrics.current ? shortMoney(metrics.current.grossValue, currency) : "—"}</td>
                  <td className={`whitespace-nowrap px-1.5 py-1 font-semibold ${valueClass(metrics.current?.profitLoss)}`}>{metrics.current ? `${shortMoney(metrics.current.profitLoss, currency)} ${metrics.current.profitLossPercent}%` : "—"}</td>
                  <td className={`whitespace-nowrap px-1.5 py-1 font-semibold ${valueClass(metrics.daily?.profitLoss)}`}>{metrics.daily ? `${shortMoney(metrics.daily.profitLoss, currency)} ${metrics.daily.profitLossPercent}%` : "—"}</td>
                  <td className="px-1.5 py-1">{badge(holding.analysis?.action, true)}</td>
                  <td className="whitespace-nowrap px-1.5 py-1">{metrics.stopPrice ? shortMoney(metrics.stopPrice, currency) : "—"}</td>
                  <td className="whitespace-nowrap px-1.5 py-1 font-semibold text-marine">{metrics.targetPrice ? shortMoney(metrics.targetPrice, currency) : "—"}</td>
                </tr>,
                detailRow(holding, 9)
              ];
            })}
          </tbody>
        </table>
        </div>
      </div>

      <div className="table-scroll -mx-4 hidden isolate overflow-x-auto border-y border-ink/10 bg-white sm:-mx-5 md:block">
        <table className="min-w-[1220px] w-full border-collapse text-left text-xs sm:min-w-[1420px] sm:text-sm">
          <thead className="bg-marine text-xs uppercase text-white">
            <tr className="hidden border-b border-white/15 sm:table-row">
              <th className="px-3 py-2 text-center" colSpan={4}>Position</th>
              <th className="border-l-2 border-white/30 px-3 py-2 text-center" colSpan={4}>Market</th>
              <th className="border-l-2 border-white/30 px-3 py-2 text-center" colSpan={2}>Analysis</th>
              <th className="border-l-2 border-white/30 px-3 py-2 text-center" colSpan={2}>Stop</th>
              <th className="border-l-2 border-white/30 px-3 py-2 text-center" colSpan={2}>Target</th>
              <th className="border-l-2 border-white/30 px-3 py-2 text-center">Risk</th>
            </tr>
            <tr className="bg-marine/95">
              <th className="px-2 py-2 sm:px-3 sm:py-3" aria-label="Expand row" />
              <HoldingsSortHeader label="Symbol" sortKey="symbol" activeKey={sortKey} direction={sortDirection} onSort={handleSort} className="px-2 py-2 sm:px-3 sm:py-3" />
              <HoldingsSortHeader label="Shares" sortKey="shares" activeKey={sortKey} direction={sortDirection} onSort={handleSort} className="px-2 py-2 sm:px-3 sm:py-3" />
              <HoldingsSortHeader label="Avg cost" sortKey="averageCost" activeKey={sortKey} direction={sortDirection} onSort={handleSort} className="px-2 py-2 sm:px-3 sm:py-3" />
              <HoldingsSortHeader label="Current price" sortKey="currentPrice" activeKey={sortKey} direction={sortDirection} onSort={handleSort} className="border-l-2 border-white/30 px-2 py-2 sm:px-3 sm:py-3" />
              <HoldingsSortHeader label="Current value" sortKey="currentValue" activeKey={sortKey} direction={sortDirection} onSort={handleSort} className="px-2 py-2 sm:px-3 sm:py-3" />
              <HoldingsSortHeader label="Current P/L" sortKey="currentProfitLoss" activeKey={sortKey} direction={sortDirection} onSort={handleSort} className="px-2 py-2 sm:px-3 sm:py-3" />
              <HoldingsSortHeader label="Daily P/L" sortKey="dailyProfitLoss" activeKey={sortKey} direction={sortDirection} onSort={handleSort} className="px-2 py-2 sm:px-3 sm:py-3" />
              <HoldingsSortHeader label="AI action" sortKey="action" activeKey={sortKey} direction={sortDirection} onSort={handleSort} className="border-l-2 border-white/30 px-2 py-2 sm:px-3 sm:py-3" />
              <HoldingsSortHeader label="Confidence" sortKey="confidence" activeKey={sortKey} direction={sortDirection} onSort={handleSort} className="px-2 py-2 sm:px-3 sm:py-3" />
              <HoldingsSortHeader label="Suggested stop-loss" sortKey="stopPrice" activeKey={sortKey} direction={sortDirection} onSort={handleSort} className="border-l-2 border-white/30 px-2 py-2 sm:px-3 sm:py-3" />
              <HoldingsSortHeader label="P/L if stop hits" sortKey="stopProfitLoss" activeKey={sortKey} direction={sortDirection} onSort={handleSort} className="px-2 py-2 sm:px-3 sm:py-3" />
              <HoldingsSortHeader label="Target sell price" sortKey="targetPrice" activeKey={sortKey} direction={sortDirection} onSort={handleSort} className="border-l-2 border-white/30 px-2 py-2 sm:px-3 sm:py-3" />
              <HoldingsSortHeader label="P/L at target" sortKey="targetProfitLoss" activeKey={sortKey} direction={sortDirection} onSort={handleSort} className="px-2 py-2 sm:px-3 sm:py-3" />
              <HoldingsSortHeader label="Risk" sortKey="risk" activeKey={sortKey} direction={sortDirection} onSort={handleSort} className="border-l-2 border-white/30 px-2 py-2 sm:px-3 sm:py-3" />
            </tr>
          </thead>
          <tbody>
            {sortedHoldings.map((holding) => {
              const quote = holding.quote;
              const metrics = computeHoldingRowMetrics(holding, settings);
              return [
                <tr className="border-t border-ink/10 even:bg-paper/50 hover:bg-mint/20" key={`${holding.id}-summary`}>
                  <td className="bg-inherit px-2 py-2 sm:px-3 sm:py-3">
                    {canExpand() ? (
                      <button className="min-h-8 rounded p-1 hover:bg-mint" type="button" onClick={() => toggle(holding.id)} aria-label={`Expand ${holding.symbol}`} aria-expanded={Boolean(open[holding.id])}>
                        {open[holding.id] ? <ChevronDown className="h-4 w-4" aria-hidden /> : <ChevronRight className="h-4 w-4" aria-hidden />}
                      </button>
                    ) : null}
                  </td>
                  <td className="bg-inherit px-2 py-2 font-bold sm:px-3 sm:py-3">{holding.symbol}<span className="block max-w-32 truncate text-[11px] font-normal text-ink/55 sm:max-w-44 sm:text-xs">{holding.name}</span></td>
                  <td className="px-2 py-2 sm:px-3 sm:py-3">{holding.shares}</td>
                  <td className="px-2 py-2 sm:px-3 sm:py-3">{formatMoney(holding.averageCost, currency)}</td>
                  <td className="border-l-2 border-ink/15 bg-marine/5 px-2 py-2 font-semibold text-marine sm:px-3 sm:py-3">{quote ? formatMoney(quote.currentPrice, currency) : "Loading"}</td>
                  <td className="px-2 py-2 sm:px-3 sm:py-3">{metrics.current ? formatMoney(metrics.current.grossValue, currency) : "N/A"}</td>
                  <td className={`bg-marine/5 px-2 py-2 font-semibold sm:px-3 sm:py-3 ${valueClass(metrics.current?.profitLoss)}`}>{metrics.current ? `${formatMoney(metrics.current.profitLoss, currency)} (${metrics.current.profitLossPercent}%)` : "N/A"}</td>
                  <td className={`px-2 py-2 font-semibold sm:px-3 sm:py-3 ${valueClass(metrics.daily?.profitLoss)}`}>{metrics.daily ? `${formatMoney(metrics.daily.profitLoss, currency)} (${metrics.daily.profitLossPercent}%)` : "N/A"}</td>
                  <td className="border-l-2 border-ink/15 px-2 py-2 sm:px-3 sm:py-3">{badge(holding.analysis?.action)}</td>
                  <td className="px-2 py-2 sm:px-3 sm:py-3">{badge(holding.analysis?.confidence)}</td>
                  <td className="border-l-2 border-ink/15 bg-amber/10 px-2 py-2 font-semibold sm:px-3 sm:py-3">{metrics.stopPrice ? formatMoney(metrics.stopPrice, currency) : "N/A"}</td>
                  <td className="px-2 py-2 sm:px-3 sm:py-3">{metrics.stopPl ? `${formatMoney(metrics.stopPl.profitLoss, currency)} (${metrics.stopPl.profitLossPercent}%)` : "N/A"}</td>
                  <td className="border-l-2 border-ink/15 bg-mint/70 px-2 py-2 font-bold text-marine sm:px-3 sm:py-3">{metrics.targetPrice ? formatMoney(metrics.targetPrice, currency) : "N/A"}</td>
                  <td className={`bg-mint/70 px-2 py-2 font-bold sm:px-3 sm:py-3 ${valueClass(metrics.targetPl?.profitLoss)}`}>{metrics.targetPl ? `${formatMoney(metrics.targetPl.profitLoss, currency)} (${metrics.targetPl.profitLossPercent}%)` : "N/A"}</td>
                  <td className="border-l-2 border-ink/15 px-2 py-2 sm:px-3 sm:py-3">{badge(holding.analysis?.riskLevel)}</td>
                </tr>,
                detailRow(holding, 15)
              ];
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
