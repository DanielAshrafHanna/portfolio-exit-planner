import { describe, expect, it } from "vitest";
import { parseMubasherEgxQuote, parseYahooChartQuote } from "./marketData";

describe("Mubasher EGX quote parsing", () => {
  it("reads the current price and previous close from stock pages", () => {
    const quote = parseMubasherEgxQuote(`
      <div class="market-summary__last-price down-icon-only">37.56</div>
      <span class="market-summary__block-text">Previous Close</span>
      <span class="market-summary__block-number">38.02</span>
      <span class="market-summary__block-text">Volume</span>
      <span class="market-summary__block-number">925,568</span>
    `, "ORHD");

    expect(quote).toMatchObject({
      symbol: "ORHD",
      currentPrice: 37.56,
      previousClose: 38.02,
      dailyChangePercent: -1.21,
      volume: 925568,
      provider: "mubasher_egx"
    });
  });
});

describe("Yahoo chart quote parsing", () => {
  it("normalizes valid chart data into a market quote", () => {
    const closes = Array.from({ length: 25 }, (_, index) => 100 + index);
    const quote = parseYahooChartQuote({
      chart: {
        result: [{
          meta: {
            regularMarketPrice: 125.125,
            previousClose: 124,
            regularMarketVolume: 1000
          },
          indicators: {
            quote: [{
              close: closes,
              high: closes.map((value) => value + 1),
              low: closes.map((value) => value - 1),
              volume: closes.map(() => 900)
            }]
          }
        }]
      }
    }, "AAPL");

    expect(quote).toMatchObject({
      symbol: "AAPL",
      currentPrice: 125.13,
      previousClose: 124,
      dailyChangePercent: 0.91,
      volume: 1000,
      provider: "yahoo_finance"
    });
    expect(quote?.ma20).toBeGreaterThan(0);
  });

  it("returns undefined for malformed chart payloads", () => {
    expect(parseYahooChartQuote({ chart: { result: [{ meta: {}, indicators: {} }] } }, "AAPL")).toBeUndefined();
  });
});
