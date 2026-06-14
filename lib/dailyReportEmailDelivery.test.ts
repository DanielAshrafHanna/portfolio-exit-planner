import { describe, expect, it, vi } from "vitest";
import { sendOptedInDailyReportEmails } from "./dailyReportEmailDelivery";
import type { CloudPortfolioRow } from "./cloudPortfolio";
import type { UserSnapshotResult } from "./portfolioSnapshotJobs";

vi.mock("./emailReport", () => ({
  sendDailyReportEmail: vi.fn(async () => ({ configured: true, sent: true }))
}));

vi.mock("./portfolioReportHistory", () => ({
  fetchUserWeeklyChartSeries: vi.fn(async () => []),
  snapshotHistoryRowsFromReport: vi.fn(() => [])
}));

import { sendDailyReportEmail } from "./emailReport";
import { fetchUserWeeklyChartSeries } from "./portfolioReportHistory";

const portfolioRow: CloudPortfolioRow = {
  user_id: "user-1",
  holdings: [],
  settings: {
    dailyReportEmail: "user@example.com",
    dailyReportEmailEnabled: true
  }
};

const report = {
  generatedAt: "2026-06-13T22:00:00.000Z",
  totalsByCurrency: [],
  profiles: [],
  holdings: [],
  warnings: [],
  textDigest: "summary",
  htmlDigest: "<p>summary</p>"
};

describe("sendOptedInDailyReportEmails", () => {
  it("skips cron emails when the close-of-day snapshot did not succeed in the same run", async () => {
    const snapshotResults: UserSnapshotResult[] = [{
      userId: "user-1",
      ok: false,
      skipped: false,
      error: "quote fetch failed"
    }];

    const summary = await sendOptedInDailyReportEmails(
      {} as never,
      snapshotResults,
      [portfolioRow],
      { requireSuccessfulSnapshot: true }
    );

    expect(summary.sent).toBe(0);
    expect(summary.results[0]?.skipReason).toBe("snapshot_failed");
    expect(sendDailyReportEmail).not.toHaveBeenCalled();
  });

  it("merges fresh snapshot rows into chart history before sending after US close", async () => {
    const snapshotResults: UserSnapshotResult[] = [{
      userId: "user-1",
      ok: true,
      skipped: false,
      report
    }];

    await sendOptedInDailyReportEmails(
      {} as never,
      snapshotResults,
      [portfolioRow],
      {
        now: new Date("2026-06-13T22:00:00.000Z"),
        requireSuccessfulSnapshot: true
      }
    );

    expect(fetchUserWeeklyChartSeries).toHaveBeenCalledWith(
      {},
      "user-1",
      portfolioRow,
      expect.objectContaining({
        freshSnapshots: [],
        now: new Date("2026-06-13T22:00:00.000Z")
      })
    );
    expect(sendDailyReportEmail).toHaveBeenCalled();
  });
});
