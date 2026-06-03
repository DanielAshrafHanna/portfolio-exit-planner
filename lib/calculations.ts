import type { FeeSettings, HoldingInput, MarketQuote } from "./types";

export type StopStyle = "tight" | "balanced" | "loose";

export const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export function totalCostFor(shares: number, averageCost: number) {
  return roundMoney(Math.max(0, shares) * Math.max(0, averageCost));
}

export function calculateFees(grossValue: number, settings: FeeSettings) {
  const percentFees = grossValue * ((settings.percentTradingFee + settings.fxFeePercent) / 100);
  return roundMoney(Math.max(0, settings.fixedTradingFee) + Math.max(0, percentFees));
}

export function calculatePositionValue(shares: number, price: number) {
  return roundMoney(Math.max(0, shares) * Math.max(0, price));
}

export function calculateProfitLoss(shares: number, averageCost: number, price: number, settings?: FeeSettings) {
  const grossValue = calculatePositionValue(shares, price);
  const cost = totalCostFor(shares, averageCost);
  const fees = settings ? calculateFees(grossValue, settings) : 0;
  const netValue = roundMoney(grossValue - fees);
  const profitLoss = roundMoney(netValue - cost);
  return {
    grossValue,
    netValue,
    cost,
    fees,
    profitLoss,
    profitLossPercent: cost > 0 ? roundMoney((profitLoss / cost) * 100) : 0
  };
}

export function calculateStopLosses(holding: HoldingInput, quote: MarketQuote) {
  const current = quote.currentPrice;
  const currentPl = calculateProfitLoss(holding.shares, holding.averageCost, current).profitLoss;
  const atrStops = quote.atr && quote.atr > 0
    ? {
        tight: current - 1.5 * quote.atr,
        balanced: current - 2.5 * quote.atr,
        loose: current - 3.5 * quote.atr
      }
    : {
        tight: current * 0.94,
        balanced: current * 0.9,
        loose: current * 0.82
      };

  const profitFloor = holding.averageCost + Math.max(0, current - holding.averageCost) * 0.25;
  const protectiveBalanced = currentPl > 0 ? Math.min(current * 0.97, Math.max(atrStops.balanced, profitFloor)) : atrStops.balanced;

  return {
    tight: {
      price: roundMoney(Math.max(0.01, currentPl > 0 ? Math.max(atrStops.tight, profitFloor) : atrStops.tight)),
      explanation: quote.atr
        ? "Uses 1.5x ATR below current price, adjusted to protect part of an open gain when reasonable."
        : "Uses roughly 6% below current price because ATR is unavailable, adjusted for profit protection when reasonable."
    },
    balanced: {
      price: roundMoney(Math.max(0.01, protectiveBalanced)),
      explanation: quote.atr
        ? "Uses 2.5x ATR below current price as the default risk-control level, with profit protection when reasonable."
        : "Uses roughly 10% below current price because ATR is unavailable, with profit protection when reasonable."
    },
    loose: {
      price: roundMoney(Math.max(0.01, currentPl > 0 ? Math.max(atrStops.loose, holding.averageCost * 0.98) : atrStops.loose)),
      explanation: quote.atr
        ? "Uses 3.5x ATR below current price to allow longer-term volatility while limiting further downside."
        : "Uses roughly 18% below current price because ATR is unavailable to allow wider long-term movement."
    }
  };
}

export function defaultSellTargets(currentPrice: number, aiTarget?: number) {
  return [
    { label: "Target 1", price: roundMoney(currentPrice * 1.05) },
    { label: "Target 2", price: roundMoney(currentPrice * 1.1) },
    { label: "Target 3", price: roundMoney(currentPrice * 1.15) },
    { label: "AI target", price: roundMoney(aiTarget && aiTarget > 0 ? aiTarget : currentPrice * 1.08) }
  ];
}

export function calculatePartialSale(holding: HoldingInput, sellPrice: number, sellPercent: number, settings: FeeSettings) {
  const percent = Math.min(100, Math.max(0, sellPercent));
  const soldShares = roundMoney(holding.shares * (percent / 100));
  const remainingShares = roundMoney(holding.shares - soldShares);
  const realized = calculateProfitLoss(soldShares, holding.averageCost, sellPrice, settings);
  const remainingValue = calculatePositionValue(remainingShares, sellPrice);
  const remainingCost = totalCostFor(remainingShares, holding.averageCost);
  return {
    soldShares,
    remainingShares,
    realizedProfitLoss: realized.profitLoss,
    realizedProfitLossPercent: realized.profitLossPercent,
    remainingValue,
    remainingUnrealizedProfitLoss: roundMoney(remainingValue - remainingCost)
  };
}

