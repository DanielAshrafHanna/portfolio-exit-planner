import { z } from "zod";
import { fallbackAnalysis } from "./aiFallback";
import type { AiAnalysis, HoldingInput, MarketQuote, NewsItem } from "./types";

const cleanString = (maxLength: number) => z.string().trim().max(maxLength);
const finiteNumber = z.number().finite();
const nonNegativeNumber = finiteNumber.min(0);

export const marketRegionSchema = z.enum(["US", "EG"]);

export const feeSettingsSchema = z.object({
  fixedTradingFee: nonNegativeNumber.catch(0),
  percentTradingFee: nonNegativeNumber.catch(0),
  fxFeePercent: nonNegativeNumber.catch(0)
});

export const holdingInputSchema = z.object({
  id: cleanString(100).min(1),
  symbol: cleanString(24).min(1).transform((value) => value.toUpperCase()),
  name: cleanString(160).catch(""),
  shares: nonNegativeNumber,
  averageCost: nonNegativeNumber,
  totalCost: nonNegativeNumber,
  brokerCurrentValue: nonNegativeNumber.optional(),
  notes: cleanString(1000).optional()
});

export const marketQuoteSchema = z.object({
  symbol: cleanString(24).min(1).transform((value) => value.toUpperCase()),
  currentPrice: finiteNumber.positive(),
  dailyChangePercent: finiteNumber,
  previousClose: finiteNumber.min(0),
  week52High: finiteNumber.min(0).optional(),
  week52Low: finiteNumber.min(0).optional(),
  volume: finiteNumber.min(0).optional(),
  ma20: finiteNumber.min(0).optional(),
  ma50: finiteNumber.min(0).optional(),
  ma200: finiteNumber.min(0).optional(),
  atr: finiteNumber.min(0).optional(),
  rsi: finiteNumber.min(0).max(100).optional(),
  provider: cleanString(80).min(1),
  stale: z.boolean().optional(),
  error: cleanString(500).optional()
});

export const newsItemSchema = z.object({
  headline: cleanString(300).min(1),
  source: cleanString(120).min(1),
  date: cleanString(80).min(1),
  url: cleanString(1000).min(1),
  summary: cleanString(1000).catch("No summary provided.")
});

const actionSchema = z.enum(["Keep", "Watch", "Trim", "Sell"]);
const confidenceSchema = z.enum(["Low", "Medium", "High"]);
const riskLevelSchema = z.enum(["Low", "Medium", "High", "Very High"]);
const sentimentSchema = z.enum(["Positive", "Neutral", "Negative", "Mixed", "Unknown"]);
const trendSchema = z.enum(["Bullish", "Neutral", "Bearish", "Unknown"]);
const assetTypeSchema = z.enum(["Stock", "ETF", "Unknown"]);

export const aiAnalysisSchema = z.object({
  symbol: cleanString(24).min(1).transform((value) => value.toUpperCase()),
  assetType: assetTypeSchema,
  action: actionSchema,
  confidence: confidenceSchema,
  riskLevel: riskLevelSchema,
  newsSentiment: sentimentSchema,
  trendStatus: trendSchema,
  upcomingCatalysts: z.array(z.object({
    name: cleanString(160).min(1),
    date: cleanString(80).nullable(),
    importance: z.enum(["Low", "Medium", "High"]),
    sourceUrl: cleanString(1000)
  })).default([]),
  summary: cleanString(500).min(1),
  reasonsToHold: z.array(cleanString(300).min(1)).default([]),
  reasonsToSell: z.array(cleanString(300).min(1)).default([]),
  riskFlags: z.array(cleanString(300).min(1)).default([]),
  suggestedActionPlan: z.object({
    primaryAction: actionSchema,
    explanation: cleanString(500).min(1),
    suggestedStopLoss: finiteNumber.positive(),
    suggestedTakeProfit: finiteNumber.positive(),
    reviewAfterCatalyst: z.boolean()
  }),
  sourcesUsed: z.array(z.object({
    title: cleanString(300).min(1),
    publisher: cleanString(120).min(1),
    date: cleanString(80).min(1),
    url: cleanString(1000).min(1)
  })).default([])
});

export const marketRequestSchema = z.object({
  region: marketRegionSchema.default("US"),
  symbols: z.array(cleanString(24).min(1)).max(50).optional(),
  holdings: z.array(z.object({
    symbol: cleanString(24).min(1),
    region: marketRegionSchema.optional()
  })).max(50).optional()
}).refine((value) => Boolean(value.symbols?.length || value.holdings?.length), {
  message: "symbols or holdings must be a non-empty array"
});

export const analysisRequestSchema = z.object({
  holding: holdingInputSchema,
  quote: marketQuoteSchema,
  news: z.array(newsItemSchema).max(12).default([])
});

export type MarketRequest = z.infer<typeof marketRequestSchema>;
export type AnalysisRequest = z.infer<typeof analysisRequestSchema>;

export function normalizeAiAnalysis(
  value: unknown,
  holding: HoldingInput,
  quote: MarketQuote,
  news: NewsItem[]
): { analysis: AiAnalysis; warning?: string } {
  const parsed = aiAnalysisSchema.safeParse(value);
  if (parsed.success) return { analysis: parsed.data };
  return {
    analysis: fallbackAnalysis(holding, quote, news),
    warning: "AI returned malformed analysis JSON. Showing low-confidence deterministic fallback analysis."
  };
}
