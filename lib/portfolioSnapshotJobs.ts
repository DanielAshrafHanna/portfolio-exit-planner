import type { SupabaseClient } from "@supabase/supabase-js";
import { profilesFromCloudPortfolioRow, type CloudPortfolioRow } from "./cloudPortfolio";
import { buildPortfolioReport, type PortfolioReport, type PortfolioReportQuoteFetcher } from "./portfolioReport";
import { portfolioHoldingSymbols } from "./portfolioSync";
import { snapshotsFromReport, upsertPortfolioSnapshots, prepareReportForSnapshot } from "./portfolioSnapshots";
import { getQuote } from "./marketData";
import type { MarketRegion } from "./types";

export type UserSnapshotResult = {
  userId: string;
  ok: boolean;
  skipped: boolean;
  skipReason?: string;
  snapshotWarning?: string;
  error?: string;
  report?: PortfolioReport;
};

export type DailySnapshotRunSummary = {
  totalUsers: number;
  processed: number;
  skipped: number;
  failed: number;
  results: UserSnapshotResult[];
};

type RunDailySnapshotOptions = {
  now?: Date;
  freshQuotes?: boolean;
  /** Reuse quote responses across users in the same cron run. */
  shareQuoteCache?: boolean;
};

export function createCachedQuoteFetcher(
  fetchQuote: PortfolioReportQuoteFetcher = (symbol, region) => getQuote(symbol, region)
): PortfolioReportQuoteFetcher {
  const cache = new Map<string, ReturnType<PortfolioReportQuoteFetcher>>();
  return (symbol, region) => {
    const key = `${region}:${symbol.trim().toUpperCase()}`;
    const existing = cache.get(key);
    if (existing) return existing;
    const pending = fetchQuote(symbol, region);
    cache.set(key, pending);
    return pending;
  };
}

export function shouldSnapshotCloudPortfolio(row: CloudPortfolioRow) {
  const profiles = profilesFromCloudPortfolioRow(row);
  return portfolioHoldingSymbols(profiles).length > 0;
}

export async function snapshotUserPortfolio(
  supabase: SupabaseClient,
  userId: string,
  row: CloudPortfolioRow,
  options: RunDailySnapshotOptions & { fetchQuote?: PortfolioReportQuoteFetcher } = {}
): Promise<UserSnapshotResult> {
  if (!shouldSnapshotCloudPortfolio(row)) {
    return {
      userId,
      ok: true,
      skipped: true,
      skipReason: "no_holdings"
    };
  }

  try {
    const profiles = profilesFromCloudPortfolioRow(row);
    const report = await buildPortfolioReport(profiles, {
      now: options.now,
      freshQuotes: options.freshQuotes,
      fetchQuote: options.fetchQuote
    });
    const snapshotReport = await prepareReportForSnapshot(
      supabase,
      userId,
      report,
      options.now || new Date(report.generatedAt)
    );
    const snapshotResult = await upsertPortfolioSnapshots(
      supabase,
      snapshotsFromReport(userId, snapshotReport, options.now || new Date(report.generatedAt))
    );

    return {
      userId,
      ok: true,
      skipped: false,
      snapshotWarning: snapshotResult.warning,
      report: snapshotReport
    };
  } catch (error) {
    return {
      userId,
      ok: false,
      skipped: false,
      error: error instanceof Error ? error.message : "Portfolio snapshot failed."
    };
  }
}

export async function fetchAllCloudPortfolioRows(supabase: SupabaseClient, pageSize = 100) {
  const rows: CloudPortfolioRow[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("user_portfolios")
      .select("holdings, settings, display_name, share_holdings, updated_at, user_id")
      .order("user_id", { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) throw new Error(`Cloud portfolios failed to load: ${error.message}`);
    if (!data?.length) break;

    rows.push(...(data as CloudPortfolioRow[]));
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return rows;
}

export async function runDailyPortfolioSnapshotsForAllUsers(
  supabase: SupabaseClient,
  options: RunDailySnapshotOptions = {}
): Promise<DailySnapshotRunSummary> {
  const rows = await fetchAllCloudPortfolioRows(supabase);
  const fetchQuote = options.shareQuoteCache === false
    ? undefined
    : createCachedQuoteFetcher(
      options.freshQuotes
        ? (symbol, region: MarketRegion) => getQuote(symbol, region, { fresh: true })
        : undefined
    );

  const results: UserSnapshotResult[] = [];
  for (const row of rows) {
    const userId = row.user_id;
    if (!userId) {
      results.push({
        userId: "unknown",
        ok: false,
        skipped: true,
        skipReason: "missing_user_id"
      });
      continue;
    }

    results.push(await snapshotUserPortfolio(supabase, userId, row, {
      ...options,
      fetchQuote
    }));
  }

  const processed = results.filter((result) => result.ok && !result.skipped).length;
  const skipped = results.filter((result) => result.skipped).length;
  const failed = results.filter((result) => !result.ok).length;

  return {
    totalUsers: rows.length,
    processed,
    skipped,
    failed,
    results
  };
}
