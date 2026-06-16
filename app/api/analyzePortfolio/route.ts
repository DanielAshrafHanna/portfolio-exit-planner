import { NextResponse } from "next/server";
import { fallbackAnalysis } from "@/lib/aiFallback";
import {
  batchResultsFromCacheEntry,
  cacheEntryForProfile,
  dailyAiCacheFromCloudRow,
  persistDailyAiCacheForUser
} from "@/lib/dailyAiPersistence";
import {
  dailyAiCacheEntryFromUnifiedResult,
  upsertDailyAiCacheEntry
} from "@/lib/dailyAiCache";
import { formatGeminiError, isGeminiConfigured } from "@/lib/geminiClient";
import { type CloudPortfolioRow } from "@/lib/cloudPortfolio";
import { bearerTokenFromRequest, createSupabaseUserClient } from "@/lib/supabaseServer";
import { buildUnifiedProfileAnalysis } from "@/lib/unifiedPortfolioAnalysis";
import { portfolioAnalysisRequestSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(request: Request) {
  const body = await safeJson(request);
  const parsed = portfolioAnalysisRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid analysis request" }, { status: 400 });
  }
  const { items, region, currency, profileId, force } = parsed.data;

  if (!items.length) {
    return NextResponse.json({ error: "No holdings to analyze." }, { status: 400 });
  }

  const accessToken = bearerTokenFromRequest(request);
  let cloudRow: CloudPortfolioRow | null = null;
  let userId: string | null = null;
  if (accessToken && profileId) {
    try {
      const supabase = createSupabaseUserClient(accessToken);
      const { data: authData } = await supabase.auth.getUser(accessToken);
      userId = authData.user?.id ?? null;
      if (userId) {
        const { data } = await supabase
          .from("user_portfolios")
          .select("holdings, settings, display_name, share_holdings, user_id")
          .eq("user_id", userId)
          .maybeSingle();
        cloudRow = (data as CloudPortfolioRow | null) ?? null;
      }
    } catch {
      cloudRow = null;
    }
  }

  const cache = cloudRow ? dailyAiCacheFromCloudRow(cloudRow) : parseClientCache(body);
  const cacheEntry = profileId ? cacheEntryForProfile(cache, profileId, region) : undefined;

  if (!force && cacheEntry) {
    return NextResponse.json({
      results: batchResultsFromCacheEntry(cacheEntry, items.map((item) => item.holding)),
      cached: true,
      usage: {
        marketDate: cacheEntry.marketDate,
        runType: cacheEntry.runType,
        generatedAt: cacheEntry.generatedAt
      },
      warning: cacheEntry.fallback
        ? "Showing cached fallback analysis from today's daily run."
        : undefined
    });
  }

  if (!isGeminiConfigured()) {
    return NextResponse.json({
      results: items.map((item) => ({
        id: item.holding.id,
        analysis: fallbackAnalysis(item.holding, item.quote, item.news),
        fallback: true
      })),
      warning: "GEMINI_API_KEY is missing. Showing low-confidence deterministic analysis."
    });
  }

  try {
    const reportProfile = {
      id: profileId || "portfolio",
      name: profileId || "Portfolio",
      region,
      currency,
      totals: {
        currency,
        totalCost: 0,
        currentValue: 0,
        netValue: 0,
        fees: 0,
        profitLoss: 0,
        profitLossPercent: 0,
        dailyProfitLoss: 0,
        dailyProfitLossPercent: 0,
        dailyPriorValue: 0,
        totalGains: 0,
        totalLosses: 0,
        stopProfitLoss: 0,
        targetProfitLoss: 0,
        holdingsCount: items.length,
        quotedHoldingsCount: items.length
      },
      holdings: items.map((item) => ({
        id: item.holding.id,
        symbol: item.holding.symbol,
        name: item.holding.name,
        profileId: profileId || "portfolio",
        profileName: profileId || "Portfolio",
        region,
        currency,
        shares: item.holding.shares,
        averageCost: item.holding.averageCost,
        cost: item.holding.totalCost,
        currentPrice: item.quote.currentPrice,
        previousClose: item.quote.previousClose,
        currentValue: item.quote.currentPrice * item.holding.shares,
        netValue: item.quote.currentPrice * item.holding.shares,
        fees: 0,
        profitLoss: 0,
        profitLossPercent: 0,
        dailyProfitLoss: 0,
        dailyProfitLossPercent: item.quote.dailyChangePercent,
        dailyPriorValue: 0,
        provider: item.quote.provider
      })),
      warnings: [] as string[]
    };

    const unified = await buildUnifiedProfileAnalysis(reportProfile, items);
    const entry = dailyAiCacheEntryFromUnifiedResult(unified, region, force ? "manual" : "automatic");

    if (userId && cloudRow && profileId) {
      const nextCache = upsertDailyAiCacheEntry(cache, entry);
      await persistDailyAiCacheForUser(createSupabaseUserClient(accessToken!), userId, cloudRow, nextCache);
    }

    return NextResponse.json({
      results: unified.results,
      summary: unified.summary,
      cached: false,
      cacheEntry: entry,
      usage: {
        marketDate: entry.marketDate,
        runType: entry.runType,
        generatedAt: entry.generatedAt
      },
      warning: unified.warning
    });
  } catch (error) {
    return NextResponse.json({
      results: items.map((item) => ({
        id: item.holding.id,
        analysis: fallbackAnalysis(item.holding, item.quote, item.news),
        fallback: true
      })),
      warning: formatGeminiError(error)
    });
  }
}

function parseClientCache(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { entries: {}, usageByMarketDate: {} };
  }
  const record = body as Record<string, unknown>;
  const clientCache = record.clientDailyAiCache;
  return dailyAiCacheFromCloudRow({ holdings: [], settings: { dailyAiCache: clientCache } });
}

async function safeJson(request: Request) {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}
