import { describe, expect, it } from "vitest";
import { buildPortfolioReport, type PortfolioReportQuoteFetcher } from "./portfolioReport";
import type { MarketQuote, PortfolioProfile } from "./types";

function quote(symbol: string, currentPrice: number, previousClose = currentPrice - 1): MarketQuote {
  return {
    symbol,
    currentPrice,
    previousClose,
    dailyChangePercent: previousClose > 0 ? Number((((currentPrice - previousClose) / previousClose) * 100).toFixed(2)) : 0,
    provider: "test"
  };
}

function profile(holdings: PortfolioProfile["holdings"]): PortfolioProfile {
  return {
    id: "us-portfolio",
    name: "US Portfolio",
    region: "US",
    currency: "USD",
    settings: { fixedTradingFee: 0, percentTradingFee: 0, fxFeePercent: 0 },
    holdings
  };
}

const profitableHolding = {
  id: "aapl",
  symbol: "AAPL",
  name: "Apple",
  shares: 10,
  averageCost: 100,
  totalCost: 1000,
  news: [],
  selectedStopStyle: "balanced" as const,
  sellPercent: 100
};

const losingHolding = {
  id: "msft",
  symbol: "MSFT",
  name: "Microsoft",
  shares: 5,
  averageCost: 100,
  totalCost: 500,
  news: [],
  selectedStopStyle: "balanced" as const,
  sellPercent: 100
};

const reportDate = new Date("2026-06-13T05:00:00.000Z");

describe("buildPortfolioReport", () => {
  it("calculates profitable portfolio totals", async () => {
    const fetchQuote: PortfolioReportQuoteFetcher = async () => ({ data: quote("AAPL", 120, 118) });
    const report = await buildPortfolioReport([profile([profitableHolding])], { now: reportDate, fetchQuote });

    expect(report.totalsByCurrency[0]).toMatchObject({
      currency: "USD",
      totalCost: 1000,
      currentValue: 1200,
      profitLoss: 200,
      profitLossPercent: 20,
      dailyProfitLoss: 20,
      totalGains: 200,
      totalLosses: 0
    });
    expect(report.biggestWinner?.symbol).toBe("AAPL");
    expect(report.textDigest).toContain("Daily Portfolio Summary");
  });

  it("calculates losing portfolio totals", async () => {
    const fetchQuote: PortfolioReportQuoteFetcher = async () => ({ data: quote("MSFT", 80, 85) });
    const report = await buildPortfolioReport([profile([losingHolding])], { now: reportDate, fetchQuote });

    expect(report.totalsByCurrency[0]).toMatchObject({
      currentValue: 400,
      profitLoss: -100,
      profitLossPercent: -20,
      dailyProfitLoss: -25,
      totalGains: 0,
      totalLosses: -100
    });
    expect(report.biggestLoser?.symbol).toBe("MSFT");
  });

  it("separates gains and losses for mixed holdings", async () => {
    const fetchQuote: PortfolioReportQuoteFetcher = async (symbol) => ({
      data: symbol === "AAPL" ? quote("AAPL", 120, 118) : quote("MSFT", 80, 85)
    });
    const report = await buildPortfolioReport([profile([profitableHolding, losingHolding])], { now: reportDate, fetchQuote });

    expect(report.totalsByCurrency[0]).toMatchObject({
      currentValue: 1600,
      profitLoss: 100,
      dailyProfitLoss: -5,
      totalGains: 200,
      totalLosses: -100
    });
  });

  it("keeps unavailable quotes as warnings without failing the report", async () => {
    const fetchQuote: PortfolioReportQuoteFetcher = async () => ({
      data: {
        symbol: "AAPL",
        currentPrice: 0,
        previousClose: 0,
        dailyChangePercent: 0,
        provider: "unavailable",
        error: "No live quote was found for AAPL."
      }
    });
    const report = await buildPortfolioReport([profile([profitableHolding])], { now: reportDate, fetchQuote });

    expect(report.totalsByCurrency[0].quotedHoldingsCount).toBe(0);
    expect(report.warnings[0]).toContain("No live quote was found for AAPL.");
  });

  it("consolidates duplicate symbols before quoting so totals are not double-counted", async () => {
    let quoteCalls = 0;
    const fetchQuote: PortfolioReportQuoteFetcher = async () => {
      quoteCalls += 1;
      return { data: quote("AAPL", 120, 118) };
    };
    const duplicateRows = [
      { ...profitableHolding, id: "aapl-1", shares: 10, averageCost: 100, totalCost: 1000 },
      { ...profitableHolding, id: "aapl-2", shares: 5, averageCost: 130, totalCost: 650 }
    ];
    const report = await buildPortfolioReport([profile(duplicateRows)], { now: reportDate, fetchQuote });

    expect(quoteCalls).toBe(1);
    expect(report.profiles[0].holdings).toHaveLength(1);
    expect(report.profiles[0].holdings[0].shares).toBe(15);
    expect(report.profiles[0].totals.currentValue).toBe(1800);
    expect(report.profiles[0].totals.totalCost).toBe(1650);
  });
});
