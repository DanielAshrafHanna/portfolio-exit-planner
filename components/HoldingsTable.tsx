"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import type { CurrencyCode, EnrichedHolding, FeeSettings } from "@/lib/types";
import { totalCostFor } from "@/lib/calculations";
import { computeHoldingRowMetrics, profitLossTone, badgeTone } from "@/lib/holdingDisplay";
import { nextSortState, sortHoldings, type HoldingSortKey, type SortDirection } from "@/lib/holdingSort";
import { formatMoney, formatMoneyTable } from "@/lib/profileUtils";
import {
  HoldingsMobileHeader,
  HoldingsMobileSectionHeader,
  HoldingsSortControl,
  HoldingsSortHeader
} from "./HoldingsSortControl";
import { HoldingDetails } from "./HoldingDetails";
import { HoldingsFitText } from "./HoldingsFitText";
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

type FitSizes = { min: number; max: number; minSm: number; maxSm: number };

function tableMoney(value: number, currency: CurrencyCode) {
  return formatMoneyTable(value, currency);
}

function fitSizesFor(currency: CurrencyCode): FitSizes {
  if (currency === "EGP") {
    return { min: 6, max: 13, minSm: 5.5, maxSm: 9 };
  }
  return { min: 8, max: 12, minSm: 7, maxSm: 10 };
}

function isLiveQuote(quote?: EnrichedHolding["quote"]) {
  return Boolean(quote?.currentPrice && quote.provider !== "mock" && quote.provider !== "unavailable" && !quote.error);
}

function priceLabel(quote: EnrichedHolding["quote"] | undefined, currency: CurrencyCode) {
  if (!quote) return "Loading";
  if (!isLiveQuote(quote)) return "Unavailable";
  return tableMoney(quote.currentPrice, currency);
}

const MOBILE_COLUMN_COUNT = 7;
const MOBILE_SECTION_BORDER = "border-l-2 border-ink/15";
const MOBILE_MARKET_SECTION = `${MOBILE_SECTION_BORDER} bg-marine/[0.04]`;
const MOBILE_TARGET_SECTION = `${MOBILE_SECTION_BORDER} bg-mint/35`;
const MOBILE_HEADER_SECTION_BORDER = "border-l-2 border-white/30";

function MobileHoldingsColgroup({ currency }: { currency: CurrencyCode }) {
  if (currency === "EGP") {
    return (
      <colgroup>
        <col className="w-7" />
        <col className="w-[11%]" />
        <col className="w-[19%]" />
        <col className="w-[19%]" />
        <col className="w-[19%]" />
        <col className="w-[17%]" />
        <col className="w-[15%]" />
      </colgroup>
    );
  }
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
  sizes: FitSizes,
  options: { primaryClass?: string; secondaryClass?: string } = {}
) {
  return (
    <div className="min-w-0 max-w-full leading-tight">
      <HoldingsFitText minSize={sizes.min} maxSize={sizes.max} className={`font-semibold ${options.primaryClass || ""}`}>
        {primary}
      </HoldingsFitText>
      <HoldingsFitText
        minSize={sizes.minSm}
        maxSize={sizes.maxSm}
        className={`mt-0.5 ${options.secondaryClass || "text-ink/45"}`}
      >
        {secondary}
      </HoldingsFitText>
    </div>
  );
}

function mobileCostCell(holding: EnrichedHolding, currency: CurrencyCode, sizes: FitSizes) {
  const totalCost = holding.totalCost > 0 ? holding.totalCost : totalCostFor(holding.shares, holding.averageCost);
  return mobileStackedCell(
    tableMoney(totalCost, currency),
    `${tableMoney(holding.averageCost, currency)}/sh`,
    sizes
  );
}

function mobileValueCell(holding: EnrichedHolding, grossValue: number | undefined, currency: CurrencyCode, sizes: FitSizes) {
  return mobileStackedCell(
    grossValue !== undefined ? tableMoney(grossValue, currency) : "—",
    formatShareCount(holding.shares),
    sizes
  );
}

