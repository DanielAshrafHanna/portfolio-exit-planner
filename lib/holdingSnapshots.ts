import type { CurrencyCode } from "./types";
import type { PortfolioReportHolding } from "./portfolioReport";
import { formatSessionLabel } from "./marketSession";

export type HoldingSnapshotEntry = {
  symbol: string;
  name: string;
  daily_profit_loss: number;
  shares: number;
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
  shares: number;
};

export function holdingsSnapshotFromReportRows(rows: PortfolioReportHolding[]): HoldingSnapshotEntry[] {
  return rows
    .filter((row) => row.currentPrice !== undefined)
    .map((row) => ({
      symbol: row.symbol,
      name: row.name,
      daily_profit_loss: row.dailyProfitLoss,
      shares: row.shares
    }));
}

export function parseHoldingsSnapshot(value: unknown): HoldingSnapshotEntry[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    if (typeof row.symbol !== "string") return [];
    const daily = Number(row.daily_profit_loss);
    const shares = Number(row.shares);
    return [{
      symbol: row.symbol,
      name: typeof row.name === "string" ? row.name : row.symbol,
      daily_profit_loss: Number.isFinite(daily) ? daily : 0,
      shares: Number.isFinite(shares) ? shares : 0
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
          shares: existing.shares + holding.shares
        });
      } else {
        merged.set(holding.symbol, {
          symbol: holding.symbol,
          name: holding.name,
          dailyProfitLoss: holding.daily_profit_loss,
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
