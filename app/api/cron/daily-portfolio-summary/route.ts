import { NextResponse } from "next/server";
import { sendOptedInDailyReportEmails } from "@/lib/dailyReportEmailDelivery";
import { runDailyPortfolioSnapshotsForAllUsers } from "@/lib/portfolioSnapshotJobs";
import { createSupabaseAdminClient } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 503 });
  }

  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const freshQuotes = new URL(request.url).searchParams.get("fresh") === "1";
    const now = new Date();
    const supabase = createSupabaseAdminClient();

    // Always snapshot first. Emails run only on the US market-close cron (fresh=1),
    // after every user's close-of-day snapshot finishes in this same request.
    const summary = await runDailyPortfolioSnapshotsForAllUsers(supabase, {
      shareQuoteCache: !freshQuotes,
      freshQuotes,
      now
    });

    const emails = freshQuotes
      ? await sendOptedInDailyReportEmails(supabase, summary.results, summary.portfolioRows, {
        now,
        requireSuccessfulSnapshot: true
      })
      : {
        configured: Boolean(process.env.RESEND_API_KEY && process.env.REPORT_FROM_EMAIL),
        attempted: 0,
        sent: 0,
        failed: 0,
        skipped: 0,
        results: [],
        warning: "Daily emails are sent after the US market-close cron run (fresh=1)."
      };

    return NextResponse.json({
      ok: summary.failed === 0 && emails.failed === 0,
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
      emails
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Daily portfolio summary failed."
    }, { status: 500 });
  }
}
