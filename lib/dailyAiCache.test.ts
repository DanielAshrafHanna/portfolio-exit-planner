import { describe, expect, it } from "vitest";
import {
  applyDailyAiCacheToHoldings,
  batchItemsFromHoldings,
  buildDailyAiUsageSummary,
  isDailyAiCacheFresh,
  parseDailyAiCache,
  rehydrateFallbackCacheEntry,
  upsertDailyAiCacheEntry
} from "./dailyAiCache";

describe("dailyAiCache", () => {
  it("parses cache entries from settings JSON", () => {
    const cache = parseDailyAiCache({
      entries: {
        "us-portfolio": {
          profileId: "us-portfolio",
          profileName: "US Portfolio",
          marketDate: "2026-06-16",
          generatedAt: "2026-06-16T20:00:00.000Z",
          summary: {
            overview: "Test",
            marketContext: "",
            holdings: [],
            watchItems: [],
            sources: []
          },
          analysesBySymbol: {
            AAPL: {
              symbol: "AAPL",
              assetType: "Stock",
              action: "Keep",
              confidence: "Low",
              riskLevel: "Medium",
              newsSentiment: "Unknown",
              trendStatus: "Unknown",
              upcomingCatalysts: [],
              summary: "Hold.",
              reasonsToHold: [],
              reasonsToSell: [],
              riskFlags: [],
              suggestedActionPlan: {
                primaryAction: "Keep",
                explanation: "Hold.",
                suggestedStopLoss: 1,
                suggestedTakeProfit: 2,
                reviewAfterCatalyst: false
              },
              sourcesUsed: []
            }
          },
          fallback: false,
          runType: "automatic"
        }
      },
      usageByMarketDate: { "2026-06-16": { automatic: 1, manual: 0 } }
    });
    expect(cache.entries["us-portfolio"]?.summary.overview).toBe("Test");
    expect(cache.entries["us-portfolio"]?.analysesBySymbol.AAPL.action).toBe("Keep");
  });

  it("applies cached analyses to holdings by symbol", () => {
    const entry = {
      profileId: "us-portfolio",
      profileName: "US Portfolio",
      marketDate: "2026-06-16",
      generatedAt: "2026-06-16T20:00:00.000Z",
      summary: { overview: "x", marketContext: "", holdings: [], watchItems: [], sources: [] },
      analysesBySymbol: {
        AAPL: {
          symbol: "AAPL",
          assetType: "Stock",
          action: "Watch",
          confidence: "Low",
          riskLevel: "Medium",
          newsSentiment: "Unknown",
          trendStatus: "Unknown",
          upcomingCatalysts: [],
          summary: "Watch.",
          reasonsToHold: [],
          reasonsToSell: [],
          riskFlags: [],
          suggestedActionPlan: {
            primaryAction: "Watch",
            explanation: "Watch.",
            suggestedStopLoss: 1,
            suggestedTakeProfit: 2,
            reviewAfterCatalyst: false
          },
          sourcesUsed: []
        }
      },
      fallback: false,
      runType: "automatic" as const
    };
    const holdings = [{
      id: "1", symbol: "AAPL", name: "Apple", shares: 1, averageCost: 1, totalCost: 1,
      news: [], selectedStopStyle: "balanced" as const, sellPercent: 100
    }];
    const merged = applyDailyAiCacheToHoldings(holdings, entry);
    expect(merged[0].analysis?.action).toBe("Watch");
  });

  it("tracks gemini usage counts per market day", () => {
    const base = parseDailyAiCache({});
    const updated = upsertDailyAiCacheEntry(base, {
      profileId: "us-portfolio",
      profileName: "US Portfolio",
      marketDate: "2026-06-16",
      generatedAt: "2026-06-16T20:00:00.000Z",
      summary: { overview: "x", marketContext: "", holdings: [], watchItems: [], sources: [] },
      analysesBySymbol: {},
      fallback: false,
      runType: "manual"
    });
    const summary = buildDailyAiUsageSummary(updated, "US", "us-portfolio", new Date("2026-06-16T20:00:00.000Z"));
    expect(summary.manualRunsToday).toBe(1);
    expect(summary.geminiCallsToday).toBe(1);
    expect(isDailyAiCacheFresh(updated.entries["us-portfolio"], "US", new Date("2026-06-16T20:00:00.000Z"))).toBe(true);
  });

  it("rehydrates stale fallback cache text from live quotes", () => {
    const holding = {
      id: "1", symbol: "AAPL", name: "Apple", shares: 5, averageCost: 100, totalCost: 500,
      news: [], selectedStopStyle: "balanced" as const, sellPercent: 100,
      quote: {
        symbol: "AAPL", currentPrice: 90, previousClose: 95, dailyChangePercent: -2,
        ma20: 100, ma50: 105, provider: "test"
      }
    };
    const entry = {
      profileId: "us-portfolio",
      profileName: "US Portfolio",
      marketDate: "2026-06-16",
      generatedAt: "2026-06-16T20:00:00.000Z",
      summary: {
        overview: "old",
        marketContext: "",
        holdings: [{ symbol: "AAPL", action: "Keep" as const, note: "No recent news found. This fallback analysis uses only market data and portfolio cost basis." }],
        watchItems: [],
        sources: []
      },
      analysesBySymbol: {},
      fallback: true,
      runType: "automatic" as const
    };
    const hydrated = rehydrateFallbackCacheEntry(entry, batchItemsFromHoldings([holding]));
    expect(hydrated.summary.holdings[0]?.note).toContain("Data-only fallback");
    expect(hydrated.summary.holdings[0]?.note).not.toContain("No recent news found");
  });
});
