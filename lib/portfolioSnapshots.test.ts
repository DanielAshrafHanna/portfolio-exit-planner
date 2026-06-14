import { describe, expect, it } from "vitest";
import { snapshotDateForRegion, snapshotsFromReport } from "./portfolioSnapshots";
import type { PortfolioReport } from "./portfolioReport";

function minimalReport(): PortfolioReport {
  return {
    generatedAt: "2026-06-13T17:00:00.000Z",
    totalsByCurrency: [],
    profiles: [
      {
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
          dailyProfitLoss: 20,
          dailyProfitLossPercent: 1.7,
          dailyPriorValue: 1180,
          totalGains: 200,
          totalLosses: 0,
          stopProfitLoss: 900,
          targetProfitLoss: 1300,
          holdingsCount: 1,
          quotedHoldingsCount: 1
        },
        holdings: [],
        warnings: []
      },
      {
        id: "eg-portfolio",
        name: "Egypt Portfolio",
        region: "EG",
        currency: "EGP",
        totals: {
          currency: "EGP",
          totalCost: 5000,
          currentValue: 4800,
          netValue: 4800,
          fees: 0,
          profitLoss: -200,
          profitLossPercent: -4,
          dailyProfitLoss: -50,
          dailyProfitLossPercent: -1,
          dailyPriorValue: 4850,
          totalGains: 0,
          totalLosses: 200,
          stopProfitLoss: 4200,
          targetProfitLoss: 5200,
          holdingsCount: 2,
          quotedHoldingsCount: 2
        },
        holdings: [],
        warnings: []
      }
    ],
    holdings: [],
    warnings: [],
    textDigest: "",
    htmlDigest: ""
  };
}

describe("snapshotDateForRegion", () => {
  it("uses the profile region timezone for the snapshot date", () => {
    const lateUtc = new Date("2026-06-13T03:30:00.000Z");
    expect(snapshotDateForRegion(lateUtc, "US")).toBe("2026-06-12");
    expect(snapshotDateForRegion(lateUtc, "EG")).toBe("2026-06-13");
  });
});

describe("snapshotsFromReport", () => {
  it("maps each profile to a daily snapshot row", () => {
    const rows = snapshotsFromReport("user-1", minimalReport(), new Date("2026-06-13T17:00:00.000Z"));
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      user_id: "user-1",
      profile_id: "us-portfolio",
      currency: "USD",
      daily_profit_loss: 20,
      portfolio_value: 1200,
      total_profit_loss: 200,
      holdings_count: 1
    });
    expect(rows[1]).toMatchObject({
      profile_id: "eg-portfolio",
      currency: "EGP",
      daily_profit_loss: -50,
      total_profit_loss: -200,
      holdings_count: 2
    });
    expect(rows[0].snapshot_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
