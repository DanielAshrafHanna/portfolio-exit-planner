import { NextResponse } from "next/server";
import { profilesFromCloudPortfolioRow, type CloudPortfolioRow } from "@/lib/cloudPortfolio";
import { dailyAiCacheFromCloudRow } from "@/lib/dailyAiPersistence";
import { runAndPersistDailyAiForUser } from "@/lib/dailyAiJobs";
import { batchItemsFromHoldings, rehydrateFallbackCacheEntry } from "@/lib/dailyAiCache";
import { buildPortfolioReport } from "@/lib/portfolioReport";
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
    const cache = row ? dailyAiCacheFromCloudRow(row) : { entries: {}, usageByMarketDate: {} };
    const summaries = profiles.flatMap((profile) => {
      const entry = cache.entries[profile.id];
      if (!entry) return [];
      const hydrated = rehydrateFallbackCacheEntry(entry, batchItemsFromHoldings(profile.holdings));
      return [{
        profileId: profile.id,
        profileName: profile.name,
        summary: hydrated.summary,
        fallback: hydrated.fallback,
        cached: true,
        generatedAt: hydrated.generatedAt,
        warning: hydrated.fallback
          ? "AI commentary unavailable — showing data-only analysis from your saved quotes."
          : undefined
      }];
    });

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      summaries,
      fromCache: summaries.length > 0
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Portfolio analysis failed."
    }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const accessToken = bearerTokenFromRequest(request);
  if (!accessToken) {
    return NextResponse.json({ error: "Sign in to refresh portfolio analysis." }, { status: 401 });
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
      .select("holdings, settings, display_name, share_holdings, user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json({ error: error?.message || "Portfolio not found." }, { status: 500 });
    }

    const row = data as CloudPortfolioRow;
    const profiles = profilesFromCloudPortfolioRow(row);
    const report = await buildPortfolioReport(profiles, { freshQuotes: true });
    const aiRun = await runAndPersistDailyAiForUser(supabase, user.id, row, report, {
      runType: "manual",
      force: true
    });
    const quotaWarning = aiRun.warnings.find((warning) => warning.includes("Gemini daily quota") || warning.includes("429"));
    const summaries = aiRun.summaries.map((summary) => {
      const profile = profiles.find((item) => item.id === summary.profileId);
      if (!profile || !summary.fallback) return summary;
      const hydrated = rehydrateFallbackCacheEntry({
        profileId: profile.id,
        profileName: profile.name,
        marketDate: new Date().toISOString().slice(0, 10),
        generatedAt: report.generatedAt,
        summary: summary.summary,
        analysesBySymbol: {},
        fallback: true,
        runType: "manual"
      }, batchItemsFromHoldings(profile.holdings));
      return {
        ...summary,
        summary: hydrated.summary,
        warning: summary.warning || quotaWarning
      };
    });

    return NextResponse.json({
      generatedAt: report.generatedAt,
      summaries,
      fromCache: false,
      warnings: aiRun.warnings
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Portfolio analysis failed."
    }, { status: 500 });
  }
}
