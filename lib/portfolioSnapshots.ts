import type { SupabaseClient } from "@supabase/supabase-js";
import type { PortfolioReport } from "./portfolioReport";
import { parseHoldingsSnapshot, holdingsSnapshotFromReportRows } from "./holdingSnapshots";
import {
  applyCostBasisDailyPlToReport,
  lookbackSnapshotDate,
  pickPriorSnapshotsForProfiles
} from "./dailyPlDelta";
import { getDailyPlSessionInfo, isTradingWeekday } from "./marketSession";
import type { CurrencyCode, MarketRegion } from "./types";

export type PortfolioDailySnapshotRow = {
  user_id: string;
  snapshot_date: string;
  profile_id: string;
  currency: CurrencyCode;
  daily_profit_loss: number;
  daily_profit_loss_percent: number;
  portfolio_value: number;
  total_profit_loss: number;
  holdings_count: number;
  holdings_snapshot: ReturnType<typeof holdingsSnapshotFromReportRows>;
};

const REGION_TIMEZONES: Record<MarketRegion, string> = {
  US: "America/New_York",
  EG: "Africa/Cairo"
};

export function snapshotDateForRegion(now: Date, region: MarketRegion) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: REGION_TIMEZONES[region],
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(now);
  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

export async function fetchPriorSnapshotsForReport(
  supabase: SupabaseClient,
  userId: string,
  report: PortfolioReport,
  now = new Date(report.generatedAt)
) {
  const targets = report.profiles.map((profile) => ({
    profileId: profile.id,
    sessionDate: getDailyPlSessionInfo(profile.region, now).sessionDate
  }));
  const earliestSessionDate = targets.reduce(
    (earliest, target) => (target.sessionDate < earliest ? target.sessionDate : earliest),
    targets[0]?.sessionDate || snapshotDateForRegion(now, "US")
  );
  const startDate = lookbackSnapshotDate(earliestSessionDate);

  const { data, error } = await supabase
    .from("portfolio_daily_snapshots")
    .select("snapshot_date, profile_id, total_profit_loss, portfolio_value, holdings_snapshot")
    .eq("user_id", userId)
    .gte("snapshot_date", startDate)
    .order("snapshot_date", { ascending: false });

  if (error || !data?.length) {
    return new Map();
  }

  return pickPriorSnapshotsForProfiles(data, targets, parseHoldingsSnapshot);
}

export async function prepareReportForSnapshot(
  supabase: SupabaseClient,
  userId: string,
  report: PortfolioReport,
  now = new Date(report.generatedAt)
) {
  const priorByProfileId = await fetchPriorSnapshotsForReport(supabase, userId, report, now);
  return applyCostBasisDailyPlToReport(report, priorByProfileId);
}

export function snapshotsFromReport(userId: string, report: PortfolioReport, now = new Date(report.generatedAt)): PortfolioDailySnapshotRow[] {
  return report.profiles.map((profile) => {
    const session = getDailyPlSessionInfo(profile.region, now);
    const tradingToday = isTradingWeekday(profile.region, now);
    // On weekends/non-trading days, quote "daily" P/L is not a real session move — store 0.
    // Key snapshots by the active trading session date, not the calendar weekend date.
    return {
      user_id: userId,
      snapshot_date: session.sessionDate,
      profile_id: profile.id,
      currency: profile.currency,
      daily_profit_loss: tradingToday ? profile.totals.dailyProfitLoss : 0,
      daily_profit_loss_percent: tradingToday ? profile.totals.dailyProfitLossPercent : 0,
      portfolio_value: profile.totals.currentValue,
      total_profit_loss: profile.totals.profitLoss,
      holdings_count: profile.totals.quotedHoldingsCount,
      holdings_snapshot: holdingsSnapshotFromReportRows(profile.holdings)
    };
  });
}

export async function upsertPortfolioSnapshots(
  supabase: SupabaseClient,
  rows: PortfolioDailySnapshotRow[]
): Promise<{ warning?: string }> {
  if (!rows.length) return {};

  const { error } = await supabase
    .from("portfolio_daily_snapshots")
    .upsert(rows, { onConflict: "user_id,snapshot_date,profile_id" });

  if (!error) return {};

  if (isMissingHoldingsSnapshotColumn(error.message)) {
    const legacyRows = rows.map(({ holdings_snapshot: _holdings, ...rest }) => rest);
    const retry = await supabase
      .from("portfolio_daily_snapshots")
      .upsert(legacyRows, { onConflict: "user_id,snapshot_date,profile_id" });
    if (!retry.error) {
      return {
        warning: "Holdings mover history needs the updated Supabase schema. Run the latest SQL, then reload the schema cache."
      };
    }
    return { warning: `Portfolio history failed to save: ${retry.error.message}` };
  }

  if (isMissingSnapshotsTableError(error.message)) {
    return {
      warning: "Portfolio history is not active yet. Run the updated Supabase SQL, then reload the schema cache."
    };
  }

  return { warning: `Portfolio history failed to save: ${error.message}` };
}

function isMissingSnapshotsTableError(message: string) {
  const normalized = message.toLowerCase();
  return normalized.includes("portfolio_daily_snapshots")
    || normalized.includes("schema cache")
    || normalized.includes("could not find the table");
}

function isMissingHoldingsSnapshotColumn(message: string) {
  const normalized = message.toLowerCase();
  return normalized.includes("holdings_snapshot");
}
