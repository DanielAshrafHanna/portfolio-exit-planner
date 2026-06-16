import { describe, expect, it } from "vitest";
import {
  applyDailyAiCacheToHoldings,
  buildDailyAiUsageSummary,
  isDailyAiCacheFresh,
  parseDailyAiCache,
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
});
