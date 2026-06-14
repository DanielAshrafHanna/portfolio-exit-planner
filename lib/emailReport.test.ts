import { describe, expect, it } from "vitest";
import { formatDailyReportEmailHtml, formatDailyReportEmailText, weeklyPlChartSvg } from "./emailReport";
import { buildPortfolioReport } from "./portfolioReport";
import { buildWeeklySeries } from "./portfolioReportCharts";
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

const profile: PortfolioProfile = {
  id: "us-portfolio",
  name: "US Portfolio",
  region: "US",
  currency: "USD",
  settings: { fixedTradingFee: 0, percentTradingFee: 0, fxFeePercent: 0 },
  holdings: [{
    id: "aapl",
    symbol: "AAPL",
    name: "Apple",
    shares: 10,
    averageCost: 100,
    totalCost: 1000,
    news: [],
    selectedStopStyle: "balanced",
    sellPercent: 100
  }, {
    id: "msft",
    symbol: "MSFT",
    name: "Microsoft",
    shares: 5,
    averageCost: 100,
    totalCost: 500,
    news: [],
    selectedStopStyle: "balanced",
    sellPercent: 100
  }]
};

describe("emailReport", () => {
  const reportNow = new Date("2026-06-11T22:00:00.000Z");

  it("includes movers and chart sections in the daily email html", async () => {
    const fetchQuote = async (symbol: string) => ({
      data: quote(symbol, symbol === "AAPL" ? 120 : 80, symbol === "AAPL" ? 118 : 85)
    });
    const report = await buildPortfolioReport([profile], {
      now: reportNow,
      fetchQuote
    });
    const series = buildWeeklySeries([{
      snapshot_date: "2026-06-11",
      profile_id: "us-portfolio",
      profile_name: "US Portfolio",
      currency: "USD",
      daily_profit_loss: 25,
      daily_profit_loss_percent: 1.5,
      portfolio_value: 1600,
      total_profit_loss: 100,
      holdings_count: 2
    }, {
      snapshot_date: "2026-06-10",
      profile_id: "us-portfolio",
      profile_name: "US Portfolio",
      currency: "USD",
      daily_profit_loss: -10,
      daily_profit_loss_percent: -0.6,
      portfolio_value: 1575,
      total_profit_loss: 75,
      holdings_count: 2
    }], { now: reportNow });

    const html = formatDailyReportEmailHtml(report, { series, displayName: "Chantal" });
    const text = formatDailyReportEmailText(report, { series, displayName: "Chantal" });

    expect(html).toContain("Hi Chantal");
    expect(html).toContain("Daily top movers");
    expect(html).toContain("7-day daily P/L");
    expect(html).toContain("<svg");
    expect(text).toContain("Daily top movers");
    expect(text).toContain("7-day daily P/L");
  });

  it("renders an svg bar chart for weekly series points", () => {
    const series = buildWeeklySeries([{
      snapshot_date: "2026-06-11",
      profile_id: "us-portfolio",
      currency: "USD",
      daily_profit_loss: 40,
      daily_profit_loss_percent: 2,
      portfolio_value: 1600,
      total_profit_loss: 100,
      holdings_count: 2
    }, {
      snapshot_date: "2026-06-10",
      profile_id: "us-portfolio",
      currency: "USD",
      daily_profit_loss: -15,
      daily_profit_loss_percent: -1,
      portfolio_value: 1560,
      total_profit_loss: 60,
      holdings_count: 2
    }], { now: reportNow })[0];

    const svg = weeklyPlChartSvg(series);
    expect(svg).toContain("<svg");
    expect(svg).toContain('fill="#1f6f5f"');
    expect(svg).toContain('fill="#d96b5b"');
  });
});
