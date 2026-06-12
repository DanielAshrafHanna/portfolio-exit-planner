import { NextResponse } from "next/server";
import { fallbackAnalysis } from "@/lib/aiFallback";
import { formatGeminiError, generateGeminiJson, isGeminiConfigured } from "@/lib/geminiClient";
import { analysisRequestSchema, normalizeAiAnalysis } from "@/lib/validation";

const ANALYSIS_SYSTEM_INSTRUCTION = "You are a cautious portfolio analysis assistant. Analyze this stock/ETF using only the provided market data, technical indicators, portfolio cost basis, supplied news headlines, and supplied catalysts. Do not invent facts, news, earnings dates, IPO dates, analyst changes, or catalysts. If no reliable catalyst is found, return upcomingCatalysts as [] and include the phrase No verified upcoming catalyst found. Return JSON only. Recommend one of Keep, Watch, Trim, Sell. Explain bull and bear cases clearly. Do not give guarantees. Do not say this is financial advice.";

export async function POST(request: Request) {
  const body = await safeJson(request);
  const parsed = analysisRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid analysis request" }, { status: 400 });
  }
  const { holding, quote, news } = parsed.data;

  if (!isGeminiConfigured()) {
    return NextResponse.json({
      analysis: fallbackAnalysis(holding, quote, news),
      warning: "GEMINI_API_KEY is missing. Showing low-confidence deterministic analysis."
    });
  }

  try {
    const raw = await generateGeminiJson({
      systemInstruction: ANALYSIS_SYSTEM_INSTRUCTION,
      userContent: JSON.stringify({
        requiredSchema: {
          symbol: "string",
          assetType: "Stock | ETF | Unknown",
          action: "Keep | Watch | Trim | Sell",
          confidence: "Low | Medium | High",
          riskLevel: "Low | Medium | High | Very High",
          newsSentiment: "Positive | Neutral | Negative | Mixed | Unknown",
          trendStatus: "Bullish | Neutral | Bearish | Unknown",
          upcomingCatalysts: [{ name: "string", date: "string or null", importance: "Low | Medium | High", sourceUrl: "string" }],
          summary: "short plain-English summary",
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
        },
        decisionLogic: [
          "If news is positive, trend is strong, and upcoming catalyst is meaningful, prefer Keep or Watch.",
          "If the stock is up significantly but news is uncertain, prefer Trim or use trailing stop.",
          "If the stock is down, trend is bearish, and no clear catalyst exists, prefer Sell or Watch with strict stop-loss.",
          "If there is a major upcoming catalyst, suggest whether to hold until the catalyst or reduce risk before it.",
          "For ETFs, analyze supplied ETF holdings, sector/theme exposure, expense ratio, and concentration risk only if present."
        ],
        holding,
        quote,
        news,
        suppliedCatalysts: []
      })
    });
    const decoded = safeParseJson(raw);
    const normalized = normalizeAiAnalysis(decoded, holding, quote, news);
    return NextResponse.json(normalized);
  } catch (error) {
    return NextResponse.json({
      analysis: fallbackAnalysis(holding, quote, news),
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

function safeParseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}
