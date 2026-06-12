import { describe, expect, it } from "vitest";
import type { EnrichedHolding } from "./types";
import {
  analysisCoverage,
  buildAnalysisSession,
  reconcileAnalysisSession
} from "./analysisProgress";

function holding(symbol: string, hasAnalysis: boolean): EnrichedHolding {
  return {
    id: symbol,
    symbol,
    name: symbol,
    shares: 1,
    averageCost: 10,
    totalCost: 10,
    news: [],
    selectedStopStyle: "balanced",
    sellPercent: 100,
    analysis: hasAnalysis ? {
      symbol,
      assetType: "Stock",
      action: "Watch",
      confidence: "Low",
      riskLevel: "Medium",
      newsSentiment: "Neutral",
      trendStatus: "Neutral",
      summary: "test",
      reasonsToHold: [],
      reasonsToSell: [],
      riskFlags: [],
      upcomingCatalysts: [],
      suggestedActionPlan: {
        primaryAction: "Watch",
        explanation: "test",
        suggestedStopLoss: 9,
        suggestedTakeProfit: 12,
        reviewAfterCatalyst: false
      },
      sourcesUsed: []
    } : undefined
  };
}

function holdingWithQuote(symbol: string, hasAnalysis: boolean, quote: EnrichedHolding["quote"]): EnrichedHolding {
  return { ...holding(symbol, hasAnalysis), quote };
}

describe("analysisCoverage", () => {
  it("counts analyzed and pending holdings with symbols", () => {
    const coverage = analysisCoverage([
      holding("AAPL", true),
      holding("MSFT", false),
      { ...holding("", false), symbol: "" }
    ]);
    expect(coverage.total).toBe(2);
    expect(coverage.analyzed).toBe(1);
    expect(coverage.analyzedSymbols).toEqual(["AAPL"]);
    expect(coverage.pendingSymbols).toEqual(["MSFT"]);
    expect(coverage.skippedSymbols).toEqual([]);
  });

  it("excludes unavailable quotes from total and tracks skipped symbols", () => {
    const coverage = analysisCoverage([
      holdingWithQuote("COMI", true, { symbol: "COMI", currentPrice: 100, previousClose: 99, dailyChangePercent: 1, provider: "mubasher_egx" }),
      holdingWithQuote("ORAS", true, { symbol: "ORAS", currentPrice: 50, previousClose: 49, dailyChangePercent: 2, provider: "mubasher_egx" }),
      holdingWithQuote("RAYA", true, { symbol: "RAYA", currentPrice: 30, previousClose: 29, dailyChangePercent: 3, provider: "mubasher_egx" }),
      holdingWithQuote("TICK", false, {
        symbol: "TICK",
        currentPrice: 0,
        previousClose: 0,
        dailyChangePercent: 0,
        provider: "unavailable",
        error: "No live quote"
      })
    ]);
    expect(coverage.total).toBe(3);
    expect(coverage.analyzed).toBe(3);
    expect(coverage.skippedSymbols).toEqual(["TICK"]);
    expect(coverage.pendingSymbols).toEqual([]);
  });

  it("keeps holdings without quotes in total while quotes are still loading", () => {
    const coverage = analysisCoverage([
      holdingWithQuote("AAPL", false, { symbol: "AAPL", currentPrice: 100, previousClose: 99, dailyChangePercent: 1, provider: "yahoo" }),
      holding("MSFT", false)
    ]);
    expect(coverage.total).toBe(2);
    expect(coverage.pendingSymbols).toEqual(["AAPL", "MSFT"]);
    expect(coverage.skippedSymbols).toEqual([]);
  });
});

describe("reconcileAnalysisSession", () => {
  it("marks an in-flight session as interrupted after reload", () => {
    const session = buildAnalysisSession({
      profileId: "us-portfolio",
      inputKey: "key-1",
      phase: "analyzing",
      completed: 1,
      total: 3,
      currentSymbol: "MSFT",
      model: "gemini-3.1-flash-lite",
      completedSymbols: ["AAPL"],
      pendingSymbols: ["MSFT", "GOOG"]
    });
    const reconciled = reconcileAnalysisSession(
      session,
      "us-portfolio",
      "key-1",
      analysisCoverage([holding("AAPL", true), holding("MSFT", false), holding("GOOG", false)])
    );
    expect(reconciled?.phase).toBe("interrupted");
    expect(reconciled?.completed).toBe(1);
    expect(reconciled?.currentSymbol).toBeNull();
  });

  it("drops stale sessions when holdings changed", () => {
    const session = buildAnalysisSession({
      profileId: "us-portfolio",
      inputKey: "old-key",
      phase: "interrupted",
      completed: 1,
      total: 2,
      currentSymbol: null,
      model: "gemini-3.1-flash-lite",
      completedSymbols: ["AAPL"],
      pendingSymbols: ["MSFT"]
    });
    expect(reconcileAnalysisSession(session, "us-portfolio", "new-key", analysisCoverage([holding("AAPL", true)]))).toBeNull();
  });
});
