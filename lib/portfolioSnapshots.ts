import type { SupabaseClient } from "@supabase/supabase-js";
import type { PortfolioReport } from "./portfolioReport";
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

export function snapshotsFromReport(userId: string, report: PortfolioReport, now = new Date(report.generatedAt)): PortfolioDailySnapshotRow[] {
  return report.profiles.map((profile) => ({
    user_id: userId,
    snapshot_date: snapshotDateForRegion(now, profile.region),
    profile_id: profile.id,
    currency: profile.currency,
    daily_profit_loss: profile.totals.dailyProfitLoss,
    daily_profit_loss_percent: profile.totals.dailyProfitLossPercent,
    portfolio_value: profile.totals.currentValue,
    total_profit_loss: profile.totals.profitLoss,
    holdings_count: profile.totals.quotedHoldingsCount
  }));
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
