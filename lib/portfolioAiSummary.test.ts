import { describe, expect, it, vi } from "vitest";
import { buildDailyPortfolioAiSummaries, fallbackDailySummary } from "./portfolioAiSummary";
import type { PortfolioReport, PortfolioReportProfile } from "./portfolioReport";

function profile(): PortfolioReportProfile {
  return {
    id: "us-portfolio",
    name: "US Portfolio",
    region: "US",
    currency: "USD",
    totals: {
      currency: "USD",
      totalCost: 1000,
      currentValue: 1200,
      netValue: 1200,
      fees: 0,
      profitLoss: 200,
      profitLossPercent: 20,
      dailyProfitLoss: 30,
      dailyProfitLossPercent: 2.5,
      dailyPriorValue: 1170,
      totalGains: 200,
      totalLosses: 0,
      stopProfitLoss: 0,
      targetProfitLoss: 0,
      holdingsCount: 2,
      quotedHoldingsCount: 2
    },
    holdings: [
      {
        id: "1", symbol: "AAPL", name: "Apple", profileId: "us-portfolio", profileName: "US Portfolio",
        region: "US", currency: "USD", shares: 5, averageCost: 100, cost: 500, currentPrice: 130,
        previousClose: 128, currentValue: 650, netValue: 650, fees: 0, profitLoss: 150,
        profitLossPercent: 30, dailyProfitLoss: 10, dailyProfitLossPercent: 1.5, dailyPriorValue: 640,
        action: "Keep"
      },
      {
        id: "2", symbol: "INTC", name: "Intel", profileId: "us-portfolio", profileName: "US Portfolio",
        region: "US", currency: "USD", shares: 10, averageCost: 50, cost: 500, currentPrice: 55,
        previousClose: 57, currentValue: 550, netValue: 550, fees: 0, profitLoss: 50,
        profitLossPercent: 10, dailyProfitLoss: -20, dailyProfitLossPercent: -3.5, dailyPriorValue: 570
      }
    ],
    warnings: []
  };
}

function report(): PortfolioReport {
  const p = profile();
  return {
    generatedAt: "2026-06-16T20:00:00.000Z",
    totalsByCurrency: [],
    profiles: [p],
    holdings: p.holdings,
    warnings: [],
    textDigest: "",
    htmlDigest: ""
  };
}

describe("buildDailyPortfolioAiSummaries", () => {
  it("returns a deterministic fallback when AI is not configured", async () => {
    const results = await buildDailyPortfolioAiSummaries(report(), { configured: false });
    expect(results).toHaveLength(1);
    expect(results[0].fallback).toBe(true);
    expect(results[0].summary.holdings.map((h) => h.symbol)).toEqual(["AAPL", "INTC"]);
    expect(results[0].summary.overview).toContain("US Portfolio");
  });

  it("uses validated AI output when grounded generation succeeds", async () => {
    const generate = vi.fn().mockResolvedValue(JSON.stringify({
      overview: "Portfolio rose modestly led by AAPL while INTC slipped.",
      marketContext: "Broad indices were mixed.",
      holdings: [
        { symbol: "AAPL", action: "Keep", note: "Up on positive product news." },
        { symbol: "INTC", action: "Watch", note: "Down on sector weakness." }
      ],
      watchItems: ["AAPL earnings next week"],
      sources: [{ title: "Apple update", publisher: "Reuters", url: "https://example.com/a" }]
    }));

    const results = await buildDailyPortfolioAiSummaries(report(), { configured: true, generate });
    expect(generate).toHaveBeenCalledTimes(1);
    expect(results[0].fallback).toBe(false);
    expect(results[0].summary.holdings[1].action).toBe("Watch");
  });

  it("falls back when the AI returns malformed JSON", async () => {
    const generate = vi.fn().mockResolvedValue("not json");
    const results = await buildDailyPortfolioAiSummaries(report(), { configured: true, generate });
    expect(results[0].fallback).toBe(true);
    expect(results[0].warning).toContain("malformed");
  });
});

describe("fallbackDailySummary", () => {
  it("summarizes movers without inventing news", () => {
    const summary = fallbackDailySummary(profile());
    expect(summary.sources).toEqual([]);
    expect(summary.watchItems).toEqual([]);
    expect(summary.overview).toContain("AAPL");
  });
});
