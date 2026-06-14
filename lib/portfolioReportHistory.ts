import type { SupabaseClient } from "@supabase/supabase-js";
import { cloudSettingsFromRow, profilesFromCloudPortfolioRow, type CloudPortfolioRow } from "./cloudPortfolio";
import { parseHoldingsSnapshot } from "./holdingSnapshots";
import { buildWeeklySeries, rollingSnapshotDates, type SnapshotHistoryRow, type WeeklyChartSeries } from "./portfolioReportCharts";
import type { PortfolioReport } from "./portfolioReport";
import { snapshotsFromReport } from "./portfolioSnapshots";
import type { CurrencyCode } from "./types";

export async function fetchUserWeeklyChartSeries(
  supabase: SupabaseClient,
  userId: string,
  portfolioRow: CloudPortfolioRow,
  options: {
    days?: number;
    now?: Date;
    /** Rows from the snapshot just written in the same cron run — merged over DB history. */
    freshSnapshots?: SnapshotHistoryRow[];
  } = {}
): Promise<WeeklyChartSeries[]> {
  const days = options.days ?? 7;
  const now = options.now ?? new Date();
  const profileNames = new Map(
    profilesFromCloudPortfolioRow(portfolioRow)
      .map((profile) => [profile.id, profile.name] as const)
  );
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

  if (error || !data?.length) {
    return buildWeeklySeriesFromSnapshots(options.freshSnapshots || [], { days, profileId: "all", now });
  }

  const snapshots = mergeSnapshotHistoryRows(
    data.map((row) => snapshotHistoryRowFromQuery(row, profileNames)),
    options.freshSnapshots || []
  );

  return buildWeeklySeries(snapshots, { days, profileId: "all", now });
}

export function snapshotHistoryRowsFromReport(
  userId: string,
  report: PortfolioReport,
  profileNames: Map<string, string | undefined>,
  now = new Date(report.generatedAt)
): SnapshotHistoryRow[] {
  return snapshotsFromReport(userId, report, now).map((row) => ({
    snapshot_date: row.snapshot_date,
    profile_id: row.profile_id,
    profile_name: profileNames.get(row.profile_id),
    currency: row.currency,
    daily_profit_loss: row.daily_profit_loss,
    daily_profit_loss_percent: row.daily_profit_loss_percent,
    portfolio_value: row.portfolio_value,
    total_profit_loss: row.total_profit_loss,
    holdings_count: row.holdings_count
  }));
}

export function mergeSnapshotHistoryRows(
  stored: SnapshotHistoryRow[],
  fresh: SnapshotHistoryRow[]
): SnapshotHistoryRow[] {
  const byKey = new Map<string, SnapshotHistoryRow>();
  stored.forEach((row) => byKey.set(snapshotHistoryKey(row), row));
  fresh.forEach((row) => byKey.set(snapshotHistoryKey(row), row));
  return [...byKey.values()].sort((left, right) => left.snapshot_date.localeCompare(right.snapshot_date));
}

function buildWeeklySeriesFromSnapshots(
  snapshots: SnapshotHistoryRow[],
  options: { days?: number; profileId?: string; now?: Date } = {}
) {
  if (!snapshots.length) return [];
  return buildWeeklySeries(snapshots, options);
}

function snapshotHistoryKey(row: Pick<SnapshotHistoryRow, "profile_id" | "snapshot_date">) {
  return `${row.profile_id}:${row.snapshot_date}`;
}

function snapshotHistoryRowFromQuery(
  row: Record<string, unknown>,
  profileNames: Map<string, string | undefined>
): SnapshotHistoryRow {
  const profileId = String(row.profile_id);
  return {
    snapshot_date: String(row.snapshot_date),
    profile_id: profileId,
    profile_name: profileNames.get(profileId),
    currency: row.currency as CurrencyCode,
    daily_profit_loss: Number(row.daily_profit_loss),
    daily_profit_loss_percent: Number(row.daily_profit_loss_percent),
    portfolio_value: Number(row.portfolio_value),
    total_profit_loss: Number(row.total_profit_loss),
    holdings_count: Number(row.holdings_count)
  };
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
