import { NextResponse } from "next/server";
import { fallbackAnalysis } from "@/lib/aiFallback";
import {
  extractJsonPayload,
  formatGeminiError,
  generateGeminiGroundedJson,
  isGeminiConfigured
} from "@/lib/geminiClient";
import { normalizeBatchAiAnalyses, portfolioAnalysisRequestSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const PORTFOLIO_SYSTEM_INSTRUCTION = [
  "You are a cautious, sharp portfolio analysis assistant analyzing a batch of stock/ETF holdings in a single pass.",
  "Use Google Search to find the most recent and any confirmed upcoming news, earnings, product, regulatory, or macro catalysts for each ticker. Prefer reputable, recent sources.",
  "Combine that grounded news with the supplied quote, technical indicators (MA/RSI/ATR/52w), and cost basis to judge trend, momentum, and risk.",
  "Never invent facts, dates, analyst actions, or catalysts. If you cannot verify something, say so and use upcomingCatalysts: [] with the phrase 'No verified upcoming catalyst found.'",
  "Every news-driven claim must be backed by an item in sourcesUsed with a real URL. Cite only sources you actually used.",
  "Recommend exactly one action per holding: Keep, Watch, Trim, or Sell. Give clear, concise bull and bear cases. No guarantees. Never call this financial advice.",
  "Return JSON ONLY in the exact shape: { \"analyses\": [ <one object per requested symbol> ] }."
].join(" ");

const PER_HOLDING_SCHEMA = {
  symbol: "string (must match the requested ticker)",
  assetType: "Stock | ETF | Unknown",
  action: "Keep | Watch | Trim | Sell",
  confidence: "Low | Medium | High",
  riskLevel: "Low | Medium | High | Very High",
  newsSentiment: "Positive | Neutral | Negative | Mixed | Unknown",
  trendStatus: "Bullish | Neutral | Bearish | Unknown",
  upcomingCatalysts: [{ name: "string", date: "string or null", importance: "Low | Medium | High", sourceUrl: "string" }],
  summary: "short plain-English summary (1-2 sentences)",
  reasonsToHold: ["string"],
  reasonsToSell: ["string"],
  riskFlags: ["string"],
  suggestedActionPlan: {
    primaryAction: "Keep | Watch | Trim | Sell",
    explanation: "string",
    suggestedStopLoss: "number",
    suggestedTakeProfit: "number",
    reviewAfterCatalyst: "boolean"
  },
  sourcesUsed: [{ title: "string", publisher: "string", date: "string", url: "string" }]
};

export async function POST(request: Request) {
  const body = await safeJson(request);
  const parsed = portfolioAnalysisRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid analysis request" }, { status: 400 });
  }
  const { items, region, currency } = parsed.data;

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
    const raw = await generateGeminiGroundedJson({
      systemInstruction: PORTFOLIO_SYSTEM_INSTRUCTION,
      userContent: JSON.stringify({
        requiredSchema: { analyses: [PER_HOLDING_SCHEMA] },
        instructions: [
          "Analyze EVERY holding below and return one analysis object per symbol, in the analyses array.",
          "Set symbol to the exact requested ticker so results can be matched back.",
          "Use Google Search for fresh news and confirmed upcoming catalysts per ticker.",
          "For ETFs, focus on sector/theme exposure, concentration, and broad market drivers.",
          "Keep each summary tight and decision-useful."
        ],
        region,
        currency,
        holdings: items.map((item) => ({
          holding: item.holding,
          quote: item.quote,
          news: item.news
        }))
      })
    });

    const decoded = extractJsonPayload(raw);
    const { results, fallbackCount } = normalizeBatchAiAnalyses(decoded, items);
    return NextResponse.json({
      results,
      warning: fallbackCount > 0 && fallbackCount === items.length
        ? "AI returned malformed analysis JSON. Showing low-confidence deterministic fallback analysis."
        : fallbackCount > 0
          ? `${fallbackCount} holding(s) used fallback analysis because the AI response was incomplete.`
          : undefined
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

async function safeJson(request: Request) {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}
