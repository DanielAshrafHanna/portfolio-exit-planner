import { NextResponse } from "next/server";
import { fallbackAnalysis } from "@/lib/aiFallback";
import {
  batchResultsFromCacheEntry,
  cacheEntryForProfile,
  dailyAiCacheFromCloudRow
} from "@/lib/dailyAiPersistence";
import { rehydrateFallbackCacheEntry } from "@/lib/dailyAiCache";
import { type CloudPortfolioRow } from "@/lib/cloudPortfolio";
import { bearerTokenFromRequest, createSupabaseUserClient } from "@/lib/supabaseServer";
import { portfolioAnalysisRequestSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

const NO_CACHE_WARNING = "No daily AI cache for today. Full AI commentary runs automatically at market close (1 Gemini call per profile).";

export async function POST(request: Request) {
  const body = await safeJson(request);
  const parsed = portfolioAnalysisRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid analysis request" }, { status: 400 });
  }
  const { items, region, profileId, force } = parsed.data;

  if (!items.length) {
    return NextResponse.json({ error: "No holdings to analyze." }, { status: 400 });
  }

  if (force) {
    return NextResponse.json({
      error: "Manual AI refresh is disabled. Daily analysis runs automatically at market close."
    }, { status: 403 });
  }

  const accessToken = bearerTokenFromRequest(request);
  if (accessToken && profileId) {
    try {
      const supabase = createSupabaseUserClient(accessToken);
      const { data: authData } = await supabase.auth.getUser(accessToken);
      const userId = authData.user?.id ?? null;
      if (userId) {
        const { data } = await supabase
          .from("user_portfolios")
          .select("holdings, settings, display_name, share_holdings, user_id")
          .eq("user_id", userId)
          .maybeSingle();
        if (data) {
          const cloudRow = data as CloudPortfolioRow;
          const cache = dailyAiCacheFromCloudRow(cloudRow);
          const cacheEntry = cacheEntryForProfile(cache, profileId, region);
          if (cacheEntry) {
            const hydrated = rehydrateFallbackCacheEntry(cacheEntry, items);
            return NextResponse.json({
              results: batchResultsFromCacheEntry(hydrated, items.map((item) => item.holding)),
              summary: hydrated.summary,
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
        }
      }
    } catch {
      // Fall through to client cache / data-only fallback.
    }
  }

  const cache = parseClientCache(body);
  const cacheEntry = profileId ? cacheEntryForProfile(cache, profileId, region) : undefined;
  if (cacheEntry) {
    const hydrated = rehydrateFallbackCacheEntry(cacheEntry, items);
    return NextResponse.json({
      results: batchResultsFromCacheEntry(hydrated, items.map((item) => item.holding)),
      summary: hydrated.summary,
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

  return NextResponse.json({
    results: items.map((item) => ({
      id: item.holding.id,
      analysis: fallbackAnalysis(item.holding, item.quote, item.news),
      fallback: true
    })),
    cached: false,
    warning: NO_CACHE_WARNING
  });
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
