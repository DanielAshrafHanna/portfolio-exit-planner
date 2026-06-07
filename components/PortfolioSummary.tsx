"use client";

import { AlertTriangle, TrendingDown, TrendingUp, WalletCards } from "lucide-react";
import type { CurrencyCode, EnrichedHolding, FeeSettings } from "@/lib/types";
import { calculateProfitLoss, calculateStopLosses, defaultSellTargets, roundMoney } from "@/lib/calculations";
import { formatMoney } from "@/lib/profileUtils";

type Props = { holdings: EnrichedHolding[]; settings: FeeSettings; currency: CurrencyCode };

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

  const cards = [
    { label: "Total value", value: formatMoney(totalValue, currency), icon: WalletCards },
    { label: "Current P/L", value: formatMoney(roundMoney(totalValue - totalCost), currency), icon: totalValue >= totalCost ? TrendingUp : TrendingDown },
    { label: "P/L if stops hit", value: formatMoney(roundMoney(stopValue - totalCost), currency), icon: AlertTriangle },
    { label: "Best target P/L", value: formatMoney(roundMoney(targetValue - totalCost), currency), icon: TrendingUp },
    { label: "Highest risk", value: highestRisk?.symbol || "N/A", icon: AlertTriangle },
    { label: "Biggest loss / gain", value: `${sortedByPl[0]?.symbol || "N/A"} / ${sortedByPl.at(-1)?.symbol || "N/A"}`, icon: TrendingUp }
  ];

  return (
    <section className="mx-auto grid max-w-7xl gap-3 px-4 py-5 sm:grid-cols-2 lg:grid-cols-6">
      {cards.map(({ label, value, icon: Icon }) => (
        <div className="border border-ink/10 bg-white p-4 shadow-soft" key={label}>
          <Icon className="mb-3 h-5 w-5 text-marine" aria-hidden />
          <p className="text-xs uppercase text-ink/55">{label}</p>
          <p className="mt-1 text-lg font-semibold">{value}</p>
        </div>
      ))}
    </section>
  );
}
