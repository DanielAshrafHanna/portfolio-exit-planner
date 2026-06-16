import { describe, expect, it } from "vitest";
import { analysisRequestSchema, marketRequestSchema, normalizeAiAnalysis, normalizeBatchAiAnalyses, portfolioAnalysisRequestSchema } from "./validation";

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

describe("portfolioAnalysisRequestSchema", () => {
  it("requires at least one item and caps at 50", () => {
    expect(portfolioAnalysisRequestSchema.safeParse({ items: [] }).success).toBe(false);
    expect(portfolioAnalysisRequestSchema.safeParse({
      items: [{ holding, quote, news: [] }]
    }).success).toBe(true);
  });
});

describe("normalizeBatchAiAnalyses", () => {
  const items = [
    { holding, quote, news: [] },
    { holding: { ...holding, id: "2", symbol: "AAPL" }, quote: { ...quote, symbol: "AAPL" }, news: [] }
  ];

  function analysis(symbol: string) {
    return {
      symbol,
      assetType: "Stock",
      action: "Keep",
      confidence: "Medium",
      riskLevel: "Medium",
      newsSentiment: "Neutral",
      trendStatus: "Bullish",
      upcomingCatalysts: [],
      summary: "Hold.",
      reasonsToHold: ["Trend is up."],
      reasonsToSell: ["Watch momentum."],
      riskFlags: ["No verified upcoming catalyst found."],
      suggestedActionPlan: {
        primaryAction: "Keep",
        explanation: "Use a stop.",
        suggestedStopLoss: 110,
        suggestedTakeProfit: 140,
        reviewAfterCatalyst: false
      },
      sourcesUsed: []
    };
  }

  it("matches analyses to holdings by symbol regardless of order", () => {
    const { results, fallbackCount } = normalizeBatchAiAnalyses(
      { analyses: [analysis("AAPL"), analysis("TSM")] },
      items
    );
    expect(fallbackCount).toBe(0);
    expect(results.map((item) => item.analysis.symbol)).toEqual(["TSM", "AAPL"]);
    expect(results.every((item) => item.fallback === false)).toBe(true);
  });

  it("falls back per missing or malformed symbol", () => {
    const { results, fallbackCount } = normalizeBatchAiAnalyses({ analyses: [analysis("TSM")] }, items);
    expect(fallbackCount).toBe(1);
    expect(results.find((item) => item.id === "2")?.fallback).toBe(true);
    expect(results.find((item) => item.id === "1")?.fallback).toBe(false);
  });

  it("falls back for all when payload is not a list", () => {
    const { results, fallbackCount } = normalizeBatchAiAnalyses("nonsense", items);
    expect(fallbackCount).toBe(2);
    expect(results.every((item) => item.fallback)).toBe(true);
  });
});
