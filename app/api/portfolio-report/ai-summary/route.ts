import { NextResponse } from "next/server";
import { profilesFromCloudPortfolioRow, type CloudPortfolioRow } from "@/lib/cloudPortfolio";
import { buildPortfolioReport } from "@/lib/portfolioReport";
import { buildDailyPortfolioAiSummaries } from "@/lib/portfolioAiSummary";
import { defaultProfiles } from "@/lib/profileUtils";
import { bearerTokenFromRequest, createSupabaseUserClient } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(request: Request) {
  const accessToken = bearerTokenFromRequest(request);
  if (!accessToken) {
    return NextResponse.json({ error: "Sign in to view portfolio analysis." }, { status: 401 });
  }

  try {
    const supabase = createSupabaseUserClient(accessToken);
    const { data: authData, error: authError } = await supabase.auth.getUser(accessToken);
    const user = authData.user;
    if (authError || !user) {
      return NextResponse.json({ error: "Session expired. Sign in again." }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("user_portfolios")
      .select("holdings, settings, user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: `Portfolio analysis failed to load: ${error.message}` }, { status: 500 });
    }

    const row = data as CloudPortfolioRow | null;
    const profiles = row ? profilesFromCloudPortfolioRow(row) : defaultProfiles();
    const report = await buildPortfolioReport(profiles, { freshQuotes: true });
    const summaries = await buildDailyPortfolioAiSummaries(report);

    return NextResponse.json({
      generatedAt: report.generatedAt,
      summaries
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Portfolio analysis failed."
    }, { status: 500 });
  }
}
