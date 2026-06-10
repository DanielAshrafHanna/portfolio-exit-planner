import { computeHoldingRowMetrics } from "@/lib/holdingDisplay";
import type { Action, Confidence, EnrichedHolding, FeeSettings, RiskLevel } from "@/lib/types";

export type HoldingSortKey =
  | "symbol"
  | "name"
  | "shares"
  | "averageCost"
  | "currentPrice"
  | "currentValue"
  | "currentProfitLoss"
  | "currentProfitLossPercent"
  | "dailyProfitLoss"
  | "dailyProfitLossPercent"
  | "action"
  | "confidence"
  | "stopPrice"
  | "stopProfitLoss"
  | "targetPrice"
  | "targetProfitLoss"
  | "risk";

export type SortDirection = "asc" | "desc";

export type HoldingSortOption = {
  key: HoldingSortKey;
  label: string;
  mobile?: boolean;
  desktop?: boolean;
};

export const HOLDING_SORT_OPTIONS: HoldingSortOption[] = [
  { key: "symbol", label: "Symbol", mobile: true, desktop: true },
  { key: "name", label: "Company", desktop: true },
  { key: "shares", label: "Shares", desktop: true },
  { key: "averageCost", label: "Avg cost", desktop: true },
  { key: "currentPrice", label: "Current price", mobile: true, desktop: true },
  { key: "currentValue", label: "Current value", mobile: true, desktop: true },
  { key: "currentProfitLoss", label: "Current P/L ($)", mobile: true, desktop: true },
  { key: "currentProfitLossPercent", label: "Current P/L (%)", desktop: true },
  { key: "dailyProfitLoss", label: "Daily P/L ($)", mobile: true, desktop: true },
  { key: "dailyProfitLossPercent", label: "Daily P/L (%)", desktop: true },
  { key: "action", label: "AI action", mobile: true, desktop: true },
  { key: "confidence", label: "Confidence", desktop: true },
  { key: "stopPrice", label: "Stop price", mobile: true, desktop: true },
  { key: "stopProfitLoss", label: "P/L if stop hits", desktop: true },
  { key: "targetPrice", label: "Target price", mobile: true, desktop: true },
  { key: "targetProfitLoss", label: "P/L at target", desktop: true },
  { key: "risk", label: "Risk", desktop: true }
];

const ACTION_ORDER: Record<Action, number> = { Keep: 0, Watch: 1, Trim: 2, Sell: 3 };
const CONFIDENCE_ORDER: Record<Confidence, number> = { Low: 0, Medium: 1, High: 2 };
const RISK_ORDER: Record<RiskLevel, number> = { Low: 0, Medium: 1, High: 2, "Very High": 3 };

function compareNullableNumbers(a: number | undefined, b: number | undefined) {
  if (a === undefined && b === undefined) return 0;
  if (a === undefined) return 1;
  if (b === undefined) return -1;
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

function compareNullableStrings(a: string | undefined, b: string | undefined) {
  const left = (a || "").trim().toLowerCase();
  const right = (b || "").trim().toLowerCase();
  if (!left && !right) return 0;
  if (!left) return 1;
  if (!right) return -1;
  return left.localeCompare(right);
}

function compareEnum<T extends string>(a: T | undefined, b: T | undefined, order: Record<T, number>) {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return order[a] - order[b];
}

function sortValue(holding: EnrichedHolding, settings: FeeSettings, key: HoldingSortKey) {
  const metrics = computeHoldingRowMetrics(holding, settings);
  switch (key) {
    case "symbol":
      return holding.symbol;
    case "name":
      return holding.name;
    case "shares":
      return holding.shares;
    case "averageCost":
      return holding.averageCost;
    case "currentPrice":
      return holding.quote?.currentPrice;
    case "currentValue":
      return metrics.current?.grossValue;
    case "currentProfitLoss":
      return metrics.current?.profitLoss;
    case "currentProfitLossPercent":
      return metrics.current?.profitLossPercent;
    case "dailyProfitLoss":
      return metrics.daily?.profitLoss;
    case "dailyProfitLossPercent":
      return metrics.daily?.profitLossPercent;
    case "action":
      return holding.analysis?.action;
    case "confidence":
      return holding.analysis?.confidence;
    case "stopPrice":
      return metrics.stopPrice;
    case "stopProfitLoss":
      return metrics.stopPl?.profitLoss;
    case "targetPrice":
      return metrics.targetPrice;
    case "targetProfitLoss":
      return metrics.targetPl?.profitLoss;
    case "risk":
      return holding.analysis?.riskLevel;
    default:
      return undefined;
  }
}

function compareHoldings(
  left: EnrichedHolding,
  right: EnrichedHolding,
  settings: FeeSettings,
  key: HoldingSortKey
) {
  switch (key) {
    case "symbol":
    case "name":
      return compareNullableStrings(
        sortValue(left, settings, key) as string | undefined,
        sortValue(right, settings, key) as string | undefined
      );
    case "action":
      return compareEnum(
        sortValue(left, settings, key) as Action | undefined,
        sortValue(right, settings, key) as Action | undefined,
        ACTION_ORDER
      );
    case "confidence":
      return compareEnum(
        sortValue(left, settings, key) as Confidence | undefined,
        sortValue(right, settings, key) as Confidence | undefined,
        CONFIDENCE_ORDER
      );
    case "risk":
      return compareEnum(
        sortValue(left, settings, key) as RiskLevel | undefined,
        sortValue(right, settings, key) as RiskLevel | undefined,
        RISK_ORDER
      );
    default:
      return compareNullableNumbers(
        sortValue(left, settings, key) as number | undefined,
        sortValue(right, settings, key) as number | undefined
      );
  }
}

export function sortHoldings(
  holdings: EnrichedHolding[],
  settings: FeeSettings,
  sortKey: HoldingSortKey,
  direction: SortDirection
) {
  const factor = direction === "asc" ? 1 : -1;
  return [...holdings].sort((left, right) => {
    const primary = compareHoldings(left, right, settings, sortKey);
    if (primary !== 0) return primary * factor;
    return compareNullableStrings(left.symbol, right.symbol) * factor;
  });
}

export function nextSortState(
  currentKey: HoldingSortKey,
  currentDirection: SortDirection,
  clickedKey: HoldingSortKey
): { sortKey: HoldingSortKey; sortDirection: SortDirection } {
  if (currentKey === clickedKey) {
    return { sortKey: clickedKey, sortDirection: currentDirection === "asc" ? "desc" : "asc" };
  }
  return { sortKey: clickedKey, sortDirection: "asc" };
}
