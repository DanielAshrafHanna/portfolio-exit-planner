import type { SupabaseClient } from "@supabase/supabase-js";
import { cloudSettingsFromRow, type CloudPortfolioRow } from "./cloudPortfolio";
import { dailyReportEmailPrefsFromSettings, shouldSendDailyReportEmail } from "./dailyReportEmailPrefs";
import { sendDailyReportEmail } from "./emailReport";
import { fetchUserWeeklyChartSeries } from "./portfolioReportHistory";
import type { UserSnapshotResult } from "./portfolioSnapshotJobs";

export type DailyEmailRecipientResult = {
  userId: string;
  email: string;
  sent: boolean;
  skipped?: boolean;
  skipReason?: string;
  warning?: string;
};

export type DailyEmailRunSummary = {
  configured: boolean;
  attempted: number;
  sent: number;
  failed: number;
  skipped: number;
  results: DailyEmailRecipientResult[];
  warning?: string;
};

export async function sendOptedInDailyReportEmails(
  supabase: SupabaseClient,
  snapshotResults: UserSnapshotResult[],
  portfolioRows: CloudPortfolioRow[],
  options: { now?: Date } = {}
): Promise<DailyEmailRunSummary> {
  const apiConfigured = Boolean(process.env.RESEND_API_KEY && process.env.REPORT_FROM_EMAIL);
  const results: DailyEmailRecipientResult[] = [];
  const now = options.now ?? new Date();

  for (const row of portfolioRows) {
    const userId = row.user_id;
    if (!userId) continue;

    const prefs = dailyReportEmailPrefsFromSettings(cloudSettingsFromRow(row));
    if (!shouldSendDailyReportEmail(prefs)) {
      results.push({
        userId,
        email: prefs.dailyReportEmail,
        sent: false,
        skipped: true,
        skipReason: prefs.dailyReportEmail ? "disabled" : "not_configured"
      });
      continue;
    }

    const snapshot = snapshotResults.find((result) => result.userId === userId);
    if (!snapshot?.report) {
      results.push({
        userId,
        email: prefs.dailyReportEmail,
        sent: false,
        skipped: true,
        skipReason: "no_report"
      });
      continue;
    }

    const series = await fetchUserWeeklyChartSeries(supabase, userId, row, { now });
    const delivery = await sendDailyReportEmail({
      to: prefs.dailyReportEmail,
      report: snapshot.report,
      series,
      displayName: row.display_name || undefined
    });

    results.push({
      userId,
      email: prefs.dailyReportEmail,
      sent: delivery.sent,
      warning: delivery.warning
    });
  }

  const attempted = results.filter((result) => !result.skipped).length;
  const sent = results.filter((result) => result.sent).length;
  const failed = results.filter((result) => !result.sent && !result.skipped).length;
  const skipped = results.filter((result) => result.skipped).length;

  return {
    configured: apiConfigured,
    attempted,
    sent,
    failed,
    skipped,
    results,
    warning: apiConfigured
      ? undefined
      : "Email delivery is not configured. Add RESEND_API_KEY and REPORT_FROM_EMAIL."
  };
}
