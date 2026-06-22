import { calculateDailyProfitLoss, calculateProfitLoss, calculateStopLosses, defaultSellTargets } from "@/lib/calculations";
import { computeDailyPlRange, type DailyPlRange } from "@/lib/dailyPlRange";
import type { EnrichedHolding, FeeSettings } from "@/lib/types";

export type HoldingRowMetrics = {
  current?: ReturnType<typeof calculateProfitLoss>;
  daily?: ReturnType<typeof calculateDailyProfitLoss>;
  dailyRange?: DailyPlRange;
  stopPrice?: number;
  stopPl?: ReturnType<typeof calculateProfitLoss>;
  targetPrice?: number;
  targetPl?: ReturnType<typeof calculateProfitLoss>;
};

export function computeHoldingRowMetrics(holding: EnrichedHolding, settings: FeeSettings): HoldingRowMetrics {
  const quote = holding.quote;
  if (!quote) return {};

  const current = calculateProfitLoss(holding.shares, holding.averageCost, quote.currentPrice, settings);
  const daily = calculateDailyProfitLoss(holding.shares, quote.currentPrice, quote.previousClose);
  const dailyRange = computeDailyPlRange({
    shares: holding.shares,
    previousClose: quote.previousClose,
    dayLow: quote.dayLow,
    dayHigh: quote.dayHigh,
    currentPrice: quote.currentPrice
  });
  const stops = calculateStopLosses(holding, quote);
  const stopPrice = stops[holding.selectedStopStyle].price;
  const stopPl = calculateProfitLoss(holding.shares, holding.averageCost, stopPrice, settings);
  const targetPrice = holding.selectedTargetPrice
    || defaultSellTargets(quote.currentPrice, holding.analysis?.suggestedActionPlan.suggestedTakeProfit)[1].price;
  const targetPl = calculateProfitLoss(holding.shares, holding.averageCost, targetPrice, settings);

  return { current, daily, dailyRange, stopPrice, stopPl, targetPrice, targetPl };
}

export function profitLossTone(value?: number) {
  if (value === undefined) return "neutral" as const;
  return value < 0 ? "loss" as const : "gain" as const;
}

export function badgeTone(value?: string) {
  if (value === "Sell" || value === "Very High") return "danger" as const;
  if (value === "Trim" || value === "High") return "warning" as const;
  return "neutral" as const;
}
