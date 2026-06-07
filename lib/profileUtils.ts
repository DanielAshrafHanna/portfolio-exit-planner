import type { CurrencyCode, FeeSettings, MarketRegion, PortfolioProfile } from "./types";

export const DEFAULT_SETTINGS: FeeSettings = { fixedTradingFee: 0, percentTradingFee: 0, fxFeePercent: 0 };

export function defaultProfiles(): PortfolioProfile[] {
  return [
    {
      id: "us-portfolio",
      name: "US Portfolio",
      region: "US",
      currency: "USD",
      holdings: [],
      settings: DEFAULT_SETTINGS
    },
    {
      id: "eg-portfolio",
      name: "Egypt Portfolio",
      region: "EG",
      currency: "EGP",
      holdings: [],
      settings: DEFAULT_SETTINGS
    }
  ];
}

export function currencyLabel(currency: CurrencyCode) {
  return currency === "EGP" ? "EGP" : "$";
}

export function formatMoney(value: number, currency: CurrencyCode) {
  const formatted = roundForCurrency(value, currency).toLocaleString();
  return currency === "EGP" ? `EGP ${formatted}` : `$${formatted}`;
}

export function roundForCurrency(value: number, currency: CurrencyCode) {
  return currency === "EGP" ? Math.round(value * 100) / 100 : Math.round(value * 100) / 100;
}

export function normalizeMarketSymbol(symbol: string, region: MarketRegion) {
  const cleanSymbol = symbol.trim().toUpperCase();
  if (!cleanSymbol) return "";
  if (region === "EG" && !cleanSymbol.endsWith(".CA")) return `${cleanSymbol}.CA`;
  return cleanSymbol;
}

export function displayMarketSymbol(symbol: string, region: MarketRegion) {
  const cleanSymbol = symbol.trim().toUpperCase();
  if (region === "EG" && cleanSymbol.endsWith(".CA")) return cleanSymbol.slice(0, -3);
  return cleanSymbol;
}
