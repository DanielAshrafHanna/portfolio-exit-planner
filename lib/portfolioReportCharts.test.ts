import { describe, expect, it } from "vitest";
import { buildCumulativePoints, buildWeeklySeries, topHoldingMovers } from "./portfolioReportCharts";
import type { SnapshotHistoryRow } from "./portfolioReportCharts";

const now = new Date("2026-06-13T12:00:00.000Z");

function row(overrides: Partial<SnapshotHistoryRow> & Pick<SnapshotHistoryRow, "snapshot_date" | "daily_profit_loss">): SnapshotHistoryRow {
  return {
    profile_id: "us-portfolio",
    profile_name: "US Portfolio",
    currency: "USD",
    daily_profit_loss_percent: 1,
    portfolio_value: 1000,
    total_profit_loss: 100,
    holdings_count: 2,
    ...overrides
  };
}

describe("buildWeeklySeries", () => {
  it("fills missing days in a rolling 7-day window", () => {
    const series = buildWeeklySeries([
      row({ snapshot_date: "2026-06-11", daily_profit_loss: 25 }),
      row({ snapshot_date: "2026-06-13", daily_profit_loss: -10 })
    ], { days: 7, now });

    expect(series).toHaveLength(1);
    expect(series[0].points).toHaveLength(7);
    expect(series[0].points[0]).toMatchObject({ snapshotDate: "2026-06-07", hasData: false, dailyProfitLoss: 0, marketClosed: true });
    expect(series[0].points[4]).toMatchObject({ snapshotDate: "2026-06-11", hasData: true, dailyProfitLoss: 25, marketClosed: false });
    expect(series[0].points[6]).toMatchObject({ snapshotDate: "2026-06-13", hasData: true, dailyProfitLoss: -10, marketClosed: true });
  });

  it("keeps currencies separate when profileId is all", () => {
    const series = buildWeeklySeries([
      row({ snapshot_date: "2026-06-13", daily_profit_loss: 10, profile_id: "us-portfolio", currency: "USD" }),
      row({ snapshot_date: "2026-06-13", daily_profit_loss: -5, profile_id: "eg-portfolio", currency: "EGP", profile_name: "Egypt" })
    ], { days: 7, profileId: "all", now });

    expect(series).toHaveLength(2);
    expect(series.map((item) => item.currency).sort()).toEqual(["EGP", "USD"]);
  });

  it("filters to a single profile", () => {
    const series = buildWeeklySeries([
      row({ snapshot_date: "2026-06-13", daily_profit_loss: 10, profile_id: "us-portfolio" }),
      row({ snapshot_date: "2026-06-13", daily_profit_loss: -5, profile_id: "eg-portfolio", currency: "EGP" })
    ], { days: 7, profileId: "us-portfolio", now });

    expect(series).toHaveLength(1);
    expect(series[0].profileId).toBe("us-portfolio");
  });

  it("anchors the rolling window to each region's local market date near a UTC midnight boundary", () => {
    // 01:00 UTC: still Jun 12 in New York, already Jun 13 in Cairo.
    const nearMidnight = new Date("2026-06-13T01:00:00.000Z");

    const usSeries = buildWeeklySeries([
      row({ snapshot_date: "2026-06-12", daily_profit_loss: 5, profile_id: "us-portfolio", currency: "USD" })
    ], { days: 7, profileId: "us-portfolio", now: nearMidnight });
    const usLast = usSeries[0].points.at(-1);
    expect(usLast?.snapshotDate).toBe("2026-06-12");
    expect(usLast?.hasData).toBe(true);

    const egSeries = buildWeeklySeries([
      row({ snapshot_date: "2026-06-13", daily_profit_loss: 5, profile_id: "eg-portfolio", currency: "EGP", profile_name: "Egypt" })
    ], { days: 7, profileId: "eg-portfolio", now: nearMidnight });
    const egLast = egSeries[0].points.at(-1);
    expect(egLast?.snapshotDate).toBe("2026-06-13");
    expect(egLast?.hasData).toBe(true);
  });
});

describe("buildCumulativePoints", () => {
  it("accumulates signed daily profit and loss", () => {
    const points = buildCumulativePoints([
      { date: "Jun 11", snapshotDate: "2026-06-11", dailyProfitLoss: 20, dailyProfitLossPercent: 1, portfolioValue: 1000, totalProfitLoss: 100, hasData: true },
      { date: "Jun 12", snapshotDate: "2026-06-12", dailyProfitLoss: -5, dailyProfitLossPercent: -0.5, portfolioValue: 995, totalProfitLoss: 95, hasData: true },
      { date: "Jun 13", snapshotDate: "2026-06-13", dailyProfitLoss: 0, dailyProfitLossPercent: 0, portfolioValue: 0, totalProfitLoss: 0, hasData: false }
    ]);

    expect(points[0].cumulativeProfitLoss).toBe(20);
    expect(points[1].cumulativeProfitLoss).toBe(15);
    expect(points[2].cumulativeProfitLoss).toBe(15);
  });
});

describe("topHoldingMovers", () => {
  it("returns biggest gainers and losers by daily profit and loss", () => {
    const movers = topHoldingMovers([
      { symbol: "AAPL", name: "Apple", dailyProfitLoss: 30 },
      { symbol: "MSFT", name: "Microsoft", dailyProfitLoss: 10 },
      { symbol: "TSLA", name: "Tesla", dailyProfitLoss: -20 },
      { symbol: "NVDA", name: "Nvidia", dailyProfitLoss: -5 }
    ], 2);

    expect(movers.map((item) => item.symbol)).toEqual(["TSLA", "NVDA", "AAPL", "MSFT"]);
  });
});
