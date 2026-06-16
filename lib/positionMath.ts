import { calculatePartialSale, calculateProfitLoss, roundMoney, totalCostFor } from "./calculations";
import type { FeeSettings, HoldingInput } from "./types";

export const SHARE_EPSILON = 0.0001;

export function normalizeShares(shares: number) {
  return roundMoney(Math.max(0, shares));
}

export function normalizeAverageCost(averageCost: number) {
  return roundMoney(Math.max(0, averageCost));
}

/** Keep shares, averageCost, and totalCost consistent. */
export function reconcileHolding<T extends Pick<HoldingInput, "shares" | "averageCost" | "totalCost">>(
  holding: T
): T {
  const shares = normalizeShares(holding.shares);
  const averageCost = normalizeAverageCost(holding.averageCost);
  return {
    ...holding,
    shares,
    averageCost,
    totalCost: totalCostFor(shares, averageCost)
  };
}

export function sameHoldingSymbol(left?: string, right?: string) {
  return Boolean(left && right && left.trim().toUpperCase() === right.trim().toUpperCase());
}

/**
 * Weighted-average merge when buying more of an existing position.
 * buyPrice defaults to buyShares average cost when omitted.
 */
export function mergeBuyIntoHolding(
  existing: Pick<HoldingInput, "shares" | "averageCost" | "totalCost">,
  buyShares: number,
  buyPrice: number
) {
  const safeBuyShares = normalizeShares(buyShares);
  const safeBuyPrice = normalizeAverageCost(buyPrice);
  if (safeBuyShares <= 0) {
    return reconcileHolding(existing);
  }

  const oldShares = normalizeShares(existing.shares);
  const oldAvg = normalizeAverageCost(existing.averageCost);
  const newShares = roundMoney(oldShares + safeBuyShares);
  const newAvg = newShares > 0
    ? roundMoney(((oldShares * oldAvg) + (safeBuyShares * safeBuyPrice)) / newShares)
    : 0;

  return reconcileHolding({
    ...existing,
    shares: newShares,
    averageCost: newAvg,
    totalCost: totalCostFor(newShares, newAvg)
  });
}

export type ApplySaleResult = {
  holding: Pick<HoldingInput, "shares" | "averageCost" | "totalCost"> | null;
  soldShares: number;
  remainingShares: number;
  realizedProfitLoss: number;
  realizedProfitLossPercent: number;
  closed: boolean;
};

/** Apply a partial or full sale at average cost; returns null holding when position closes. */
export function applySaleToHolding(
  holding: Pick<HoldingInput, "shares" | "averageCost" | "totalCost">,
  sellPrice: number,
  sellPercent: number,
  settings: FeeSettings
): ApplySaleResult {
  const reconciled = reconcileHolding(holding);
  const partial = calculatePartialSale(
    { id: "", symbol: "", name: "", ...reconciled },
    sellPrice,
    sellPercent,
    settings
  );
  const remainingShares = normalizeShares(partial.remainingShares);
  const closed = remainingShares <= SHARE_EPSILON;

  if (closed) {
    return {
      holding: null,
      soldShares: partial.soldShares,
      remainingShares: 0,
      realizedProfitLoss: partial.realizedProfitLoss,
      realizedProfitLossPercent: partial.realizedProfitLossPercent,
      closed: true
    };
  }

  return {
    holding: reconcileHolding({
      ...reconciled,
      shares: remainingShares,
      averageCost: reconciled.averageCost,
      totalCost: totalCostFor(remainingShares, reconciled.averageCost)
    }),
    soldShares: partial.soldShares,
    remainingShares,
    realizedProfitLoss: partial.realizedProfitLoss,
    realizedProfitLossPercent: partial.realizedProfitLossPercent,
    closed: false
  };
}

/** Consolidate duplicate symbols into one weighted-average position. */
export function consolidateHoldingsBySymbol<T extends HoldingInput>(holdings: T[]): T[] {
  const merged = new Map<string, T>();

  holdings.forEach((holding) => {
    const symbol = holding.symbol.trim().toUpperCase();
    if (!symbol) return;
    const existing = merged.get(symbol);
    if (!existing) {
      merged.set(symbol, reconcileHolding({ ...holding, symbol }) as T);
      return;
    }

    const combined = mergeBuyIntoHolding(existing, holding.shares, holding.averageCost);
    merged.set(symbol, reconcileHolding({
      ...existing,
      ...holding,
      symbol,
      shares: combined.shares,
      averageCost: combined.averageCost,
      totalCost: combined.totalCost
    }) as T);
  });

  return [...merged.values()];
}

export function previewSaleRealized(
  holding: Pick<HoldingInput, "shares" | "averageCost" | "totalCost">,
  sellPrice: number,
  sellPercent: number,
  settings: FeeSettings
) {
  const partial = calculatePartialSale(
    { id: "", symbol: "", name: "", ...reconcileHolding(holding) },
    sellPrice,
    sellPercent,
    settings
  );
  const gross = calculateProfitLoss(partial.soldShares, holding.averageCost, sellPrice, settings);
  return {
    ...partial,
    grossProfitLoss: gross.profitLoss
  };
}
