import { parseDailyAiCache, type DailyAiCacheState } from "./dailyAiCache";

const STORAGE_PREFIX = "portfolio-exit-planner:daily-ai-cache:v1";

export function dailyAiCacheStorageKey(userId: string | "guest") {
  return userId === "guest" ? `${STORAGE_PREFIX}:guest` : `${STORAGE_PREFIX}:user:${userId}`;
}

export function readLocalDailyAiCache(userId: string | "guest"): DailyAiCacheState {
  if (typeof window === "undefined") return { entries: {}, usageByMarketDate: {} };
  try {
    const raw = localStorage.getItem(dailyAiCacheStorageKey(userId));
    return raw ? parseDailyAiCache(JSON.parse(raw)) : { entries: {}, usageByMarketDate: {} };
  } catch {
    return { entries: {}, usageByMarketDate: {} };
  }
}

export function writeLocalDailyAiCache(userId: string | "guest", cache: DailyAiCacheState) {
  if (typeof window === "undefined") return;
  localStorage.setItem(dailyAiCacheStorageKey(userId), JSON.stringify(cache));
}
