import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "./profileUtils";
import { sanitizeProfilesForPersistence } from "./quoteCacheMigration";
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
    news: [{
      headline: "Apple update",
      source: "Test",
      date: "2026-06-09",
      url: "https://example.com",
      summary: "News"
    }],
    selectedStopStyle: "balanced",
    sellPercent: 100,
    quote: {
      symbol: "AAPL",
      currentPrice: 153.22,
      dailyChangePercent: -47,
      previousClose: 290.55,
      provider: "yahoo_finance"
    },
    analysis: {
      symbol: "AAPL",
      assetType: "Stock",
      action: "Keep",
      confidence: "High",
      riskLevel: "Medium",
      newsSentiment: "Positive",
      trendStatus: "Bullish",
      upcomingCatalysts: [],
      summary: "Hold",
      reasonsToHold: [],
      reasonsToSell: [],
      riskFlags: [],
      suggestedActionPlan: {
        primaryAction: "Keep",
        suggestedTakeProfit: 300,
        suggestedStopLoss: 250
      }
    }
  }]
}];

describe("quote persistence sanitization", () => {
  it("removes quote and news before profiles are saved or restored", () => {
    const sanitized = sanitizeProfilesForPersistence(profileWithQuote);
    const holding = sanitized[0].holdings[0];

    expect(holding.quote).toBeUndefined();
    expect(holding.news).toEqual([]);
    expect(holding.analysis?.action).toBe("Keep");
    expect(holding.symbol).toBe("AAPL");
  });
});
