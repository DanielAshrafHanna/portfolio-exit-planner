import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "./profileUtils";
import {
  maybeInvalidatePersistedMarketQuotes,
  PERSISTED_QUOTE_CACHE_VERSION,
  PERSISTED_QUOTE_CACHE_VERSION_KEY
} from "./quoteCacheMigration";
import type { PortfolioProfile } from "./types";

const profileWithQuote: PortfolioProfile[] = [{
  id: "us-portfolio",
  name: "US Portfolio",
  region: "US",
  currency: "USD",
  settings: DEFAULT_SETTINGS,
  holdings: [{
    id: "1",
    symbol: "AAPL",
    name: "Apple",
    shares: 1,
    averageCost: 100,
    totalCost: 100,
    news: [],
    selectedStopStyle: "balanced",
    sellPercent: 100,
    quote: {
      symbol: "AAPL",
      currentPrice: 153.22,
      dailyChangePercent: -47,
      previousClose: 290.55,
      provider: "yahoo_finance"
    }
  }]
}];

function createStorageMock() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
    removeItem: (key: string) => { store.delete(key); },
    clear: () => { store.clear(); }
  };
}

describe("quote cache migration", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", createStorageMock());
  });

  it("strips persisted quotes once when the cache version is outdated", () => {
    localStorage.setItem(PERSISTED_QUOTE_CACHE_VERSION_KEY, "1");
    const result = maybeInvalidatePersistedMarketQuotes(profileWithQuote);

    expect(result.invalidated).toBe(true);
    expect(result.profiles[0].holdings[0].quote).toBeUndefined();
    expect(localStorage.getItem(PERSISTED_QUOTE_CACHE_VERSION_KEY)).toBe(String(PERSISTED_QUOTE_CACHE_VERSION));
  });

  it("keeps persisted quotes after the cache version has been upgraded", () => {
    localStorage.setItem(PERSISTED_QUOTE_CACHE_VERSION_KEY, String(PERSISTED_QUOTE_CACHE_VERSION));
    const result = maybeInvalidatePersistedMarketQuotes(profileWithQuote);

    expect(result.invalidated).toBe(false);
    expect(result.profiles[0].holdings[0].quote?.currentPrice).toBe(153.22);
  });
});
