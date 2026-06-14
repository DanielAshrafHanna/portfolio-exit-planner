import { describe, expect, it } from "vitest";
import { mergeSnapshotHistoryRows } from "./portfolioReportHistory";

describe("mergeSnapshotHistoryRows", () => {
  it("overwrites stored rows with fresh close-of-day snapshots from the same cron run", () => {
    const stored = [{
      snapshot_date: "2026-06-13",
      profile_id: "us-portfolio",
      profile_name: "US Portfolio",
      currency: "USD" as const,
      daily_profit_loss: 10,
      daily_profit_loss_percent: 1,
      portfolio_value: 1000,
      total_profit_loss: 100,
      holdings_count: 2
    }];
    const fresh = [{
      snapshot_date: "2026-06-13",
      profile_id: "us-portfolio",
      profile_name: "US Portfolio",
      currency: "USD" as const,
      daily_profit_loss: 42,
      daily_profit_loss_percent: 3.2,
      portfolio_value: 1350,
      total_profit_loss: 150,
      holdings_count: 2
    }];

    expect(mergeSnapshotHistoryRows(stored, fresh)).toEqual([{
      snapshot_date: "2026-06-13",
      profile_id: "us-portfolio",
      profile_name: "US Portfolio",
      currency: "USD",
      daily_profit_loss: 42,
      daily_profit_loss_percent: 3.2,
      portfolio_value: 1350,
      total_profit_loss: 150,
      holdings_count: 2
    }]);
  });
});
