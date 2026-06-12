import { NextResponse } from "next/server";
import { profilesFromCloudPortfolioRow, type CloudPortfolioRow } from "@/lib/cloudPortfolio";
import { buildPortfolioReport, type PortfolioReport } from "@/lib/portfolioReport";
import { createSupabaseAdminClient } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

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

  const targetUserId = process.env.PORTFOLIO_REPORT_USER_ID;
  if (!targetUserId) {
    return NextResponse.json({ error: "PORTFOLIO_REPORT_USER_ID is not configured." }, { status: 503 });
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("user_portfolios")
      .select("holdings, settings, display_name, share_holdings, updated_at, user_id")
      .eq("user_id", targetUserId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: `Portfolio row failed to load: ${error.message}` }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: "No cloud portfolio exists for PORTFOLIO_REPORT_USER_ID." }, { status: 404 });
    }

    const report = await buildPortfolioReport(profilesFromCloudPortfolioRow(data as CloudPortfolioRow));
    const email = await sendReportEmail(report);

    return NextResponse.json({
      ok: true,
      emailed: email.sent,
      emailWarning: email.warning,
      report
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Daily portfolio summary failed."
    }, { status: 500 });
  }
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
