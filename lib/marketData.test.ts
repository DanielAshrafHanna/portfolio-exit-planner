import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getQuote,
  parseMubasherEgxQuote,
  parseYahooChartQuote,
  providerName,
  usesAlphaVantageQuotes,
  usesYahooQuoteFallback
} from "./marketData";

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

  it("reads labeled values when Mubasher renders the number before the label", () => {
    const quote = parseMubasherEgxQuote(`
      <div class="market-summary__last-price up-icon-only">134.99</div>
      <span class="market-summary__block-number">131.69</span>
      <span class="market-summary__block-text">Previous Close</span>
      <span class="market-summary__block-number">131.69</span>
      <span class="market-summary__block-number">4,254,137</span>
      <span class="market-summary__block-text">Volume</span>
      <span class="market-summary__block-number">4,254,137</span>
    `, "COMI");

    expect(quote).toMatchObject({
      symbol: "COMI",
      currentPrice: 134.99,
      previousClose: 131.69,
      volume: 4254137
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
            regularMarketVolume: 1000,
            longName: "Apple Inc."
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
      companyName: "Apple Inc.",
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

  it("falls back to the latest daily close when regularMarketPrice matches a stale extended-hours quote", () => {
    const closes = [...Array.from({ length: 23 }, (_, index) => 260 + index), 290.55, 291.58];
    const quote = parseYahooChartQuote({
      chart: {
        result: [{
          meta: {
            marketState: "POST",
            regularMarketPrice: 153.22,
            postMarketPrice: 153.22,
            previousClose: 290.55,
            regularMarketVolume: 50000000
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
  });

  it("uses regularMarketPrice even when stale extended-hours fields are present", () => {
    const closes = Array.from({ length: 5 }, (_, index) => 280 + index);
    const quote = parseYahooChartQuote({
      chart: {
        result: [{
          meta: {
            marketState: "POST",
            regularMarketPrice: 291.58,
            postMarketPrice: 153.22,
            previousClose: 290.55,
            postMarketVolume: 1800,
            regularMarketVolume: 50000000
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
      currentPrice: 291.58,
      volume: 50000000
    });
  });

  it("uses validated after-hours price during POST sessions", () => {
    const closes = [...Array.from({ length: 23 }, (_, index) => 260 + index), 290.55, 291.58];
    const quote = parseYahooChartQuote({
      chart: {
        result: [{
          meta: {
            marketState: "POST",
            regularMarketPrice: 291.58,
            postMarketPrice: 292.4,
            previousClose: 290.55,
            regularMarketVolume: 50000000
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
      currentPrice: 292.4,
      priceSession: "post"
    });
  });

  it("uses validated pre-market price during PRE sessions", () => {
    const closes = [...Array.from({ length: 23 }, (_, index) => 260 + index), 290.55, 291.58];
    const quote = parseYahooChartQuote({
      chart: {
        result: [{
          meta: {
            marketState: "PRE",
            regularMarketPrice: 291.58,
            preMarketPrice: 292.1,
            previousClose: 290.55
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
      currentPrice: 292.1,
      priceSession: "pre"
    });
  });

  it("skips extended-hours prices for snapshot-style fetches", () => {
    const closes = [...Array.from({ length: 23 }, (_, index) => 260 + index), 290.55, 291.58];
    const quote = parseYahooChartQuote({
      chart: {
        result: [{
          meta: {
            marketState: "POST",
            regularMarketPrice: 291.58,
            postMarketPrice: 292.4,
            previousClose: 290.55
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
    }, "AAPL", { allowExtendedHours: false });

    expect(quote).toMatchObject({
      currentPrice: 291.58,
      priceSession: "regular"
    });
  });
});

describe("quote provider selection", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.unstubAllEnvs();
  });

  it("defaults to yahoo on Vercel when provider is unset", () => {
    vi.stubEnv("VERCEL", "1");
    delete process.env.MARKET_DATA_PROVIDER;
    delete process.env.MARKET_DATA_API_KEY;
    delete process.env.ALPHA_VANTAGE_API_KEY;
    expect(providerName()).toBe("yahoo");
    expect(usesYahooQuoteFallback()).toBe(true);
  });

  it("uses Alpha Vantage only when provider and API key are configured", () => {
    vi.stubEnv("MARKET_DATA_PROVIDER", "alpha_vantage");
    vi.stubEnv("ALPHA_VANTAGE_API_KEY", "demo-key");
    expect(usesAlphaVantageQuotes()).toBe(true);
    expect(usesYahooQuoteFallback()).toBe(false);
  });
});

describe("Alpha Vantage Yahoo failsafe", () => {
  const originalFetch = global.fetch;
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.unstubAllEnvs();
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("falls back to Yahoo when Alpha Vantage errors", async () => {
    vi.stubEnv("MARKET_DATA_PROVIDER", "alpha_vantage");
    vi.stubEnv("ALPHA_VANTAGE_API_KEY", "demo-key");

    const closes = Array.from({ length: 25 }, (_, index) => 100 + index);
    const yahooPayload = {
      chart: {
        result: [{
          meta: {
            regularMarketPrice: 124.5,
            previousClose: 123,
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
    };

    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("alphavantage.co")) {
        return {
          ok: true,
          json: async () => ({ Note: "Thank you for using Alpha Vantage! Our standard API rate limit is 25 requests per day." })
        } as Response;
      }
      if (url.includes("finance.yahoo.com")) {
        return {
          ok: true,
          json: async () => yahooPayload
        } as Response;
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    const result = await getQuote("AAPL", "US");
    expect(result.data).toMatchObject({
      symbol: "AAPL",
      currentPrice: 124.5,
      provider: "yahoo_finance"
    });
    expect(result.warning).toContain("Yahoo Finance fallback");
  });
});
