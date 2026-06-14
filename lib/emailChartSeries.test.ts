import { describe, expect, it } from "vitest";
import { resolveEmailChartSeries } from "./emailChartSeries";
import type { PortfolioReport } from "./portfolioReport";

describe("resolveEmailChartSeries", () => {
  it("falls back to today's profile totals when history has no plotted points", () => {
    const report = {
      generatedAt: "2026-06-13T22:00:00.000Z",
      profiles: [{
        id: "us-portfolio",
        name: "US Portfolio",
        region: "US" as const,
        currency: "USD" as const,
        totals: {
          currency: "USD" as const,
          totalCost: 1000,
          currentValue: 1100,
          netValue: 1100,
          fees: 0,
          profitLoss: 100,
          profitLossPercent: 10,
          dailyProfitLoss: 25,
          dailyProfitLossPercent: 2.3,
          dailyPriorValue: 1075,
          totalGains: 100,
          totalLosses: 0,
          stopProfitLoss: 0,
          targetProfitLoss: 0,
          holdingsCount: 1,
          quotedHoldingsCount: 1
        },
        holdings: [],
        warnings: []
      }],
      totalsByCurrency: [],
      holdings: [],
      warnings: [],
      textDigest: "",
      htmlDigest: ""
    } satisfies PortfolioReport;

    const series = resolveEmailChartSeries(report, []);
    expect(series).toHaveLength(1);
    expect(series[0].points[0].dailyProfitLoss).toBe(25);
    expect(series[0].points[0].hasPlData).toBe(true);
  });
});
