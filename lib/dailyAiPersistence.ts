import type { SupabaseClient } from "@supabase/supabase-js";
import { cloudSettingsFromRow, profilesFromCloudPortfolioRow, type CloudPortfolioRow } from "./cloudPortfolio";
import {
  applyDailyAiCacheToProfiles,
  dailyAiCacheEntryFromUnifiedResult,
  emptyDailyAiCache,
  isDailyAiCacheFresh,
  parseDailyAiCache,
  upsertDailyAiCacheEntry,
  type DailyAiCacheState,
  type DailyAiProfileCacheEntry
} from "./dailyAiCache";
import type { DailyPortfolioSummaryResult } from "./portfolioAiSummary";
import type { PortfolioReport } from "./portfolioReport";
import { sanitizeProfilesForPersistence } from "./quoteCacheMigration";
import {
  buildAnalysisItemsFromReportProfile,
  buildUnifiedProfileAnalysis,
  type UnifiedProfileAnalysisResult
} from "./unifiedPortfolioAnalysis";
import type { HoldingInput, PortfolioProfile } from "./types";

export function dailyAiCacheFromCloudRow(row: CloudPortfolioRow): DailyAiCacheState {
  const settings = cloudSettingsFromRow(row);
  return parseDailyAiCache((settings as { dailyAiCache?: unknown }).dailyAiCache);
}

export function mergeProfilesWithDailyAiCache(
  profiles: PortfolioProfile[],
  cache: DailyAiCacheState
): PortfolioProfile[] {
  return applyDailyAiCacheToProfiles(profiles, cache);
}

export function unifiedResultToEmailSummary(result: UnifiedProfileAnalysisResult): DailyPortfolioSummaryResult {
  return {
    profileId: result.profileId,
    profileName: result.profileName,
    summary: result.summary,
    fallback: result.fallback,
    warning: result.warning
  };
}

export async function runUnifiedDailyAiForReport(
  report: PortfolioReport,
  profiles: PortfolioProfile[],
  options: { runType: "automatic" | "manual"; now?: Date } = { runType: "automatic" }
): Promise<{ results: UnifiedProfileAnalysisResult[]; cache: DailyAiCacheState; warnings: string[] }> {
  let cache = emptyDailyAiCache();
  const results: UnifiedProfileAnalysisResult[] = [];
  const warnings: string[] = [];
  const now = options.now ?? new Date();

  for (const reportProfile of report.profiles) {
    const profile = profiles.find((item) => item.id === reportProfile.id);
    if (!profile) continue;
    const items = buildAnalysisItemsFromReportProfile(reportProfile, profile.holdings);
    const result = await buildUnifiedProfileAnalysis(reportProfile, items, { generatedAt: report.generatedAt });
    results.push(result);
    if (result.warning) warnings.push(result.warning);
    cache = upsertDailyAiCacheEntry(
      cache,
      dailyAiCacheEntryFromUnifiedResult(result, profile.region, options.runType, now)
    );
  }

  return { results, cache, warnings };
}

export async function persistDailyAiCacheForUser(
  supabase: SupabaseClient,
  userId: string,
  row: CloudPortfolioRow,
  cache: DailyAiCacheState,
  profilesOverride?: PortfolioProfile[]
): Promise<{ ok: boolean; warning?: string }> {
  const profiles = profilesOverride ?? profilesFromCloudPortfolioRow(row);
  const mergedProfiles = mergeProfilesWithDailyAiCache(profiles, cache);
  const settings = {
    ...cloudSettingsFromRow(row),
    dailyAiCache: cache
  };

  const { error } = await supabase.from("user_portfolios").upsert({
    user_id: userId,
    holdings: sanitizeProfilesForPersistence(mergedProfiles),
    settings,
    display_name: row.display_name ?? settings.displayName ?? null,
    share_holdings: row.share_holdings ?? settings.shareHoldings ?? false,
    updated_at: new Date().toISOString()
  });

  if (error) return { ok: false, warning: `Daily AI cache save failed: ${error.message}` };
  return { ok: true };
}

export function cacheEntryForProfile(
  cache: DailyAiCacheState,
  profileId: string,
  region: PortfolioProfile["region"],
  now = new Date()
): DailyAiProfileCacheEntry | undefined {
  const entry = cache.entries[profileId];
  if (!entry || !isDailyAiCacheFresh(entry, region, now)) return undefined;
  return entry;
}

export function batchResultsFromCacheEntry(
  entry: DailyAiProfileCacheEntry,
  holdings: Array<Pick<HoldingInput, "id" | "symbol">>
) {
  return holdings.flatMap((holding) => {
    const analysis = entry.analysesBySymbol[holding.symbol.trim().toUpperCase()];
    return analysis ? [{ id: holding.id, analysis, fallback: entry.fallback }] : [];
  });
}
