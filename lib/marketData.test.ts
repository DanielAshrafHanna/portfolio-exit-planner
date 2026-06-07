import { describe, expect, it } from "vitest";
import { parseMubasherEgxQuote } from "./marketData";

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