function mobilePriceCell(quote: EnrichedHolding["quote"] | undefined, currency: CurrencyCode, sizes: FitSizes) {
  const dailyPercent = quote?.dailyChangePercent;
  const dailyLabel = dailyPercent !== undefined
    ? `${dailyPercent > 0 ? "+" : ""}${dailyPercent}%`
    : "—";
  return mobileStackedCell(
    priceLabel(quote, currency),
    dailyLabel,
    sizes,
    { primaryClass: "text-marine", secondaryClass: valueClass(dailyPercent) }
  );
}

function DesktopHoldingsColgroup({ currency }: { currency: CurrencyCode }) {
  if (currency === "EGP") {
    return (
      <colgroup>
        <col className="w-[2%]" />
        <col className="w-[6%]" />
        <col className="w-[5%]" />
        <col className="w-[7.5%]" />
        <col className="w-[8%]" />
        <col className="w-[8%]" />
        <col className="w-[8%]" />
        <col className="w-[7%]" />
        <col className="w-[5%]" />
        <col className="w-[4.5%]" />
        <col className="w-[7.5%]" />
        <col className="w-[7.5%]" />
        <col className="w-[8%]" />
        <col className="w-[8%]" />
        <col className="w-[5%]" />
      </colgroup>
    );
  }
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

function stackedPlCell(
  profitLoss?: number,
  profitLossPercent?: number,
  currency?: CurrencyCode,
  sizes?: FitSizes
) {
  if (profitLoss === undefined || profitLossPercent === undefined || !currency || !sizes) return "—";
  const percentLabel = `${profitLossPercent > 0 ? "+" : ""}${profitLossPercent}%`;
  return mobileStackedCell(
    tableMoney(profitLoss, currency),
    percentLabel,
    sizes,
    { primaryClass: valueClass(profitLoss), secondaryClass: valueClass(profitLoss) }
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
  const fitSizes = fitSizesFor(currency);
  const tableClass = currency === "EGP" ? "holdings-table-egp" : "";

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
    const label = tableMoney(price, currency);
    const fullLabel = formatMoney(price, currency);
    if (!canExpand()) {
      return (
        <HoldingsFitText minSize={fitSizes.min} maxSize={fitSizes.max} className="font-semibold text-marine" title={fullLabel}>
          {label}
        </HoldingsFitText>
      );
    }
    return (
      <button
        className="block w-full max-w-full text-left font-semibold text-marine underline decoration-marine/35 decoration-dotted underline-offset-2 hover:text-marine/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-marine"
        type="button"
        title={fullLabel}
        aria-label={`Plan target for ${holding.symbol}`}
        aria-expanded={Boolean(open[holding.id])}
        onClick={() => expandRow(holding.id)}
      >
        <HoldingsFitText minSize={fitSizes.min} maxSize={fitSizes.max}>{label}</HoldingsFitText>
      </button>
    );
  };

  const fitText = (value: ReactNode, className = "", title?: string) => (
    <HoldingsFitText minSize={fitSizes.min} maxSize={fitSizes.max} className={className} title={title}>
      {value}
    </HoldingsFitText>
  );

  const desktopPlCell = (
    profitLoss?: number,
    profitLossPercent?: number,
    className = ""
  ) => {
    if (profitLoss === undefined || profitLossPercent === undefined) {
      return fitText("N/A", className);
    }
    if (currency === "EGP") {
      return stackedPlCell(profitLoss, profitLossPercent, currency, fitSizes);
    }
    return fitText(
      `${tableMoney(profitLoss, currency)} (${profitLossPercent > 0 ? "+" : ""}${profitLossPercent}%)`,
      className
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
          <table className={`holdings-mobile-table ${tableClass} w-full table-fixed border-collapse text-left text-xs`}>
            <MobileHoldingsColgroup currency={currency} />
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
                    <td className="bg-inherit px-1.5 py-3 align-middle">{mobileCostCell(holding, currency, fitSizes)}</td>
                    <td className="bg-inherit px-1.5 py-3 align-middle">{mobileValueCell(holding, metrics.current?.grossValue, currency, fitSizes)}</td>
                    <td className={`px-1.5 py-3 align-middle ${MOBILE_MARKET_SECTION}`}>{stackedPlCell(metrics.current?.profitLoss, metrics.current?.profitLossPercent, currency, fitSizes)}</td>
                    <td className={`px-1.5 py-3 align-middle ${MOBILE_MARKET_SECTION}`}>{mobilePriceCell(quote, currency, fitSizes)}</td>
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
        <table className={`holdings-desktop-table ${tableClass} w-full table-fixed border-collapse text-left text-xs lg:text-sm`}>
          <DesktopHoldingsColgroup currency={currency} />
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
                    <span className="inline-flex max-w-full items-center gap-0.5">
                      <span className="truncate">{holding.symbol}</span>
                      {quote?.stale ? <StaleQuoteMarker /> : null}
                    </span>
                    <HoldingsFitText minSize={fitSizes.minSm} maxSize={fitSizes.maxSm} className="font-normal text-ink/55">
                      {holding.name}
                    </HoldingsFitText>
                  </td>
                  <td className="px-1.5 py-2 lg:px-2 lg:py-3">{fitText(holding.shares)}</td>
                  <td className="px-1.5 py-2 lg:px-2 lg:py-3">{fitText(tableMoney(holding.averageCost, currency))}</td>
                  <td className="border-l-2 border-ink/15 bg-marine/5 px-1.5 py-2 lg:px-2 lg:py-3">
                    {fitText(priceLabel(quote, currency), "font-semibold text-marine")}
                  </td>
                  <td className="px-1.5 py-2 lg:px-2 lg:py-3">
                    {fitText(metrics.current ? tableMoney(metrics.current.grossValue, currency) : "N/A")}
                  </td>
                  <td className={`bg-marine/5 px-1.5 py-2 lg:px-2 lg:py-3 ${valueClass(metrics.current?.profitLoss)}`}>
                    {desktopPlCell(metrics.current?.profitLoss, metrics.current?.profitLossPercent, "font-semibold")}
                  </td>
                  <td className={`px-1.5 py-2 lg:px-2 lg:py-3 ${valueClass(metrics.daily?.profitLoss)}`}>
                    {desktopPlCell(metrics.daily?.profitLoss, metrics.daily?.profitLossPercent, "font-semibold")}
                  </td>
                  <td className="border-l-2 border-ink/15 px-1.5 py-2 lg:px-2 lg:py-3">{badge(holding.analysis?.action)}</td>
                  <td className="px-1.5 py-2 lg:px-2 lg:py-3">{badge(holding.analysis?.confidence)}</td>
                  <td className="border-l-2 border-ink/15 bg-amber/10 px-1.5 py-2 lg:px-2 lg:py-3">
                    {fitText(metrics.stopPrice ? tableMoney(metrics.stopPrice, currency) : "N/A", "font-semibold")}
                  </td>
                  <td className="px-1.5 py-2 lg:px-2 lg:py-3">
                    {desktopPlCell(metrics.stopPl?.profitLoss, metrics.stopPl?.profitLossPercent)}
                  </td>
                  <td className="border-l-2 border-ink/15 bg-mint/70 px-1.5 py-2 lg:px-2 lg:py-3">{targetCell(holding, metrics.targetPrice)}</td>
                  <td className={`bg-mint/70 px-1.5 py-2 font-bold lg:px-2 lg:py-3 ${valueClass(metrics.targetPl?.profitLoss)}`}>
                    {desktopPlCell(metrics.targetPl?.profitLoss, metrics.targetPl?.profitLossPercent, "font-bold")}
                  </td>
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
