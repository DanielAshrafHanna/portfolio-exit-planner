import type { EnrichedHolding, MarketQuote } from "./types";

export function quoteCompanyName(quote?: MarketQuote) {
  return quote?.companyName?.trim() || "";
}

export function holdingDisplayName(holding: EnrichedHolding) {
  return holding.name.trim() || quoteCompanyName(holding.quote);
}

export function applyCompanyNameToHolding(holding: EnrichedHolding, quote?: MarketQuote) {
  const companyName = quoteCompanyName(quote || holding.quote);
  if (!companyName || holding.name.trim()) return holding;
  return { ...holding, name: companyName };
}
