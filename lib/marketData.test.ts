import { describe, expect, it } from "vitest";
import { parseMubasherEgxQuote, parseYahooChartQuote, resolveYahooLivePrice, yahooMarketSession } from "./marketData";

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
      priceSession: "closed",
      provider: "yahoo_finance"
    });
    expect(quote?.ma20).toBeGreaterThan(0);
  });

  it("returns undefined for malformed chart payloads", () => {
    expect(parseYahooChartQuote({ chart: { result: [{ meta: {}, indicators: {} }] } }, "AAPL")).toBeUndefined();
  });

  it("ignores unreliable chartPreviousClose when daily bars disagree", () => {
    const closes = [...Array.from({ length: 23 }, (_, index) => 260 + index), 290.55, 291.58];
    const quote = parseYahooChartQuote({
      chart: {
        result: [{
          meta: {
            regularMarketPrice: 291.58,
            chartPreviousClose: 202.67,
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

    expect(quote?.currentPrice).toBe(291.58);
    expect(quote?.previousClose).toBe(290.55);
    expect(quote?.dailyChangePercent).toBeCloseTo(0.35, 1);
  });

  it("uses pre-market price when Yahoo reports a pre-market session", () => {
    const closes = Array.from({ length: 5 }, (_, index) => 100 + index);
    const quote = parseYahooChartQuote({
      chart: {
        result: [{
          meta: {
            marketState: "PRE",
            regularMarketPrice: 100,
            preMarketPrice: 101.75,
            previousClose: 99,
            preMarketVolume: 2500
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
      currentPrice: 101.75,
      priceSession: "pre",
      previousClose: 99,
      volume: 2500
    });
  });

  it("uses after-hours price when Yahoo reports a post-market session", () => {
    const closes = Array.from({ length: 5 }, (_, index) => 100 + index);
    const quote = parseYahooChartQuote({
      chart: {
        result: [{
          meta: {
            marketState: "POST",
            regularMarketPrice: 100,
            postMarketPrice: 98.4,
            previousClose: 99,
            postMarketVolume: 1800
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
      currentPrice: 98.4,
      priceSession: "post",
      previousClose: 99,
      volume: 1800
    });
  });

  it("falls back to the regular close when extended-hours price is missing", () => {
    expect(resolveYahooLivePrice({
      marketState: "POST",
      regularMarketPrice: 100
    })).toMatchObject({
      currentPrice: 100,
      priceSession: "closed"
    });
    expect(yahooMarketSession({ marketState: "PREPRE" })).toBe("pre");
    expect(yahooMarketSession({ marketState: "POSTPOST" })).toBe("post");
  });
});
