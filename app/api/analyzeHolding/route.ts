import OpenAI from "openai";
import { NextResponse } from "next/server";
import { z } from "zod";
import { fallbackAnalysis } from "@/lib/aiFallback";

const requestSchema = z.object({
  holding: z.any(),
  quote: z.any(),
  news: z.array(z.any()).default([])
});

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid analysis request" }, { status: 400 });
  const { holding, quote, news } = parsed.data;

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({
      analysis: fallbackAnalysis(holding, quote, news),
      warning: "OPENAI_API_KEY is missing. Showing low-confidence deterministic analysis."
    });
  }

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      response_format: { type: "json_object" },
      temperature: 0.1,
      messages: [
        {
          role: "system",
          content: "You are a cautious portfolio analysis assistant. Analyze this stock/ETF using only the provided market data, technical indicators, portfolio cost basis, supplied news headlines, and supplied catalysts. Do not invent facts, news, earnings dates, IPO dates, analyst changes, or catalysts. If no reliable catalyst is found, return upcomingCatalysts as [] and include the phrase No verified upcoming catalyst found. Return JSON only. Recommend one of Keep, Watch, Trim, Sell. Explain bull and bear cases clearly. Do not give guarantees. Do not say this is financial advice."
        },
        {
          role: "user",
          content: JSON.stringify({
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
        }
      ]
    });
    const raw = completion.choices[0]?.message.content || "{}";
    return NextResponse.json({ analysis: JSON.parse(raw) });
  } catch (error) {
    return NextResponse.json({
      analysis: fallbackAnalysis(holding, quote, news),
      warning: `AI analysis unavailable: ${error instanceof Error ? error.message : "Unknown error"}`
    });
  }
}
