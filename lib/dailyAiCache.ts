import { marketDateString } from "./marketSession";
import type { DailyPortfolioSummary } from "./validation";
import type { AiAnalysis, EnrichedHolding, MarketRegion, PortfolioProfile } from "./types";

export type DailyAiProfileCacheEntry = {
  profileId: string;
  profileName: string;
  marketDate: string;
  generatedAt: string;
  summary: DailyPortfolioSummary;
  analysesBySymbol: Record<string, AiAnalysis>;
  fallback: boolean;
  runType: "automatic" | "manual";
};

export type DailyAiUsageDay = {
  automatic: number;
  manual: number;
};

export type DailyAiCacheState = {
  entries: Record<string, DailyAiProfileCacheEntry>;
  usageByMarketDate: Record<string, DailyAiUsageDay>;
};

export type DailyAiUsageSummary = {
  marketDate: string;
  cacheFresh: boolean;
  automaticRunsToday: number;
  manualRunsToday: number;
  geminiCallsToday: number;
  lastRunAt?: string;
  lastRunType?: "automatic" | "manual";
  profileEntry?: DailyAiProfileCacheEntry;
};

const EMPTY_CACHE: DailyAiCacheState = { entries: {}, usageByMarketDate: {} };

export function emptyDailyAiCache(): DailyAiCacheState {
  return { entries: {}, usageByMarketDate: {} };
}

export function parseDailyAiCache(value: unknown): DailyAiCacheState {
  if (!value || typeof value !== "object" || Array.isArray(value)) return emptyDailyAiCache();
  const record = value as Record<string, unknown>;
  const entries: Record<string, DailyAiProfileCacheEntry> = {};
  if (record.entries && typeof record.entries === "object" && !Array.isArray(record.entries)) {
    for (const [profileId, entryValue] of Object.entries(record.entries)) {
      const parsed = parseDailyAiProfileCacheEntry(entryValue);
      if (parsed) entries[profileId] = parsed;
    }
  }
  const usageByMarketDate: Record<string, DailyAiUsageDay> = {};
  if (record.usageByMarketDate && typeof record.usageByMarketDate === "object" && !Array.isArray(record.usageByMarketDate)) {
    for (const [date, usageValue] of Object.entries(record.usageByMarketDate)) {
      if (!usageValue || typeof usageValue !== "object" || Array.isArray(usageValue)) continue;
      const usageRecord = usageValue as Record<string, unknown>;
      usageByMarketDate[date] = {
        automatic: Number(usageRecord.automatic) || 0,
        manual: Number(usageRecord.manual) || 0
      };
    }
  }
  return { entries, usageByMarketDate };
}

function parseDailyAiProfileCacheEntry(value: unknown): DailyAiProfileCacheEntry | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  const profileId = typeof record.profileId === "string" ? record.profileId.trim() : "";
  const marketDate = typeof record.marketDate === "string" ? record.marketDate.trim() : "";
  const generatedAt = typeof record.generatedAt === "string" ? record.generatedAt.trim() : "";
  const summary = record.summary;
  const analysesBySymbol = record.analysesBySymbol;
  if (!profileId || !marketDate || !generatedAt || !summary || typeof summary !== "object") return undefined;
  const parsedAnalyses: Record<string, AiAnalysis> = {};
  if (analysesBySymbol && typeof analysesBySymbol === "object" && !Array.isArray(analysesBySymbol)) {
    for (const [symbol, analysisValue] of Object.entries(analysesBySymbol)) {
      if (analysisValue && typeof analysisValue === "object" && !Array.isArray(analysisValue)) {
        parsedAnalyses[symbol.trim().toUpperCase()] = analysisValue as AiAnalysis;
      }
    }
  }
  return {
    profileId,
    profileName: typeof record.profileName === "string" ? record.profileName : profileId,
    marketDate,
    generatedAt,
    summary: summary as DailyPortfolioSummary,
    analysesBySymbol: parsedAnalyses,
    fallback: Boolean(record.fallback),
    runType: record.runType === "manual" ? "manual" : "automatic"
  };
}

