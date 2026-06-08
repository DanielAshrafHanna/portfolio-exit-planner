import { describe, expect, it } from "vitest";
import { analysisRequestSchema, marketRequestSchema, normalizeAiAnalysis } from "./validation";

const holding = {
  id: "1",
  symbol: "TSM",
  name: "Taiwan Semiconductor",
  shares: 10,
  averageCost: 100,
  totalCost: 1000
};

const quote = {
  symbol: "TSM",
  currentPrice: 120,
  dailyChangePercent: 1.5,
  previousClose: 118,
  provider: "test"
};

describe("API request schemas", () => {
  it("rejects empty market requests", () => {
    expect(marketRequestSchema.safeParse({ symbols: [] }).success).toBe(false);
  });

  it("rejects oversized market and news batches", () => {
    expect(marketRequestSchema.safeParse({ symbols: Array.from({ length: 51 }, (_, index) => `T${index}`) }).success).toBe(false);
    expect(analysisRequestSchema.safeParse({
      holding,
      quote,
      news: Array.from({ length: 13 }, () => ({ headline: "News", source: "Source", date: "2026-06-08", url: "https://example.com", summary: "Summary" }))
    }).success).toBe(false);
  });

  it("normalizes valid analysis requests", () => {
    const parsed = analysisRequestSchema.safeParse({
      holding,
      quote,
      news: [{ headline: "News", source: "Source", date: "2026-06-08", url: "https://example.com", summary: "Summary" }]
    });

    expect(parsed.success).toBe(true);
    expect(parsed.success ? parsed.data.holding.symbol : "").toBe("TSM");
  });
});

describe("AI response validation", () => {
  it("falls back when model JSON is malformed", () => {
    const result = normalizeAiAnalysis({ symbol: "TSM", action: "Maybe" }, holding, quote, []);

    expect(result.analysis.action).toBe("Keep");
    expect(result.analysis.confidence).toBe("Low");
    expect(result.warning).toContain("malformed");
  });

  it("accepts complete structured analysis", () => {
    const result = normalizeAiAnalysis({
      symbol: "tsm",
      assetType: "Stock",
      action: "Watch",
      confidence: "Medium",
      riskLevel: "Medium",
      newsSentiment: "Neutral",
      trendStatus: "Neutral",
      upcomingCatalysts: [],
      summary: "Balanced setup.",
      reasonsToHold: ["Price is above cost basis."],
      reasonsToSell: ["Momentum is mixed."],
      riskFlags: ["No verified upcoming catalyst found."],
      suggestedActionPlan: {
        primaryAction: "Watch",
        explanation: "Monitor with a stop.",
        suggestedStopLoss: 110,
        suggestedTakeProfit: 132,
        reviewAfterCatalyst: false
      },
      sourcesUsed: []
    }, holding, quote, []);

    expect(result.warning).toBeUndefined();
    expect(result.analysis.symbol).toBe("TSM");
    expect(result.analysis.action).toBe("Watch");
  });
});
