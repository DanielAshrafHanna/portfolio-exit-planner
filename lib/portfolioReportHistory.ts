import type { SupabaseClient } from "@supabase/supabase-js";
import { cloudSettingsFromRow, profilesFromCloudPortfolioRow, type CloudPortfolioRow } from "./cloudPortfolio";
import { parseHoldingsSnapshot } from "./holdingSnapshots";
import { buildWeeklySeries, rollingSnapshotDates, type WeeklyChartSeries } from "./portfolioReportCharts";
import type { CurrencyCode } from "./types";

type SnapshotRow = {
  snapshot_date: string;
  profile_id: string;
  currency: CurrencyCode;
  daily_profit_loss: number;
  daily_profit_loss_percent: number;
  portfolio_value: number;
  total_profit_loss: number;
  holdings_count: number;
};

export async function fetchUserWeeklyChartSeries(
  supabase: SupabaseClient,
  userId: string,
  portfolioRow: CloudPortfolioRow,
  options: { days?: number; now?: Date } = {}
): Promise<WeeklyChartSeries[]> {
  const days = options.days ?? 7;
  const now = options.now ?? new Date();
  const usStart = rollingSnapshotDates(days, "US", now)[0];
  const egStart = rollingSnapshotDates(days, "EG", now)[0];
  const earliest = usStart < egStart ? usStart : egStart;
  const buffered = new Date(`${earliest}T12:00:00.000Z`);
  buffered.setUTCDate(buffered.getUTCDate() - 1);
  const startDate = buffered.toISOString().slice(0, 10);

  const snapshotResult = await supabase
    .from("portfolio_daily_snapshots")
    .select("snapshot_date, profile_id, currency, daily_profit_loss, daily_profit_loss_percent, portfolio_value, total_profit_loss, holdings_count, holdings_snapshot")
    .eq("user_id", userId)
    .gte("snapshot_date", startDate)
    .order("snapshot_date", { ascending: true });

  let data = snapshotResult.data as Array<Record<string, unknown>> | null;
  let error = snapshotResult.error;
  if (error && isMissingHoldingsSnapshotColumn(error.message)) {
    const fallback = await supabase
      .from("portfolio_daily_snapshots")
      .select("snapshot_date, profile_id, currency, daily_profit_loss, daily_profit_loss_percent, portfolio_value, total_profit_loss, holdings_count")
      .eq("user_id", userId)
      .gte("snapshot_date", startDate)
      .order("snapshot_date", { ascending: true });
    data = fallback.data as Array<Record<string, unknown>> | null;
    error = fallback.error;
  }

  if (error || !data?.length) return [];

  const profileNames = new Map(
    profilesFromCloudPortfolioRow(portfolioRow)
      .map((profile) => [profile.id, profile.name] as const)
  );

  const snapshots: SnapshotRow[] = data.map((row) => ({
    snapshot_date: String(row.snapshot_date),
    profile_id: String(row.profile_id),
    currency: row.currency as CurrencyCode,
    daily_profit_loss: Number(row.daily_profit_loss),
    daily_profit_loss_percent: Number(row.daily_profit_loss_percent),
    portfolio_value: Number(row.portfolio_value),
    total_profit_loss: Number(row.total_profit_loss),
    holdings_count: Number(row.holdings_count)
  }));

  return buildWeeklySeries(
    snapshots.map((row) => ({
      ...row,
      profile_name: profileNames.get(row.profile_id)
    })),
    { days, profileId: "all", now }
  );
}

export function holdingsSnapshotRowsFromQuery(data: Array<Record<string, unknown>>) {
  return data.map((row) => ({
    snapshotDate: String(row.snapshot_date),
    profileId: String(row.profile_id),
    currency: row.currency as CurrencyCode,
    holdings: parseHoldingsSnapshot("holdings_snapshot" in row ? row.holdings_snapshot : [])
  }));
}

export function cloudSettingsForPortfolioRow(row: CloudPortfolioRow) {
  return cloudSettingsFromRow(row);
}

function isMissingHoldingsSnapshotColumn(message: string) {
  const normalized = message.toLowerCase();
  return normalized.includes("holdings_snapshot") || normalized.includes("column");
}
