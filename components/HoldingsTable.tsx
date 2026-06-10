"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import type { CurrencyCode, EnrichedHolding, FeeSettings } from "@/lib/types";
import { totalCostFor } from "@/lib/calculations";
import { computeHoldingRowMetrics, profitLossTone, badgeTone } from "@/lib/holdingDisplay";
import { nextSortState, sortHoldings, type HoldingSortKey, type SortDirection } from "@/lib/holdingSort";
import { formatMoney } from "@/lib/profileUtils";
import {
  HoldingsMobileHeader,
  HoldingsMobileSectionHeader,
  HoldingsSortControl,
  HoldingsSortHeader
} from "./HoldingsSortControl";
import { HoldingDetails } from "./HoldingDetails";
import { TargetPlanner } from "./TargetPlanner";
import { StaleQuoteMarker } from "./StaleQuoteMarker";

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

function mobileMoney(value: number, currency: CurrencyCode) {
  return formatMoney(value, currency);
}

function isLiveQuote(quote?: EnrichedHolding["quote"]) {
  return Boolean(quote?.currentPrice && quote.provider !== "mock" && quote.provider !== "unavailable" && !quote.error);
}

function priceLabel(quote: EnrichedHolding["quote"] | undefined, currency: CurrencyCode) {
  if (!quote) return "Loading";
  if (!isLiveQuote(quote)) return "Unavailable";
  return formatMoney(quote.currentPrice, currency);
}

const MOBILE_COLUMN_COUNT = 7;
const MOBILE_SECTION_BORDER = "border-l-2 border-ink/15";
const MOBILE_MARKET_SECTION = `${MOBILE_SECTION_BORDER} bg-marine/[0.04]`;
const MOBILE_TARGET_SECTION = `${MOBILE_SECTION_BORDER} bg-mint/35`;
const MOBILE_HEADER_SECTION_BORDER = "border-l-2 border-white/30";

function MobileHoldingsColgroup() {
  return (
    <colgroup>
      <col className="w-7" />
      <col className="w-[16%]" />
      <col className="w-[17%]" />
      <col className="w-[17%]" />
      <col className="w-[18%]" />
      <col className="w-[16%]" />
      <col className="w-[16%]" />
    </colgroup>
  );
}

function formatShareCount(shares: number) {
  if (Number.isInteger(shares)) return `${shares} sh`;
  const rounded = Number(shares.toFixed(2));
  return `${rounded} sh`;
}

function mobileStackedCell(
  primary: ReactNode,
  secondary: ReactNode,
  options: { primaryClass?: string; secondaryClass?: string } = {}
) {
  return (
    <div className="leading-tight">
      <div className={`whitespace-nowrap font-semibold tabular-nums ${options.primaryClass || ""}`}>{primary}</div>
      <div className={`mt-0.5 whitespace-nowrap tabular-nums ${options.secondaryClass || "text-[10px] text-ink/45"}`}>{secondary}</div>
    </div>
  );
}

function mobileCostCell(holding: EnrichedHolding, currency: CurrencyCode) {
  const totalCost = holding.totalCost > 0 ? holding.totalCost : totalCostFor(holding.shares, holding.averageCost);
  return mobileStackedCell(
    mobileMoney(totalCost, currency),
    `${mobileMoney(holding.averageCost, currency)}/sh`
  );
}

function mobileValueCell(holding: EnrichedHolding, grossValue: number | undefined, currency: CurrencyCode) {
  return mobileStackedCell(
    grossValue !== undefined ? mobileMoney(grossValue, currency) : "—",
    formatShareCount(holding.shares)
  );
}

function mobilePriceCell(quote: EnrichedHolding["quote"] | undefined, currency: CurrencyCode) {
  const dailyPercent = quote?.dailyChangePercent;
  const dailyLabel = dailyPercent !== undefined
    ? `${dailyPercent > 0 ? "+" : ""}${dailyPercent}%`
    : "—";
  return mobileStackedCell(
    priceLabel(quote, currency),
    dailyLabel,
    { primaryClass: "text-marine", secondaryClass: `text-[10px] tabular-nums ${valueClass(dailyPercent)}` }
  );
}

function DesktopHoldingsColgroup() {
  return (
    <colgroup>
      <col className="w-[2.5%]" />
      <col className="w-[7.5%]" />
      <col className="w-[5.5%]" />
      <col className="w-[7%]" />
      <col className="w-[6.5%]" />
      <col className="w-[6.5%]" />
      <col className="w-[7.5%]" />
      <col className="w-[7%]" />
      <col className="w-[5.5%]" />
      <col className="w-[5.5%]" />
      <col className="w-[6.5%]" />
      <col className="w-[7%]" />
      <col className="w-[6.5%]" />
      <col className="w-[7.5%]" />
      <col className="w-[5.5%]" />
    </colgroup>
  );
}

