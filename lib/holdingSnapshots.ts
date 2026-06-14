import type { CurrencyCode } from "./types";
import type { PortfolioReportHolding } from "./portfolioReport";
import { formatSessionLabel } from "./marketSession";

export type HoldingSnapshotEntry = {
  symbol: string;
  name: string;
  daily_profit_loss: number;
  daily_profit_loss_percent: number;
  shares: number;
  average_cost: number;
  current_value: number;
  profit_loss: number;
  /** False for legacy snapshots saved before cost-basis fields existed. */
  cost_basis_tracked?: boolean;
};

export type HoldingSnapshotDay = {
  snapshotDate: string;
  profileId: string;
  currency: CurrencyCode;
  holdings: HoldingSnapshotEntry[];
};

export type MoverHolding = {
  symbol: string;
  name: string;
  dailyProfitLoss: number;
  dailyProfitLossPercent: number;
  shares: number;
};

function combineDailyPercent(
  left: { daily_profit_loss: number; daily_profit_loss_percent: number },
  right: { daily_profit_loss: number; daily_profit_loss_percent: number }
) {
  const leftPrior = left.daily_profit_loss_percent !== 0
    ? left.daily_profit_loss / (left.daily_profit_loss_percent / 100)
    : 0;
  const rightPrior = right.daily_profit_loss_percent !== 0
    ? right.daily_profit_loss / (right.daily_profit_loss_percent / 100)
    : 0;
  const priorValue = leftPrior + rightPrior;
  const combinedDaily = left.daily_profit_loss + right.daily_profit_loss;
  return priorValue > 0 ? (combinedDaily / priorValue) * 100 : 0;
}

export function holdingsSnapshotFromReportRows(rows: PortfolioReportHolding[]): HoldingSnapshotEntry[] {
  return rows
    .filter((row) => row.currentPrice !== undefined)
    .map((row) => ({
      symbol: row.symbol,
      name: row.name,
      daily_profit_loss: row.dailyProfitLoss,
      daily_profit_loss_percent: row.dailyProfitLossPercent,
      shares: row.shares,
      average_cost: row.averageCost,
      current_value: row.currentValue,
      profit_loss: row.profitLoss,
      cost_basis_tracked: true
    }));
}

export function parseHoldingsSnapshot(value: unknown): HoldingSnapshotEntry[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    if (typeof row.symbol !== "string") return [];
    const daily = Number(row.daily_profit_loss);
    const dailyPercent = Number(row.daily_profit_loss_percent);
    const shares = Number(row.shares);
    const averageCost = Number(row.average_cost);
    const currentValue = Number(row.current_value);
    const profitLoss = Number(row.profit_loss);
    const costBasisTracked = "profit_loss" in row && "current_value" in row;
    return [{
      symbol: row.symbol,
      name: typeof row.name === "string" ? row.name : row.symbol,
      daily_profit_loss: Number.isFinite(daily) ? daily : 0,
      daily_profit_loss_percent: Number.isFinite(dailyPercent) ? dailyPercent : 0,
      shares: Number.isFinite(shares) ? shares : 0,
      average_cost: Number.isFinite(averageCost) ? averageCost : 0,
      current_value: Number.isFinite(currentValue) ? currentValue : 0,
      profit_loss: Number.isFinite(profitLoss) ? profitLoss : 0,
      cost_basis_tracked: costBasisTracked
    }];
  });
}

export function mergeHoldingSnapshotsForMovers(
  days: HoldingSnapshotDay[],
  filters: {
    currency: CurrencyCode;
    profileId: string;
    snapshotDate: string;
  }
): MoverHolding[] {
  const rows = days.filter((day) => (
    day.currency === filters.currency
    && day.snapshotDate === filters.snapshotDate
    && (filters.profileId === "all" || day.profileId === filters.profileId)
  ));

  const merged = new Map<string, MoverHolding>();
  rows.forEach((day) => {
    day.holdings.forEach((holding) => {
      const existing = merged.get(holding.symbol);
      if (existing) {
        merged.set(holding.symbol, {
          symbol: holding.symbol,
          name: holding.name,
          dailyProfitLoss: existing.dailyProfitLoss + holding.daily_profit_loss,
          dailyProfitLossPercent: combineDailyPercent(
            { daily_profit_loss: existing.dailyProfitLoss, daily_profit_loss_percent: existing.dailyProfitLossPercent },
            holding
          ),
          shares: existing.shares + holding.shares
        });
      } else {
        merged.set(holding.symbol, {
          symbol: holding.symbol,
          name: holding.name,
          dailyProfitLoss: holding.daily_profit_loss,
          dailyProfitLossPercent: holding.daily_profit_loss_percent,
          shares: holding.shares
        });
      }
    });
  });

  return [...merged.values()];
}

export function moverDateHasHoldings(
  days: HoldingSnapshotDay[],
  filters: { currency: CurrencyCode; profileId: string; snapshotDate: string }
) {
  return mergeHoldingSnapshotsForMovers(days, filters).length > 0;
}

export type MoverDateOption = {
  id: string;
  label: string;
  hasHoldings: boolean;
};

export function buildMoverDateOptions(
  snapshotDates: string[],
  holdingSnapshots: HoldingSnapshotDay[],
  filters: { currency: CurrencyCode; profileId: string },
  now = new Date()
): MoverDateOption[] {
  const historical = [...new Set(snapshotDates)].sort().map((snapshotDate) => ({
    id: snapshotDate,
    label: formatSessionLabel(snapshotDate, now),
    hasHoldings: moverDateHasHoldings(holdingSnapshots, { ...filters, snapshotDate })
  }));

  return [
    { id: "live", label: "Latest (live)", hasHoldings: true },
    ...historical
  ];
}
