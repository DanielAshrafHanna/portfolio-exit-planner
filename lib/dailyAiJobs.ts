import type { SupabaseClient } from "@supabase/supabase-js";
import { profilesFromCloudPortfolioRow, type CloudPortfolioRow } from "./cloudPortfolio";
import {
  dailyAiCacheFromCloudRow,
  persistDailyAiCacheForUser,
  runUnifiedDailyAiForReport,
  unifiedResultToEmailSummary
} from "./dailyAiPersistence";
import type { PortfolioReport } from "./portfolioReport";
import type { DailyPortfolioSummaryResult } from "./portfolioAiSummary";
import { isDailyAiCacheFresh } from "./dailyAiCache";

export async function runAndPersistDailyAiForUser(
  supabase: SupabaseClient,
  userId: string,
  row: CloudPortfolioRow,
  report: PortfolioReport,
  options: { now?: Date } = {}
): Promise<{ summaries: DailyPortfolioSummaryResult[]; warnings: string[]; skipped?: boolean; skipReason?: string }> {
  const profiles = profilesFromCloudPortfolioRow(row);
  const existingCache = dailyAiCacheFromCloudRow(row);
  const quotedProfiles = report.profiles.filter((profile) => profile.holdings.some((holding) => holding.currentPrice !== undefined));
  if (!quotedProfiles.length) {
    return { summaries: [], warnings: [], skipped: true, skipReason: "no_quoted_holdings" };
  }

  const allFresh = quotedProfiles.every((profile) => {
    const entry = existingCache.entries[profile.id];
    return entry && isDailyAiCacheFresh(entry, profile.region, options.now);
  });
  if (allFresh) {
    return {
      summaries: quotedProfiles.map((profile) => {
        const entry = existingCache.entries[profile.id];
        return {
          profileId: profile.id,
          profileName: profile.name,
          summary: entry.summary,
          fallback: entry.fallback
        };
      }),
      warnings: [],
      skipped: true,
      skipReason: "cache_fresh"
    };
  }

  const { results, cache, warnings } = await runUnifiedDailyAiForReport(report, profiles, {
    runType: "automatic",
    now: options.now
  });
  const mergedCache = {
    entries: { ...existingCache.entries, ...cache.entries },
    usageByMarketDate: { ...existingCache.usageByMarketDate, ...cache.usageByMarketDate }
  };
  for (const [date, usage] of Object.entries(cache.usageByMarketDate)) {
    const prior = existingCache.usageByMarketDate[date] || { automatic: 0, manual: 0 };
    mergedCache.usageByMarketDate[date] = {
      automatic: prior.automatic + usage.automatic,
      manual: prior.manual + usage.manual
    };
  }

  const persist = await persistDailyAiCacheForUser(supabase, userId, row, mergedCache);
  if (persist.warning) warnings.push(persist.warning);

  return {
    summaries: results.map(unifiedResultToEmailSummary),
    warnings
  };
}