function stackedPlCell(profitLoss?: number, profitLossPercent?: number, currency?: CurrencyCode) {
  if (profitLoss === undefined || profitLossPercent === undefined || !currency) return "—";
  const percentLabel = `${profitLossPercent > 0 ? "+" : ""}${profitLossPercent}%`;
  return mobileStackedCell(
    mobileMoney(profitLoss, currency),
    percentLabel,
    { primaryClass: valueClass(profitLoss), secondaryClass: `text-[10px] tabular-nums ${valueClass(profitLoss)}` }
  );
}

function symbolWithActionCell(holding: EnrichedHolding, stale?: boolean) {
  return (
    <div className="min-w-0 leading-tight">
      <div className="inline-flex max-w-full items-center font-bold">
        <span className="truncate">{holding.symbol}</span>
        {stale ? <StaleQuoteMarker /> : null}
      </div>
      <div className="mt-0.5">{badge(holding.analysis?.action, true)}</div>
    </div>
  );
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
  const expandRow = (id: string) => setOpen((prev) => ({ ...prev, [id]: true }));
  const canExpand = () => !readOnly && Boolean(onChange);

  const detailRow = (holding: EnrichedHolding, colSpan: number) => (
    canExpand() && onChange && open[holding.id] ? (
      <tr className="border-t border-ink/10" key={`${holding.id}-details`}>
        <td colSpan={colSpan} className="p-0">
          <div className="expand-panel-enter">
            <TargetPlanner holding={holding} settings={settings} currency={currency} onChange={onChange} />
            <HoldingDetails holding={holding} settings={settings} currency={currency} onChange={onChange} />
          </div>
        </td>
      </tr>
    ) : null
  );

  const targetCell = (holding: EnrichedHolding, price?: number, compact = false) => {
    if (!price) return compact ? "—" : "N/A";
    const label = formatMoney(price, currency);
    if (!canExpand()) {
      return <span className="font-semibold text-marine">{label}</span>;
    }
    return (
      <button
        className={`block whitespace-nowrap text-left font-semibold tabular-nums text-marine underline decoration-marine/35 decoration-dotted underline-offset-2 hover:text-marine/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-marine ${compact ? "text-xs" : "text-sm"}`}
        type="button"
        aria-label={`Plan target for ${holding.symbol}`}
        aria-expanded={Boolean(open[holding.id])}
        onClick={() => expandRow(holding.id)}
      >
        {label}
      </button>
    );
  };

  const mobileDetailRow = (holding: EnrichedHolding) => (
    canExpand() && onChange && open[holding.id] ? (
      <tr className="border-t border-ink/10 bg-white" key={`${holding.id}-details`}>
        <td colSpan={MOBILE_COLUMN_COUNT} className="p-0">
          <div className="expand-panel-enter">
            <TargetPlanner holding={holding} settings={settings} currency={currency} onChange={onChange} />
            <HoldingDetails holding={holding} settings={settings} currency={currency} onChange={onChange} />
          </div>
        </td>
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
        <div className="border-b border-ink/10 bg-white">
          <table className="holdings-mobile-table w-full table-fixed border-collapse text-left text-xs">
            <MobileHoldingsColgroup />
            <thead className="bg-marine text-white">
              <tr className="border-b border-white/15">
                <th className="px-1 py-1.5" aria-label="Expand" />
                <HoldingsMobileSectionHeader label="Position" colSpan={3} />
                <HoldingsMobileSectionHeader label="Market" colSpan={2} className={MOBILE_HEADER_SECTION_BORDER} />
                <HoldingsMobileSectionHeader label="Target" colSpan={1} className={MOBILE_HEADER_SECTION_BORDER} />
              </tr>
              <tr className="bg-marine/95">
                <th className="px-1 py-2" aria-label="Expand" />
                <HoldingsMobileHeader label="Symbol" className="px-1.5 py-2" />
                <HoldingsMobileHeader label="Cost" className="px-1.5 py-2" />
                <HoldingsMobileHeader label="Value" className="px-1.5 py-2" />
                <HoldingsMobileHeader label="P/L" className={`px-1.5 py-2 ${MOBILE_HEADER_SECTION_BORDER}`} />
                <HoldingsMobileHeader label="Price" className="px-1.5 py-2" />
                <HoldingsMobileHeader label="Target" className={`px-1.5 py-2 ${MOBILE_HEADER_SECTION_BORDER}`} />
              </tr>
            </thead>
            <tbody>
              {sortedHoldings.map((holding, index) => {
                const quote = holding.quote;
                const metrics = computeHoldingRowMetrics(holding, settings);
                const rowTone = index % 2 === 1 ? "bg-paper/40" : "bg-white";
                return [
                  <tr className={`border-t border-ink/10 ${rowTone}`} key={`${holding.id}-summary`}>
                    <td className="bg-inherit px-1 py-3 align-middle">
                      {canExpand() ? (
                        <button className="flex min-h-9 min-w-9 items-center justify-center rounded p-0.5" type="button" onClick={() => toggle(holding.id)} aria-label={`Expand ${holding.symbol}`} aria-expanded={Boolean(open[holding.id])}>
                          {open[holding.id] ? <ChevronDown className="h-4 w-4" aria-hidden /> : <ChevronRight className="h-4 w-4" aria-hidden />}
                        </button>
                      ) : null}
                    </td>
                    <td className="bg-inherit px-1.5 py-3 align-middle">{symbolWithActionCell(holding, quote?.stale)}</td>
                    <td className="bg-inherit px-1.5 py-3 align-middle">{mobileCostCell(holding, currency)}</td>
                    <td className="bg-inherit px-1.5 py-3 align-middle">{mobileValueCell(holding, metrics.current?.grossValue, currency)}</td>
                    <td className={`px-1.5 py-3 align-middle ${MOBILE_MARKET_SECTION}`}>{stackedPlCell(metrics.current?.profitLoss, metrics.current?.profitLossPercent, currency)}</td>
                    <td className={`px-1.5 py-3 align-middle ${MOBILE_MARKET_SECTION}`}>{mobilePriceCell(quote, currency)}</td>
                    <td className={`px-1.5 py-3 align-middle ${MOBILE_TARGET_SECTION}`}>{targetCell(holding, metrics.targetPrice, true)}</td>
                  </tr>,
                  mobileDetailRow(holding)
                ];
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="hidden border-y border-ink/10 bg-white md:block">
        <table className="holdings-desktop-table w-full table-fixed border-collapse text-left text-xs lg:text-sm">
          <DesktopHoldingsColgroup />
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
              <th className="px-1.5 py-2 lg:px-2 lg:py-3" aria-label="Expand row" />
              <HoldingsSortHeader label="Symbol" sortKey="symbol" activeKey={sortKey} direction={sortDirection} onSort={handleSort} className="px-1.5 py-2 lg:px-2 lg:py-3" />
              <HoldingsSortHeader label="Shares" sortKey="shares" activeKey={sortKey} direction={sortDirection} onSort={handleSort} className="px-1.5 py-2 lg:px-2 lg:py-3" />
              <HoldingsSortHeader label="Avg cost" sortKey="averageCost" activeKey={sortKey} direction={sortDirection} onSort={handleSort} className="px-1.5 py-2 lg:px-2 lg:py-3" />
              <HoldingsSortHeader label="Price" sortKey="currentPrice" activeKey={sortKey} direction={sortDirection} onSort={handleSort} className="border-l-2 border-white/30 px-1.5 py-2 lg:px-2 lg:py-3" />
              <HoldingsSortHeader label="Value" sortKey="currentValue" activeKey={sortKey} direction={sortDirection} onSort={handleSort} className="px-1.5 py-2 lg:px-2 lg:py-3" />
              <HoldingsSortHeader label="P/L" sortKey="currentProfitLoss" activeKey={sortKey} direction={sortDirection} onSort={handleSort} className="px-1.5 py-2 lg:px-2 lg:py-3" />
              <HoldingsSortHeader label="Daily" sortKey="dailyProfitLoss" activeKey={sortKey} direction={sortDirection} onSort={handleSort} className="px-1.5 py-2 lg:px-2 lg:py-3" />
              <HoldingsSortHeader label="Action" sortKey="action" activeKey={sortKey} direction={sortDirection} onSort={handleSort} className="border-l-2 border-white/30 px-1.5 py-2 lg:px-2 lg:py-3" />
              <HoldingsSortHeader label="Conf." sortKey="confidence" activeKey={sortKey} direction={sortDirection} onSort={handleSort} className="px-1.5 py-2 lg:px-2 lg:py-3" />
              <HoldingsSortHeader label="Stop" sortKey="stopPrice" activeKey={sortKey} direction={sortDirection} onSort={handleSort} className="border-l-2 border-white/30 px-1.5 py-2 lg:px-2 lg:py-3" />
              <HoldingsSortHeader label="Stop P/L" sortKey="stopProfitLoss" activeKey={sortKey} direction={sortDirection} onSort={handleSort} className="px-1.5 py-2 lg:px-2 lg:py-3" />
              <HoldingsSortHeader label="Target" sortKey="targetPrice" activeKey={sortKey} direction={sortDirection} onSort={handleSort} className="border-l-2 border-white/30 px-1.5 py-2 lg:px-2 lg:py-3" />
              <HoldingsSortHeader label="Tgt P/L" sortKey="targetProfitLoss" activeKey={sortKey} direction={sortDirection} onSort={handleSort} className="px-1.5 py-2 lg:px-2 lg:py-3" />
              <HoldingsSortHeader label="Risk" sortKey="risk" activeKey={sortKey} direction={sortDirection} onSort={handleSort} className="border-l-2 border-white/30 px-1.5 py-2 lg:px-2 lg:py-3" />
            </tr>
          </thead>
          <tbody>
            {sortedHoldings.map((holding) => {
              const quote = holding.quote;
              const metrics = computeHoldingRowMetrics(holding, settings);
              return [
                <tr className="border-t border-ink/10 even:bg-paper/50 hover:bg-mint/20" key={`${holding.id}-summary`}>
                  <td className="bg-inherit px-1.5 py-2 lg:px-2 lg:py-3">
                    {canExpand() ? (
                      <button className="min-h-8 rounded p-1 hover:bg-mint" type="button" onClick={() => toggle(holding.id)} aria-label={`Expand ${holding.symbol}`} aria-expanded={Boolean(open[holding.id])}>
                        {open[holding.id] ? <ChevronDown className="h-4 w-4" aria-hidden /> : <ChevronRight className="h-4 w-4" aria-hidden />}
                      </button>
                    ) : null}
                  </td>
                  <td className="bg-inherit px-1.5 py-2 font-bold lg:px-2 lg:py-3">
                    <span className="inline-flex items-center gap-0.5">
                      {holding.symbol}
                      {quote?.stale ? <StaleQuoteMarker /> : null}
                    </span>
                    <span className="block truncate text-[11px] font-normal text-ink/55 lg:text-xs">{holding.name}</span>
                  </td>
                  <td className="whitespace-nowrap px-1.5 py-2 tabular-nums lg:px-2 lg:py-3">{holding.shares}</td>
                  <td className="whitespace-nowrap px-1.5 py-2 tabular-nums lg:px-2 lg:py-3">{formatMoney(holding.averageCost, currency)}</td>
                  <td className="whitespace-nowrap border-l-2 border-ink/15 bg-marine/5 px-1.5 py-2 font-semibold tabular-nums text-marine lg:px-2 lg:py-3">
                    {priceLabel(quote, currency)}
                  </td>
                  <td className="truncate px-1.5 py-2 lg:px-2 lg:py-3">{metrics.current ? formatMoney(metrics.current.grossValue, currency) : "N/A"}</td>
                  <td className={`truncate bg-marine/5 px-1.5 py-2 font-semibold lg:px-2 lg:py-3 ${valueClass(metrics.current?.profitLoss)}`}>{metrics.current ? `${formatMoney(metrics.current.profitLoss, currency)} (${metrics.current.profitLossPercent}%)` : "N/A"}</td>
                  <td className={`truncate px-1.5 py-2 font-semibold lg:px-2 lg:py-3 ${valueClass(metrics.daily?.profitLoss)}`}>{metrics.daily ? `${formatMoney(metrics.daily.profitLoss, currency)} (${metrics.daily.profitLossPercent}%)` : "N/A"}</td>
                  <td className="border-l-2 border-ink/15 px-1.5 py-2 lg:px-2 lg:py-3">{badge(holding.analysis?.action)}</td>
                  <td className="px-1.5 py-2 lg:px-2 lg:py-3">{badge(holding.analysis?.confidence)}</td>
                  <td className="truncate border-l-2 border-ink/15 bg-amber/10 px-1.5 py-2 font-semibold lg:px-2 lg:py-3">{metrics.stopPrice ? formatMoney(metrics.stopPrice, currency) : "N/A"}</td>
                  <td className="truncate px-1.5 py-2 lg:px-2 lg:py-3">{metrics.stopPl ? `${formatMoney(metrics.stopPl.profitLoss, currency)} (${metrics.stopPl.profitLossPercent}%)` : "N/A"}</td>
                  <td className="truncate border-l-2 border-ink/15 bg-mint/70 px-1.5 py-2 lg:px-2 lg:py-3">{targetCell(holding, metrics.targetPrice)}</td>
                  <td className={`truncate bg-mint/70 px-1.5 py-2 font-bold lg:px-2 lg:py-3 ${valueClass(metrics.targetPl?.profitLoss)}`}>{metrics.targetPl ? `${formatMoney(metrics.targetPl.profitLoss, currency)} (${metrics.targetPl.profitLossPercent}%)` : "N/A"}</td>
                  <td className="border-l-2 border-ink/15 px-1.5 py-2 lg:px-2 lg:py-3">{badge(holding.analysis?.riskLevel)}</td>
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
