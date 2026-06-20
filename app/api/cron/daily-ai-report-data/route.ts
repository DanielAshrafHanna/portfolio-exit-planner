import { NextResponse } from "next/server";
import { fetchDailyAiReportData, parseDailyAiReportProfileFilter } from "@/lib/dailyAiReportData";
import { createSupabaseAdminClient } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

function parseHistoryDays(value: string | null) {
  const parsed = Number(value || "30");
  if (!Number.isFinite(parsed) || parsed < 1) return 30;
  return Math.min(Math.floor(parsed), 30);
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 503 });
  }

  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const email = url.searchParams.get("email")?.trim() || "";
  const profileFilter = parseDailyAiReportProfileFilter(url.searchParams.get("profileId"));
  if (!profileFilter) {
    return NextResponse.json({
      error: 'Invalid profileId. Use "all", "us-portfolio", or "eg-portfolio".'
    }, { status: 400 });
  }

  try {
    const supabase = createSupabaseAdminClient();
    const result = await fetchDailyAiReportData(supabase, {
      email,
      profileId: profileFilter,
      historyDays: parseHistoryDays(url.searchParams.get("historyDays")),
      includeReport: url.searchParams.get("report") === "1",
      freshQuotes: url.searchParams.get("fresh") === "1"
    });

    if (result.error || !result.data) {
      return NextResponse.json({ error: result.error }, { status: result.status || 500 });
    }

    return NextResponse.json(result.data);
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Daily AI report data failed."
    }, { status: 500 });
  }
}
