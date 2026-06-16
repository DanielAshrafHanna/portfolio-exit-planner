import { fallbackAnalysis } from "./aiFallback";
import { extractJsonPayload, generateGeminiGroundedJson, isGeminiConfigured } from "./geminiClient";
import type { PortfolioReportProfile } from "./portfolioReport";
import type { AiAnalysis, HoldingInput, MarketQuote, NewsItem } from "./types";
import {
  dailyPortfolioSummarySchema,
  normalizeBatchAiAnalyses,
  type BatchAnalysisInput,
  type BatchAnalysisResult,
  type DailyPortfolioSummary
} from "./validation";

export type UnifiedProfileAnalysisResult = {
  profileId: string;
  profileName: string;
  generatedAt: string;
  summary: DailyPortfolioSummary;
  results: BatchAnalysisResult[];
  fallback: boolean;
  warning?: string;
};

type GenerateFn = (params: { systemInstruction: string; userContent: string; temperature?: number }) => Promise<string>;

type BuildOptions = {
  generate?: GenerateFn;
  configured?: boolean;
  generatedAt?: string;
};

const UNIFIED_SYSTEM_INSTRUCTION = [
  "You are a cautious market-close portfolio analyst reviewing every holding in one batch.",
  "Use Google Search for real recent and upcoming news, earnings, and catalysts. Never invent facts, dates, or catalysts.",
  "Every news-driven claim must cite a real URL in sourcesUsed or sources. Uncited claims are not allowed.",
  "For each holding return a full analysis object AND include a portfolio-level overview in the same JSON response.",
  "Ground each recommendation in the supplied price data and recent price action: compare the current price to the 20/50/200-day moving averages, RSI, and 52-week range when present, and use Google Search to confirm the recent multi-day trend (for example several consecutive down days, a breakdown below support, or a recovery).",
  "In each holding's summary, explicitly describe the recent trend/history (e.g. 'down 4 of the last 5 sessions and below its 20- and 50-day averages') and then state plainly what to do about it and why.",
  "Set trendStatus from the actual price action, not sentiment. reasonsToHold and reasonsToSell must be concrete and decision-useful.",
  "Recommend exactly one action per holding: Keep, Watch, Trim, or Sell, and make suggestedActionPlan.explanation a clear, plain-English instruction (what to do, at what level, and what would change your mind). No guarantees. Never call this financial advice.",
  "The portfolio overview must read like a short daily brief: how the portfolio moved today, the overall posture, and which holdings most need attention.",
  "Return JSON ONLY matching the provided schema."
].join(" ");

const PER_HOLDING_SCHEMA = {
  symbol: "string (must match requested ticker)",
  assetType: "Stock | ETF | Unknown",
  action: "Keep | Watch | Trim | Sell",
  confidence: "Low | Medium | High",
  riskLevel: "Low | Medium | High | Very High",
  newsSentiment: "Positive | Neutral | Negative | Mixed | Unknown",
  trendStatus: "Bullish | Neutral | Bearish | Unknown (derive from real price action vs moving averages)",
  summary: "2-3 sentences: describe the recent price trend/history (consecutive up/down days, position vs 20/50/200-day MAs and 52-week range) then say plainly what to do and why",
  upcomingCatalysts: [{ name: "string", date: "string or null", importance: "Low | Medium | High", sourceUrl: "string" }],
  reasonsToHold: ["string"],
  reasonsToSell: ["string"],
  riskFlags: ["string"],
  suggestedActionPlan: {
    primaryAction: "Keep | Watch | Trim | Sell",
    explanation: "clear plain-English instruction: what to do now, at what price level, and what would change the decision",
    suggestedStopLoss: "number",
    suggestedTakeProfit: "number",
    reviewAfterCatalyst: "boolean"
  },
  sourcesUsed: [{ title: "string", publisher: "string", date: "string", url: "string" }]
};

const UNIFIED_SCHEMA_HINT = {
  overview: "string (3-6 sentences on how the portfolio moved today and overall posture)",
  marketContext: "string (1-2 sentences on broad market/sector backdrop today)",
  holdings: [{ symbol: "string", action: "Keep | Watch | Trim | Sell", note: "one-line reason tied to today" }],
  watchItems: ["string (confirmed upcoming catalysts or risks to watch)"],
  sources: [{ title: "string", publisher: "string", url: "string" }],
  analyses: [PER_HOLDING_SCHEMA]
};

export function buildAnalysisItemsFromReportProfile(
  profile: PortfolioReportProfile,
  holdings: Array<Pick<HoldingInput, "id" | "symbol" | "name" | "shares" | "averageCost" | "totalCost" | "notes">>
): BatchAnalysisInput[] {
  return profile.holdings.flatMap((reportHolding) => {
    if (reportHolding.currentPrice === undefined) return [];
    const holding = holdings.find((item) => item.symbol.trim().toUpperCase() === reportHolding.symbol.trim().toUpperCase());
    if (!holding) return [];
    const quote: MarketQuote = {
      symbol: reportHolding.symbol.trim().toUpperCase(),
      currentPrice: reportHolding.currentPrice,
      dailyChangePercent: reportHolding.dailyProfitLossPercent,
      previousClose: reportHolding.previousClose ?? reportHolding.currentPrice,
      provider: reportHolding.provider ?? "report"
    };
    return [{
      holding: {
        id: holding.id,
        symbol: holding.symbol,
        name: holding.name || reportHolding.name,
        shares: holding.shares,
        averageCost: holding.averageCost,
        totalCost: holding.totalCost,
        notes: holding.notes
      },
      quote,
      news: [] as NewsItem[]
    }];
  });
}