export function isDailyAiCacheFresh(
  entry: DailyAiProfileCacheEntry | undefined,
  region: MarketRegion,
  now = new Date()
) {
  if (!entry) return false;
  return entry.marketDate === marketDateString(region, now);
}

export function applyDailyAiCacheToHoldings(
  holdings: EnrichedHolding[],
  entry: DailyAiProfileCacheEntry
): EnrichedHolding[] {
  return holdings.map((holding) => {
    const analysis = entry.analysesBySymbol[holding.symbol.trim().toUpperCase()];
    return analysis ? { ...holding, analysis } : holding;
  });
}

export function applyDailyAiCacheToProfiles(
  profiles: PortfolioProfile[],
  cache: DailyAiCacheState
): PortfolioProfile[] {
  return profiles.map((profile) => {
    const entry = cache.entries[profile.id];
    if (!entry || !isDailyAiCacheFresh(entry, profile.region)) return profile;
    return {
      ...profile,
      holdings: applyDailyAiCacheToHoldings(profile.holdings, entry)
    };
  });
}

export function upsertDailyAiCacheEntry(
  cache: DailyAiCacheState,
  entry: DailyAiProfileCacheEntry
): DailyAiCacheState {
  const usage = cache.usageByMarketDate[entry.marketDate] || { automatic: 0, manual: 0 };
  const nextUsage = {
    automatic: usage.automatic + (entry.runType === "automatic" ? 1 : 0),
    manual: usage.manual + (entry.runType === "manual" ? 1 : 0)
  };
  return {
    entries: { ...cache.entries, [entry.profileId]: entry },
    usageByMarketDate: { ...cache.usageByMarketDate, [entry.marketDate]: nextUsage }
  };
}

export function buildDailyAiUsageSummary(
  cache: DailyAiCacheState,
  region: MarketRegion,
  profileId?: string,
  now = new Date()
): DailyAiUsageSummary {
  const marketDate = marketDateString(region, now);
  const usage = cache.usageByMarketDate[marketDate] || { automatic: 0, manual: 0 };
  const profileEntry = profileId ? cache.entries[profileId] : undefined;
  return {
    marketDate,
    cacheFresh: isDailyAiCacheFresh(profileEntry, region, now),
    automaticRunsToday: usage.automatic,
    manualRunsToday: usage.manual,
    geminiCallsToday: usage.automatic + usage.manual,
    lastRunAt: profileEntry?.generatedAt,
    lastRunType: profileEntry?.runType,
    profileEntry: profileEntry && isDailyAiCacheFresh(profileEntry, region, now) ? profileEntry : undefined
  };
}

export function dailyAiCacheEntryFromUnifiedResult(
  result: {
    profileId: string;
    profileName: string;
    generatedAt: string;
    summary: DailyPortfolioSummary;
    results: Array<{ analysis: AiAnalysis }>;
    fallback: boolean;
  },
  region: MarketRegion,
  runType: "automatic" | "manual",
  now = new Date()
): DailyAiProfileCacheEntry {
  const analysesBySymbol: Record<string, AiAnalysis> = {};
  for (const item of result.results) {
    analysesBySymbol[item.analysis.symbol.trim().toUpperCase()] = item.analysis;
  }
  return {
    profileId: result.profileId,
    profileName: result.profileName,
    marketDate: marketDateString(region, now),
    generatedAt: result.generatedAt,
    summary: result.summary,
    analysesBySymbol,
    fallback: result.fallback,
    runType
  };
}

export function dailyAiCacheIsEmpty(cache: DailyAiCacheState | undefined) {
  return !cache || (!Object.keys(cache.entries).length && !Object.keys(cache.usageByMarketDate).length);
}

export { EMPTY_CACHE };
