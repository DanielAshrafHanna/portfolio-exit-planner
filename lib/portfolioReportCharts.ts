import type { CurrencyCode, MarketRegion } from "./types";
import { chartAxisDateLabel, isTradingWeekday, marketDateString, regionFromCurrency } from "./marketSession";

export type SnapshotHistoryRow = {
  snapshot_date: string;
  profile_id: string;
  profile_name?: string;
  currency: CurrencyCode;
  daily_profit_loss: number;
  daily_profit_loss_percent: number;
  portfolio_value: number;
  total_profit_loss: number;
  holdings_count: number;
};

export type WeeklyChartPoint = {
  date: string;
  snapshotDate: string;
  dailyProfitLoss: number;
  dailyProfitLossPercent: number;
  portfolioValue: number;
  totalProfitLoss: number;
  hasData: boolean;
  /** True when this calendar day had a trading session and daily P/L should be plotted. */
  hasPlData: boolean;
  marketClosed: boolean;
};

export type WeeklyChartSeries = {
  currency: CurrencyCode;
  region: MarketRegion;
  profileId: string;
  profileName?: string;
  points: WeeklyChartPoint[];
};

/**
 * Builds the rolling window of snapshot date keys for a market region.
 * The anchor is the region's *local* market date (NY for US, Cairo for EG), so the
 * window aligns with how snapshots are keyed in `snapshotDateForRegion`. Using a UTC
 * anchor here would misalign buckets near midnight and drop or fabricate days.
 */
export function rollingSnapshotDates(days: number, region: MarketRegion, now = new Date()) {
  const anchorKey = marketDateString(region, now);
  const anchor = new Date(`${anchorKey}T12:00:00.000Z`);
  const dates: string[] = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(anchor);
    date.setUTCDate(date.getUTCDate() - offset);
    dates.push(formatIsoDate(date));
  }
  return dates;
}

export function buildWeeklySeries(
  snapshots: SnapshotHistoryRow[],
  options: {
    days?: number;
    profileId?: string;
    now?: Date;
  } = {}
): WeeklyChartSeries[] {
  const days = options.days ?? 7;
  const profileId = options.profileId ?? "all";
  const now = options.now ?? new Date();
  const filtered = profileId === "all"
    ? snapshots
    : snapshots.filter((row) => row.profile_id === profileId);

  const grouped = new Map<string, SnapshotHistoryRow[]>();
  filtered.forEach((row) => {
    const key = `${row.profile_id}:${row.currency}`;
    const existing = grouped.get(key) || [];
    existing.push(row);
    grouped.set(key, existing);
  });

  if (!grouped.size && profileId !== "all") {
    const currency = filtered[0]?.currency || "USD";
    const region = regionFromCurrency(currency);
    return [{
      currency,
      region,
      profileId,
      profileName: filtered[0]?.profile_name,
      points: emptyWeeklyPoints(rollingSnapshotDates(days, region, now), region, now)
    }];
  }

  return [...grouped.entries()].map(([key, rows]) => {
    const [id, currency] = key.split(":");
    const region = regionFromCurrency(currency as CurrencyCode);
    const windowDates = rollingSnapshotDates(days, region, now);
    const byDate = new Map(rows.map((row) => [row.snapshot_date, row]));
    return {
      currency: currency as CurrencyCode,
      region,
      profileId: id,
      profileName: rows[0]?.profile_name,
      points: windowDates.map((snapshotDate) => {
        const row = byDate.get(snapshotDate);
        const marketClosed = !isTradingWeekday(region, snapshotDate);
        const date = chartAxisDateLabel(snapshotDate, now);
        if (!row) {
          return {
            date,
            snapshotDate,
            dailyProfitLoss: 0,
            dailyProfitLossPercent: 0,
            portfolioValue: 0,
            totalProfitLoss: 0,
            hasData: false,
            hasPlData: false,
            marketClosed
          };
        }
        const hasData = true;
        const hasPlData = !marketClosed;
        return {
          date,
          snapshotDate,
          dailyProfitLoss: Number(row.daily_profit_loss),
          dailyProfitLossPercent: Number(row.daily_profit_loss_percent),
          portfolioValue: Number(row.portfolio_value),
          totalProfitLoss: Number(row.total_profit_loss),
          hasData,
          hasPlData,
          marketClosed
        };
      })
    };
  }).sort((a, b) => a.currency.localeCompare(b.currency));
}

export function buildCumulativePoints(points: WeeklyChartPoint[]) {
  let running = 0;
  return points.map((point) => {
    if (point.hasPlData) running += point.dailyProfitLoss;
    return {
      ...point,
      cumulativeProfitLoss: point.hasPlData ? running : running
    };
  });
}

export type MoverRankMode = "dollar" | "percent";

export function moverSortValue(
  holding: { dailyProfitLoss: number; dailyProfitLossPercent?: number },
  rankBy: MoverRankMode
) {
  return rankBy === "percent" ? (holding.dailyProfitLossPercent ?? 0) : holding.dailyProfitLoss;
}

export function topHoldingMovers<T extends { symbol: string; name: string; dailyProfitLoss: number; dailyProfitLossPercent?: number }>(
  holdings: T[],
  options: { limit?: number; rankBy?: MoverRankMode } = {}
): T[] {
  const limit = options.limit ?? 5;
  const rankBy = options.rankBy ?? "dollar";
  const sorted = [...holdings].sort((a, b) => moverSortValue(b, rankBy) - moverSortValue(a, rankBy));
  const gainers = sorted.filter((holding) => moverSortValue(holding, rankBy) > 0).slice(0, limit);
  const losers = [...sorted].filter((holding) => moverSortValue(holding, rankBy) < 0).slice(-limit).reverse();
  return [...losers, ...gainers];
}

function emptyWeeklyPoints(windowDates: string[], region: MarketRegion, now: Date): WeeklyChartPoint[] {
  return windowDates.map((snapshotDate) => {
    const marketClosed = !isTradingWeekday(region, snapshotDate);
    return {
      date: chartAxisDateLabel(snapshotDate, now),
      snapshotDate,
      dailyProfitLoss: 0,
      dailyProfitLossPercent: 0,
      portfolioValue: 0,
      totalProfitLoss: 0,
      hasData: false,
      hasPlData: false,
      marketClosed
    };
  });
}

function formatIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}