export async function buildUnifiedProfileAnalysis(
  profile: PortfolioReportProfile,
  items: BatchAnalysisInput[],
  options: BuildOptions = {}
): Promise<UnifiedProfileAnalysisResult> {
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const configured = options.configured ?? isGeminiConfigured();
  const generate = options.generate ?? generateGeminiGroundedJson;

  if (!items.length) {
    return {
      profileId: profile.id,
      profileName: profile.name,
      generatedAt,
      summary: {
        overview: `${profile.name} has no quoted holdings to analyze.`,
        marketContext: "",
        holdings: [],
        watchItems: [],
        sources: []
      },
      results: [],
      fallback: true,
      warning: "No quoted holdings available for AI analysis."
    };
  }

  if (!configured) {
    const results = items.map((item) => ({
      id: item.holding.id,
      analysis: fallbackAnalysis(item.holding, item.quote, item.news),
      fallback: true
    }));
    return {
      profileId: profile.id,
      profileName: profile.name,
      generatedAt,
      summary: buildFallbackSummary(profile, results),
      results,
      fallback: true,
      warning: "GEMINI_API_KEY is missing. Showing low-confidence deterministic analysis."
    };
  }

  try {
    const raw = await generate({
      systemInstruction: UNIFIED_SYSTEM_INSTRUCTION,
      userContent: JSON.stringify({
        requiredSchema: UNIFIED_SCHEMA_HINT,
        instructions: [
          "Analyze EVERY holding below in analyses[] and include portfolio overview fields in the same JSON object.",
          "Set symbol on each analysis to the exact requested ticker.",
          "For each holding, use the provided quote indicators (ma20, ma50, ma200, rsi, week52High, week52Low) and Google Search to establish the recent multi-day price trend, then give a clear keep/sell instruction.",
          "Call out holdings that are falling for several consecutive sessions or breaking below their moving averages, and say what to do.",
          "Keep overview and per-holding notes concise but decision-useful."
        ],
        generatedAt,
        profile: {
          id: profile.id,
          name: profile.name,
          region: profile.region,
          currency: profile.currency,
          totals: profile.totals,
          holdings: profile.holdings.filter((holding) => holding.currentPrice !== undefined).map((holding) => ({
            symbol: holding.symbol,
            name: holding.name,
            currentPrice: holding.currentPrice,
            dailyProfitLoss: holding.dailyProfitLoss,
            dailyProfitLossPercent: holding.dailyProfitLossPercent,
            profitLoss: holding.profitLoss,
            profitLossPercent: holding.profitLossPercent
          }))
        },
        items: items.map((item) => ({
          holding: item.holding,
          quote: item.quote,
          news: item.news
        }))
      })
    });

    const decoded = extractJsonPayload(raw);
    const record = decoded && typeof decoded === "object" ? decoded as Record<string, unknown> : {};
    const summaryParsed = dailyPortfolioSummarySchema.safeParse(record);
    const { results, fallbackCount } = normalizeBatchAiAnalyses(record, items);
    const summary = summaryParsed.success
      ? summaryParsed.data
      : buildFallbackSummary(profile, results);

    return {
      profileId: profile.id,
      profileName: profile.name,
      generatedAt,
      summary,
      results,
      fallback: fallbackCount === items.length,
      warning: fallbackCount > 0 && fallbackCount === items.length
        ? "AI returned malformed analysis JSON. Showing low-confidence deterministic fallback analysis."
        : fallbackCount > 0
          ? `${fallbackCount} holding(s) used fallback analysis because the AI response was incomplete.`
          : undefined
    };
  } catch (error) {
    const results = items.map((item) => ({
      id: item.holding.id,
      analysis: fallbackAnalysis(item.holding, item.quote, item.news),
      fallback: true
    }));
    return {
      profileId: profile.id,
      profileName: profile.name,
      generatedAt,
      summary: buildFallbackSummary(profile, results),
      results,
      fallback: true,
      warning: error instanceof Error ? error.message : "Unified AI analysis unavailable."
    };
  }
}

function buildFallbackSummary(
  profile: PortfolioReportProfile,
  results: BatchAnalysisResult[] = []
): DailyPortfolioSummary {
  const quoted = profile.holdings.filter((holding) => holding.currentPrice !== undefined);
  return {
    overview: `${profile.name} AI commentary is unavailable. Table rows use deterministic fallback analysis.`,
    marketContext: "",
    holdings: results.map((result) => ({
      symbol: result.analysis.symbol,
      action: result.analysis.action,
      note: result.analysis.summary
    })),
    watchItems: quoted.length ? [] : ["No quoted holdings available."],
    sources: []
  };
}

export function analysesBySymbolFromResults(results: BatchAnalysisResult[]): Record<string, AiAnalysis> {
  const map: Record<string, AiAnalysis> = {};
  for (const result of results) {
    const symbol = result.analysis.symbol.trim().toUpperCase();
    if (!map[symbol]) map[symbol] = result.analysis;
  }
  return map;
}
