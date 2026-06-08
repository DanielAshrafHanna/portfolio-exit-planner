import { describe, expect, it } from "vitest";
import { applyAnalyzedHoldingResults } from "./holdingMerge";
import type { AiAnalysis, EnrichedHolding } from "./types";

const analysis: AiAnalysis = {
  symbol: "AAPL",
  assetType: "Stock",
  action: "Watch",
  confidence: "Medium",
  riskLevel: "Medium",
  newsSentiment: "Neutral",
  trendStatus: "Neutral",
  upcomingCatalysts: [],
  summary: "Monitor the position.",
  reasonsToHold: ["Bull case."],
  reasonsToSell: ["Bear case."],
  riskFlags: ["No verified upcoming catalyst found."],
  suggestedActionPlan: {
    primaryAction: "Watch",
    explanation: "Use a defined stop.",
    suggestedStopLoss: 110,
    suggestedTakeProfit: 140,
    reviewAfterCatalyst: false
  },
  sourcesUsed: []
};

describe("analyzed holding merge", () => {
  it("applies server analysis without overwriting user-edited exit controls", () => {
    const current: EnrichedHolding[] = [{
      id: "1",
      symbol: "AAPL",
      name: "Apple",
      shares: 2,
      averageCost: 100,
      totalCost: 200,
      news: [],
      selectedStopStyle: "loose",
      selectedTargetPrice: 180,
      targetPriceEdited: true,
      sellPercent: 25
    }];

    const merged = applyAnalyzedHoldingResults(current, [{
      id: "1",
      quote: {
        symbol: "AAPL",
        currentPrice: 125,
        dailyChangePercent: 1,
        previousClose: 124,
        provider: "test"
      },
      news: [{ headline: "Headline", source: "Source", date: "2026-06-08", url: "https://example.com", summary: "Summary" }],
      analysis
    }]);

    expect(merged[0].analysis?.action).toBe("Watch");
    expect(merged[0].quote?.currentPrice).toBe(125);
    expect(merged[0].selectedStopStyle).toBe("loose");
    expect(merged[0].selectedTargetPrice).toBe(180);
    expect(merged[0].targetPriceEdited).toBe(true);
    expect(merged[0].sellPercent).toBe(25);
  });
});

