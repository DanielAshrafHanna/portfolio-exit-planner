import type { PortfolioProfile } from "./types";

/** Bumped after the extended-hours quote bug to clear stale saved prices once. */
export const PERSISTED_QUOTE_CACHE_VERSION = 2;
export const PERSISTED_QUOTE_CACHE_VERSION_KEY = "portfolio-exit-planner:persisted-quote-version:v1";

export function stripPersistedMarketQuotes(profiles: PortfolioProfile[]): PortfolioProfile[] {
  return profiles.map((profile) => ({
    ...profile,
    holdings: profile.holdings.map((holding) => ({ ...holding, quote: undefined }))
  }));
}

export function readPersistedQuoteCacheVersion() {
  if (typeof localStorage === "undefined") return PERSISTED_QUOTE_CACHE_VERSION;
  const raw = localStorage.getItem(PERSISTED_QUOTE_CACHE_VERSION_KEY);
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export function markPersistedQuoteCacheCurrent() {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(PERSISTED_QUOTE_CACHE_VERSION_KEY, String(PERSISTED_QUOTE_CACHE_VERSION));
}

export function maybeInvalidatePersistedMarketQuotes(profiles: PortfolioProfile[]) {
  if (readPersistedQuoteCacheVersion() >= PERSISTED_QUOTE_CACHE_VERSION) {
    return { profiles, invalidated: false };
  }
  markPersistedQuoteCacheCurrent();
  return { profiles: stripPersistedMarketQuotes(profiles), invalidated: true };
}
