import type { CurrencyCode } from "./types";

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
};

export type WeeklyChartSeries = {
  currency: CurrencyCode;
  profileId: string;
  profileName?: string;
  points: WeeklyChartPoint[];
};

export function rollingSnapshotDates(days: number, now = new Date()) {
  const dates: string[] = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(now);
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
  const windowDates = rollingSnapshotDates(days, now);
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
    const currency = filtered[0]?.currency;
    return [{
      currency: currency || "USD",
      profileId,
      profileName: filtered[0]?.profile_name,
      points: emptyWeeklyPoints(windowDates, now)
    }];
  }

  return [...grouped.entries()].map(([key, rows]) => {
    const [id, currency] = key.split(":");
    const byDate = new Map(rows.map((row) => [row.snapshot_date, row]));
    return {
      currency: currency as CurrencyCode,
      profileId: id,
      profileName: rows[0]?.profile_name,
      points: windowDates.map((snapshotDate) => {
        const row = byDate.get(snapshotDate);
        if (!row) {
          return {
            date: formatChartLabel(snapshotDate, now),
            snapshotDate,
            dailyProfitLoss: 0,
            dailyProfitLossPercent: 0,
            portfolioValue: 0,
            totalProfitLoss: 0,
            hasData: false
          };
        }
        return {
          date: formatChartLabel(snapshotDate, now),
          snapshotDate,
          dailyProfitLoss: Number(row.daily_profit_loss),
          dailyProfitLossPercent: Number(row.daily_profit_loss_percent),
          portfolioValue: Number(row.portfolio_value),
          totalProfitLoss: Number(row.total_profit_loss),
          hasData: true
        };
      })
    };
  }).sort((a, b) => a.currency.localeCompare(b.currency));
}

export function buildCumulativePoints(points: WeeklyChartPoint[]) {
  let running = 0;
  return points.map((point) => {
    if (point.hasData) running += point.dailyProfitLoss;
    return {
      ...point,
      cumulativeProfitLoss: point.hasData ? running : running
    };
  });
}

export function topHoldingMovers<T extends { symbol: string; name: string; dailyProfitLoss: number }>(
  holdings: T[],
  limit = 5
) {
  const sorted = [...holdings].sort((a, b) => b.dailyProfitLoss - a.dailyProfitLoss);
  const gainers = sorted.filter((holding) => holding.dailyProfitLoss > 0).slice(0, limit);
  const losers = [...sorted].filter((holding) => holding.dailyProfitLoss < 0).slice(-limit).reverse();
  return [...losers, ...gainers].map((holding) => ({
    symbol: holding.symbol,
    name: holding.name,
    dailyProfitLoss: holding.dailyProfitLoss
  }));
}

function emptyWeeklyPoints(windowDates: string[], now: Date): WeeklyChartPoint[] {
  return windowDates.map((snapshotDate) => ({
    date: formatChartLabel(snapshotDate, now),
    snapshotDate,
    dailyProfitLoss: 0,
    dailyProfitLossPercent: 0,
    portfolioValue: 0,
    totalProfitLoss: 0,
    hasData: false
  }));
}

function formatIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatChartLabel(snapshotDate: string, now: Date) {
  const currentYear = now.getUTCFullYear();
  const dateYear = Number(snapshotDate.slice(0, 4));
  return new Date(`${snapshotDate}T12:00:00.000Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(dateYear === currentYear ? {} : { year: "numeric" })
  });
}
