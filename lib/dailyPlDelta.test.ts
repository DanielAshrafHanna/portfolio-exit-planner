import { describe, expect, it } from "vitest";
import {
  applyCostBasisDailyPlToReport,
  holdingDailyFromCostBasisDelta,
  pickPriorSnapshotsForProfiles,
  profileDailyFromCostBasisDelta
} from "./dailyPlDelta";
import type { PortfolioReport } from "./portfolioReport";

describe("profileDailyFromCostBasisDelta", () => {
  it("uses the change in total cost-basis P/L when a prior snapshot exists", () => {
    const daily = profileDailyFromCostBasisDelta(
      { profitLoss: 120, dailyProfitLoss: 40, dailyProfitLossPercent: 2 },
      { totalProfitLoss: 100, portfolioValue: 1000 }
    );
    expect(daily).toEqual({ dailyProfitLoss: 20, dailyProfitLossPercent: 2 });
  });

  it("falls back to session P/L when there is no prior snapshot", () => {
    const daily = profileDailyFromCostBasisDelta(
      { profitLoss: 120, dailyProfitLoss: 40, dailyProfitLossPercent: 2 }
    );
    expect(daily).toEqual({ dailyProfitLoss: 40, dailyProfitLossPercent: 2 });
  });
});

describe("holdingDailyFromCostBasisDelta", () => {
  it("reflects average-cost P/L changes after a mid-day buy", () => {
    const daily = holdingDailyFromCostBasisDelta(
      { profitLoss: 62, currentValue: 1134, dailyProfitLoss: 14, dailyProfitLossPercent: 2 },
      { profit_loss: 50, current_value: 800 }
    );
    expect(daily).toEqual({ dailyProfitLoss: 12, dailyProfitLossPercent: 1.5 });
  });

  it("falls back to session P/L for a new holding", () => {
    const daily = holdingDailyFromCostBasisDelta(
      { profitLoss: 30, currentValue: 330, dailyProfitLoss: 10, dailyProfitLossPercent: 1 }
    );
    expect(daily).toEqual({ dailyProfitLoss: 10, dailyProfitLossPercent: 1 });
  });
});

describe("pickPriorSnapshotsForProfiles", () => {
  it("selects the latest snapshot before the active session date", () => {
    const prior = pickPriorSnapshotsForProfiles([
      {
        snapshot_date: "2026-06-10",
        profile_id: "us-portfolio",
        total_profit_loss: 80,
        portfolio_value: 900,
        holdings_snapshot: [{ symbol: "AAPL", profit_loss: 80, current_value: 900, shares: 5 }]
      },
      {
        snapshot_date: "2026-06-11",
        profile_id: "us-portfolio",
        total_profit_loss: 100,
        portfolio_value: 1000,
        holdings_snapshot: [{ symbol: "AAPL", profit_loss: 100, current_value: 1000, shares: 5 }]
      }
    ], [{ profileId: "us-portfolio", sessionDate: "2026-06-12" }], (value) => (
      Array.isArray(value)
        ? value.map((item) => ({
          symbol: String((item as { symbol: string }).symbol),
          name: "Apple",
          daily_profit_loss: 0,
          daily_profit_loss_percent: 0,
          shares: Number((item as { shares?: number }).shares) || 0,
          profit_loss: Number((item as { profit_loss?: number }).profit_loss) || 0,
          current_value: Number((item as { current_value?: number }).current_value) || 0,
          average_cost: 0
        }))
        : []
    ));

    expect(prior.get("us-portfolio")).toMatchObject({
      snapshotDate: "2026-06-11",
      totalProfitLoss: 100,
      portfolioValue: 1000
    });
  });
});

describe("applyCostBasisDailyPlToReport", () => {
  it("rewrites profile and holding daily P/L from prior cost-basis snapshots", () => {
    const report: PortfolioReport = {
      generatedAt: "2026-06-12T17:00:00.000Z",
      totalsByCurrency: [],
      profiles: [{
        id: "us-portfolio",
        name: "US Portfolio",
        region: "US",
        currency: "USD",
        totals: {
          currency: "USD",
          totalCost: 750,
          currentValue: 1134,
          netValue: 1134,
          fees: 0,
          profitLoss: 62,
          profitLossPercent: 8.27,
          dailyProfitLoss: 14,
          dailyProfitLossPercent: 1.25,
          dailyPriorValue: 1120,
          totalGains: 62,
          totalLosses: 0,
          stopProfitLoss: 0,
          targetProfitLoss: 0,
          holdingsCount: 1,
          quotedHoldingsCount: 1
        },
        holdings: [{
          id: "1",
          symbol: "AAPL",
          name: "Apple",
          profileId: "us-portfolio",
          profileName: "US Portfolio",
          region: "US",
          currency: "USD",
          shares: 7,
          averageCost: 153.14,
          cost: 1072,
          currentPrice: 162,
          previousClose: 160,
          currentValue: 1134,
          netValue: 1134,
          fees: 0,
          profitLoss: 62,
          profitLossPercent: 5.78,
          dailyProfitLoss: 14,
          dailyProfitLossPercent: 2,
          dailyPriorValue: 1120
        }],
        warnings: []
      }],
      holdings: [],
      warnings: [],
      textDigest: "",
      htmlDigest: ""
    };
    report.holdings = report.profiles[0].holdings;

    const adjusted = applyCostBasisDailyPlToReport(report, new Map([
      ["us-portfolio", {
        snapshotDate: "2026-06-11",
        totalProfitLoss: 50,
        portfolioValue: 800,
        holdingsBySymbol: new Map([
          ["AAPL", {
            symbol: "AAPL",
            name: "Apple",
            shares: 5,
            average_cost: 150,
            current_value: 800,
            profit_loss: 50,
            daily_profit_loss: 0,
            daily_profit_loss_percent: 0
          }]
        ])
      }]
    ]));

    expect(adjusted.profiles[0].totals.dailyProfitLoss).toBe(12);
    expect(adjusted.profiles[0].holdings[0].dailyProfitLoss).toBe(12);
  });
});
