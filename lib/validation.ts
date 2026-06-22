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
  dayHigh: finiteNumber.min(0).optional(),
  dayLow: finiteNumber.min(0).optional(),
  companyName: cleanString(160).optional(),
  week52High: finiteNumber.min(0).optional(),
  week52Low: finiteNumber.min(0).optional(),
  volume: finiteNumber.min(0).optional(),
  ma20: finiteNumber.min(0).optional(),
  ma50: finiteNumber.min(0).optional(),
  ma200: finiteNumber.min(0).optional(),
  atr: finiteNumber.min(0).optional(),
  rsi: finiteNumber.min(0).max(100).optional(),
  provider: cleanString(80).min(1),
  priceSession: z.enum(["pre", "regular", "post", "closed"]).optional(),
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

/** Keep prompts bounded; truncate excess headlines instead of rejecting the request. */
export const cappedNewsListSchema = z.array(newsItemSchema).transform((items) => items.slice(0, 12));

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
  quotesOnly: z.boolean().optional(),
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
  news: cappedNewsListSchema.default([])
});

export const portfolioAnalysisItemSchema = z.object({
  holding: holdingInputSchema,
  quote: marketQuoteSchema,
  news: cappedNewsListSchema.default([])
});

export const portfolioAnalysisRequestSchema = z.object({
  region: marketRegionSchema.default("US"),
  currency: z.enum(["USD", "EGP"]).default("USD"),
  profileId: cleanString(100).optional(),
  force: z.boolean().optional(),
  clientDailyAiCache: z.unknown().optional(),
  items: z.array(portfolioAnalysisItemSchema).min(1).max(50)
});

export const dailyPortfolioSummarySchema = z.object({
  overview: cleanString(1200).min(1),
  marketContext: cleanString(800).catch(""),
  holdings: z.array(z.object({
    symbol: cleanString(24).min(1).transform((value) => value.toUpperCase()),
    action: actionSchema,
    note: cleanString(400).min(1)
  })).default([]),
  watchItems: z.array(cleanString(300).min(1)).default([]),
  sources: z.array(z.object({
    title: cleanString(300).min(1),
    publisher: cleanString(160).catch(""),
    url: cleanString(1000).min(1)
  })).default([])
});

export type MarketRequest = z.infer<typeof marketRequestSchema>;
export type AnalysisRequest = z.infer<typeof analysisRequestSchema>;
export type PortfolioAnalysisRequest = z.infer<typeof portfolioAnalysisRequestSchema>;
export type DailyPortfolioSummary = z.infer<typeof dailyPortfolioSummarySchema>;

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

export type BatchAnalysisInput = {
  holding: HoldingInput;
  quote: MarketQuote;
  news: NewsItem[];
};

export type BatchAnalysisResult = {
  id: string;
  analysis: AiAnalysis;
  fallback: boolean;
};

/** Map an AI batch response (array of analyses) back to each requested holding by symbol. */
export function normalizeBatchAiAnalyses(
  value: unknown,
  items: BatchAnalysisInput[]
): { results: BatchAnalysisResult[]; fallbackCount: number } {
  const rawList = extractAnalysisList(value);
  const bySymbol = new Map<string, unknown>();
  for (const entry of rawList) {
    if (entry && typeof entry === "object" && "symbol" in entry) {
      const symbol = String((entry as { symbol?: unknown }).symbol ?? "").trim().toUpperCase();
      if (symbol && !bySymbol.has(symbol)) bySymbol.set(symbol, entry);
    }
  }

  let fallbackCount = 0;
  const results = items.map((item) => {
    const symbol = item.holding.symbol.trim().toUpperCase();
    const candidate = bySymbol.get(symbol);
    const parsed = aiAnalysisSchema.safeParse(candidate);
    if (parsed.success) {
      return { id: item.holding.id, analysis: parsed.data, fallback: false };
    }
    fallbackCount += 1;
    return {
      id: item.holding.id,
      analysis: fallbackAnalysis(item.holding, item.quote, item.news),
      fallback: true
    };
  });

  return { results, fallbackCount };
}

function extractAnalysisList(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (Array.isArray(record.analyses)) return record.analyses;
    if (Array.isArray(record.holdings)) return record.holdings;
    if (Array.isArray(record.results)) return record.results;
  }
  return [];
}
