import { NextResponse } from "next/server";
import { buildPortfolioReport, type PortfolioReport } from "@/lib/portfolioReport";
import { profilesFromCloudPortfolioRow, type CloudPortfolioRow } from "@/lib/cloudPortfolio";
import { runDailyPortfolioSnapshotsForAllUsers } from "@/lib/portfolioSnapshotJobs";
import { createSupabaseAdminClient } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type EmailResult = {
  configured: boolean;
  sent: boolean;
  warning?: string;
};

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 503 });
  }

  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createSupabaseAdminClient();
    const summary = await runDailyPortfolioSnapshotsForAllUsers(supabase, {
      shareQuoteCache: true
    });

    const emailUserId = process.env.PORTFOLIO_REPORT_USER_ID?.trim();
    const emailReport = emailUserId
      ? await resolveEmailReport(supabase, summary.results, emailUserId)
      : undefined;
    const email = emailReport ? await sendReportEmail(emailReport) : {
      configured: false,
      sent: false,
      warning: emailUserId
        ? "Email report user has no saved holdings snapshot in this run."
        : "Set PORTFOLIO_REPORT_USER_ID to email one daily summary."
    };

    return NextResponse.json({
      ok: summary.failed === 0,
      snapshots: {
        totalUsers: summary.totalUsers,
        processed: summary.processed,
        skipped: summary.skipped,
        failed: summary.failed
      },
      failures: summary.results
        .filter((result) => !result.ok)
        .map((result) => ({ userId: result.userId, error: result.error })),
      snapshotWarnings: summary.results
        .map((result) => result.snapshotWarning)
        .filter((warning): warning is string => Boolean(warning)),
      emailed: email.sent,
      emailWarning: email.warning,
      report: emailReport
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Daily portfolio summary failed."
    }, { status: 500 });
  }
}

async function resolveEmailReport(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  results: Awaited<ReturnType<typeof runDailyPortfolioSnapshotsForAllUsers>>["results"],
  emailUserId: string
): Promise<PortfolioReport | undefined> {
  const existing = results.find((result) => result.userId === emailUserId && result.report);
  if (existing?.report) return existing.report;

  const { data, error } = await supabase
    .from("user_portfolios")
    .select("holdings, settings, display_name, share_holdings, updated_at, user_id")
    .eq("user_id", emailUserId)
    .maybeSingle();

  if (error || !data) return undefined;
  return buildPortfolioReport(profilesFromCloudPortfolioRow(data as CloudPortfolioRow));
}

async function sendReportEmail(report: PortfolioReport): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = splitEmailList(process.env.REPORT_TO_EMAIL);
  const from = process.env.REPORT_FROM_EMAIL;
  if (!apiKey || !to.length || !from) {
    return {
      configured: false,
      sent: false,
      warning: "Email delivery is not configured. Add RESEND_API_KEY, REPORT_TO_EMAIL, and REPORT_FROM_EMAIL to send the daily report."
    };
  }

  const subjectDate = new Date(report.generatedAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
      to,
      subject: `Daily Portfolio Summary - ${subjectDate}`,
      text: report.textDigest,
      html: report.htmlDigest
    })
  });

  if (!response.ok) {
    const message = await response.text();
    return {
      configured: true,
      sent: false,
      warning: `Email delivery failed: ${message || response.statusText}`
    };
  }

  return { configured: true, sent: true };
}

function splitEmailList(value?: string) {
  return (value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
