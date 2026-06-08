import type { AiAnalysis, EnrichedHolding, MarketQuote, NewsItem } from "./types";

export type AnalyzedHoldingResult = {
  id: string;
  quote?: MarketQuote;
  news: NewsItem[];
  analysis?: AiAnalysis;
};

export function applyAnalyzedHoldingResults(
  currentItems: EnrichedHolding[],
  results: AnalyzedHoldingResult[]
): EnrichedHolding[] {
  const byId = new Map(results.map((result) => [result.id, result]));
  return currentItems.map((holding) => {
    const result = byId.get(holding.id);
    if (!result) return holding;
    return {
      ...holding,
      quote: result.quote || holding.quote,
      news: result.news.length ? result.news : holding.news,
      analysis: result.analysis || holding.analysis
    };
  });
}

