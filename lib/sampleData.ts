import type { HoldingInput, MarketQuote, NewsItem } from "./types";

export const sampleHoldings: HoldingInput[] = [
  { id: "tsm", symbol: "TSM", name: "Taiwan Semiconductor Manufacturing", shares: 8, averageCost: 142.5, totalCost: 1140, notes: "Sample holding" },
  { id: "ibm", symbol: "IBM", name: "International Business Machines", shares: 5, averageCost: 188, totalCost: 940, notes: "Sample holding" },
  { id: "dram", symbol: "DRAM", name: "Sample DRAM Theme ETF", shares: 20, averageCost: 21.75, totalCost: 435, notes: "Sample ticker-like demo row" },
  { id: "nasa", symbol: "NASA", name: "Sample Space Theme ETF", shares: 15, averageCost: 31.2, totalCost: 468, notes: "Sample ticker-like demo row" }
];

export function mockQuote(symbol: string): MarketQuote {
  const seed = symbol.split("").reduce((sum, letter) => sum + letter.charCodeAt(0), 0);
  const currentPrice = Math.round((45 + (seed % 180) + (seed % 7) * 0.37) * 100) / 100;
  return {
    symbol,
    currentPrice,
    dailyChangePercent: Math.round((((seed % 11) - 5) / 2) * 100) / 100,
    previousClose: Math.round(currentPrice * (1 - (((seed % 11) - 5) / 200)) * 100) / 100,
    week52High: Math.round(currentPrice * 1.24 * 100) / 100,
    week52Low: Math.round(currentPrice * 0.72 * 100) / 100,
    volume: 600000 + seed * 2301,
    ma20: Math.round(currentPrice * (0.98 + (seed % 3) / 100) * 100) / 100,
    ma50: Math.round(currentPrice * (0.95 + (seed % 5) / 100) * 100) / 100,
    ma200: Math.round(currentPrice * (0.9 + (seed % 8) / 100) * 100) / 100,
    atr: Math.round(currentPrice * (0.025 + (seed % 4) / 1000) * 100) / 100,
    rsi: 38 + (seed % 34),
    provider: "mock",
    stale: true
  };
}

export function mockNews(symbol: string): NewsItem[] {
  return [
    {
      headline: `${symbol} market update uses sample data`,
      source: "Demo provider",
      date: new Date().toISOString(),
      url: "https://example.com/demo-news",
      summary: "API keys are not configured, so this row is using sample news."
    }
  ];
}
