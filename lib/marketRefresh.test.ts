import { describe, expect, it } from "vitest";
import {
  applyLiveQuotes,
  getQuoteRefreshIntervalMs,
  isEgxMarketOpen,
  isUsExtendedHours,
  isUsMarketOpen,
  liveQuoteKey,
  US_QUOTE_INTERVAL_CLOSED_MS,
  US_QUOTE_INTERVAL_OPEN_MS
} from "./marketRefresh";
import type { EnrichedHolding, MarketQuote } from "./types";

const quote: MarketQuote = {
  symbol: "AAPL",
  currentPrice: 200,
  dailyChangePercent: 1,
  previousClose: 198,
  provider: "test"
};

describe("marketRefresh", () => {
  it("builds stable live quote keys", () => {
    expect(liveQuoteKey("US", "aapl")).toBe("US:AAPL");
  });

  it("overlays live quotes without mutating holding fields", () => {
    const holdings: EnrichedHolding[] = [{
      id: "1",
      symbol: "AAPL",
      name: "",
      shares: 10,
      averageCost: 100,
      totalCost: 1000,
      news: [],
      selectedStopStyle: "balanced",
      sellPercent: 100
    }];
    const merged = applyLiveQuotes(holdings, { [liveQuoteKey("US", "AAPL")]: quote }, "US");
    expect(merged[0].quote?.currentPrice).toBe(200);
    expect(merged[0].shares).toBe(10);
  });

  it("detects US market hours on a weekday afternoon ET", () => {
    const open = new Date("2026-06-09T18:00:00.000Z");
    expect(isUsMarketOpen(open)).toBe(true);
    expect(getQuoteRefreshIntervalMs("US", { now: open })).toBe(US_QUOTE_INTERVAL_OPEN_MS);
  });

  it("uses the faster US refresh interval during extended hours", () => {
    const preMarket = new Date("2026-06-09T12:00:00.000Z");
    expect(isUsExtendedHours(preMarket)).toBe(true);
    expect(isUsMarketOpen(preMarket)).toBe(false);
    expect(getQuoteRefreshIntervalMs("US", { now: preMarket })).toBe(US_QUOTE_INTERVAL_OPEN_MS);

    const overnight = new Date("2026-06-09T03:00:00.000Z");
    expect(isUsExtendedHours(overnight)).toBe(false);
    expect(getQuoteRefreshIntervalMs("US", { now: overnight })).toBe(US_QUOTE_INTERVAL_CLOSED_MS);
  });

  it("detects EGX hours on a Cairo session morning", () => {
    const open = new Date("2026-06-08T09:30:00.000Z");
    expect(isEgxMarketOpen(open)).toBe(true);
  });
});
