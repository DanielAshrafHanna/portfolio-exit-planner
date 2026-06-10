import type { MarketRegion } from "./types";

const UNSUPPORTED_EG_TICKERS = new Set<string>();

const UNSUPPORTED_EG_MESSAGES: Record<string, string> = {};

export function getUnsupportedTickerMessage(symbol: string, region: MarketRegion = "US") {
  const cleanSymbol = symbol.trim().toUpperCase();
  if (region !== "EG" || !UNSUPPORTED_EG_TICKERS.has(cleanSymbol)) return undefined;
  return UNSUPPORTED_EG_MESSAGES[cleanSymbol] || `${cleanSymbol} is not supported in the Egypt portfolio yet.`;
}

export function isUnsupportedTicker(symbol: string, region: MarketRegion = "US") {
  return getUnsupportedTickerMessage(symbol, region) !== undefined;
}

export function filterUnsupportedHoldings<T extends { symbol: string }>(holdings: T[], region: MarketRegion) {
  return holdings.filter((holding) => !isUnsupportedTicker(holding.symbol, region));
}
