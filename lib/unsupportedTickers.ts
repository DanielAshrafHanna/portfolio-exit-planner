import type { MarketRegion } from "./types";

/**
 * Egyptian mutual fund tickers on Thndr / EGX (certificate products, not EGX stock pages).
 * Live stock quotes are unavailable for these; block them to avoid mock placeholder prices.
 */
export const EG_MUTUAL_FUND_TICKERS = [
  // Thndr mutual funds (https://thndr.app/support/faq-category/mutual-funds-en-en-en/)
  "ADA", "AEF", "AIS", "ALV", "ASO", "ATD", "AZG", "AZN", "B35", "B70", "BFF", "BMM",
  "C20", "CCM", "CCS", "CGO", "CI30", "CIP", "CMS", "CTQ", "MSI", "MTF", "NAM", "NCS",
  "NMF", "PCM", "PGM", "T70", "ZEM", "ZST",
  // Beltone sectoral funds
  "BCO", "BFI", "BIN", "BRE",
  // CI Asset Management sectoral funds
  "CCB", "CEX", "CFF", "CRE", "CTI"
] as const;

const UNSUPPORTED_EG_TICKERS = new Set<string>(EG_MUTUAL_FUND_TICKERS);

const EG_MUTUAL_FUND_MESSAGE =
  "Egyptian mutual funds are not supported because live market quotes are unavailable. Use your broker app for fund prices, or track EGX stocks and ETFs here.";

export function isEgyptianMutualFundTicker(symbol: string) {
  return UNSUPPORTED_EG_TICKERS.has(symbol.trim().toUpperCase());
}

export function getUnsupportedTickerMessage(symbol: string, region: MarketRegion = "US") {
  const cleanSymbol = symbol.trim().toUpperCase();
  if (region !== "EG" || !UNSUPPORTED_EG_TICKERS.has(cleanSymbol)) return undefined;
  return EG_MUTUAL_FUND_MESSAGE;
}

export function isUnsupportedTicker(symbol: string, region: MarketRegion = "US") {
  return getUnsupportedTickerMessage(symbol, region) !== undefined;
}

export function filterUnsupportedHoldings<T extends { symbol: string }>(holdings: T[], region: MarketRegion) {
  return holdings.filter((holding) => !isUnsupportedTicker(holding.symbol, region));
}
