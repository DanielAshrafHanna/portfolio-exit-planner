"use client";

import { AlertTriangle, TrendingDown, TrendingUp, WalletCards } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { DailyPlRangeBar } from "@/components/DailyPlRangeBar";
import type { CurrencyCode, EnrichedHolding, FeeSettings } from "@/lib/types";
import { calculateProfitLoss, calculateStopLosses, defaultSellTargets, roundMoney } from "@/lib/calculations";
import { aggregateDailyPlRangeFromHoldings, type DailyPlRange } from "@/lib/dailyPlRange";
import { computeHoldingRowMetrics } from "@/lib/holdingDisplay";
import { formatMoney } from "@/lib/profileUtils";

type Props = { holdings: EnrichedHolding[]; settings: FeeSettings; currency: CurrencyCode };

type SummaryCard = { label: string; value: string; icon: LucideIcon; shortLabel: string; dailyRange?: DailyPlRange };

export function PortfolioSummary({ holdings, settings, currency }: Props) {
  const rows = holdings.filter((holding) => holding.quote);
  const totalCost = roundMoney(rows.reduce((sum, holding) => sum + holding.totalCost, 0));
  const totalValue = roundMoney(rows.reduce((sum, holding) => sum + calculateProfitLoss(holding.shares, holding.averageCost, holding.quote!.currentPrice, settings).grossValue, 0));
  const stopValue = roundMoney(rows.reduce((sum, holding) => {
    const stops = calculateStopLosses(holding, holding.quote!);
    return sum + calculateProfitLoss(holding.shares, holding.averageCost, stops[holding.selectedStopStyle].price, settings).netValue;
  }, 0));
  const targetValue = roundMoney(rows.reduce((sum, holding) => {
    const target = holding.selectedTargetPrice || defaultSellTargets(holding.quote!.currentPrice, holding.analysis?.suggestedActionPlan.suggestedTakeProfit)[1].price;
    return sum + calculateProfitLoss(holding.shares, holding.averageCost, target, settings).netValue;
  }, 0));
  const sortedByPl = rows.map((holding) => ({
    symbol: holding.symbol,
    pl: calculateProfitLoss(holding.shares, holding.averageCost, holding.quote!.currentPrice, settings).profitLoss
  })).sort((a, b) => a.pl - b.pl);
  const highestRisk = rows.find((holding) => holding.analysis?.riskLevel === "Very High") || rows.find((holding) => holding.analysis?.riskLevel === "High");
  const currentPl = roundMoney(totalValue - totalCost);
  const dailyTotals = rows.reduce((totals, holding) => {
    const daily = computeHoldingRowMetrics(holding, settings).daily;
    if (!daily) return totals;
    return {
      profitLoss: totals.profitLoss + daily.profitLoss,
      priorValue: totals.priorValue + daily.priorValue
    };
  }, { profitLoss: 0, priorValue: 0 });
  const totalDailyPl = roundMoney(dailyTotals.profitLoss);
  const totalDailyPriorValue = roundMoney(dailyTotals.priorValue);
  const totalDailyPlPercent = totalDailyPriorValue > 0
    ? roundMoney((totalDailyPl / totalDailyPriorValue) * 100)
    : 0;
  const dailyPlLabel = totalDailyPriorValue > 0
    ? `${formatMoney(totalDailyPl, currency)} (${totalDailyPlPercent}%)`
    : formatMoney(totalDailyPl, currency);
  const dailyPlRange = aggregateDailyPlRangeFromHoldings(
    rows.map((holding) => ({
      shares: holding.shares,
      previousClose: holding.quote!.previousClose,
      dayLow: holding.quote!.dayLow,
      dayHigh: holding.quote!.dayHigh,
      currentPrice: holding.quote!.currentPrice
    }))
  );

  const cards: SummaryCard[] = [
    { label: "Total value", shortLabel: "Value", value: formatMoney(totalValue, currency), icon: WalletCards },
    { label: "Current P/L", shortLabel: "P/L", value: formatMoney(currentPl, currency), icon: totalValue >= totalCost ? TrendingUp : TrendingDown },
    { label: "Daily P/L", shortLabel: "Today", value: dailyPlLabel, icon: totalDailyPl >= 0 ? TrendingUp : TrendingDown, dailyRange: dailyPlRange },
    { label: "Highest risk", shortLabel: "Risk", value: highestRisk?.symbol || "N/A", icon: AlertTriangle },
    { label: "P/L if stops hit", shortLabel: "Stop P/L", value: formatMoney(roundMoney(stopValue - totalCost), currency), icon: AlertTriangle },
    { label: "Best target P/L", shortLabel: "Target P/L", value: formatMoney(roundMoney(targetValue - totalCost), currency), icon: TrendingUp },
    { label: "Biggest loss / gain", shortLabel: "L / G", value: `${sortedByPl[0]?.symbol || "N/A"} / ${sortedByPl.at(-1)?.symbol || "N/A"}`, icon: TrendingUp }
  ];

  const mobilePrimary = cards.slice(0, 4);

  return (
    <>
      <div className="grid grid-cols-2 gap-1.5 min-[420px]:grid-cols-4 md:hidden">
        {mobilePrimary.map(({ shortLabel, value, dailyRange: range }) => (
          <div className="min-w-0 rounded border border-mint/40 bg-surface-muted px-2 py-1.5" key={shortLabel}>
            <p className="text-[10px] uppercase text-ink/50">{shortLabel}</p>
            <p className="truncate text-xs font-semibold">{value}</p>
            {range && shortLabel === "Today" ? <DailyPlRangeBar range={range} currency={currency} variant="compact" /> : null}
          </div>
        ))}
      </div>
      <div className="hidden grid-cols-1 gap-3 min-[380px]:grid-cols-2 md:grid lg:grid-cols-4 xl:grid-cols-7">
        {cards.map(({ label, value, icon: Icon, dailyRange: range }) => (
          <div className="min-w-0 rounded-md border border-mint/50 bg-surface-muted p-3 sm:p-4" key={label}>
            <Icon className="mb-2 h-5 w-5 text-marine sm:mb-3" aria-hidden />
            <p className="text-xs uppercase text-ink/55">{label}</p>
            <p className="mt-1 break-words text-base font-semibold sm:text-lg">{value}</p>
            {range && label === "Daily P/L" ? (
              <DailyPlRangeBar range={range} currency={currency} />
            ) : null}
          </div>
        ))}
      </div>
    </>
  );
}
