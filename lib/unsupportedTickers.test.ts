import { describe, expect, it } from "vitest";
import {
  EG_MUTUAL_FUND_TICKERS,
  filterUnsupportedHoldings,
  getUnsupportedTickerMessage,
  isEgyptianMutualFundTicker,
  isUnsupportedTicker
} from "./unsupportedTickers";

describe("unsupportedTickers", () => {
  it("blocks known Egyptian mutual fund tickers", () => {
    expect(isUnsupportedTicker("AZG", "EG")).toBe(true);
    expect(isUnsupportedTicker("BFI", "EG")).toBe(true);
    expect(isUnsupportedTicker("CI30", "EG")).toBe(true);
    expect(isUnsupportedTicker("CRE", "EG")).toBe(true);
    expect(isUnsupportedTicker("COMI", "EG")).toBe(false);
    expect(isUnsupportedTicker("AZG", "US")).toBe(false);
  });

  it("includes the Thndr fund catalog we block", () => {
    expect(EG_MUTUAL_FUND_TICKERS).toContain("AZG");
    expect(EG_MUTUAL_FUND_TICKERS).toContain("BFI");
    expect(EG_MUTUAL_FUND_TICKERS).toContain("T70");
    expect(EG_MUTUAL_FUND_TICKERS.length).toBeGreaterThanOrEqual(38);
  });

  it("returns a mutual fund message for blocked tickers", () => {
    expect(getUnsupportedTickerMessage("BFI", "EG")).toContain("mutual funds");
  });

  it("filters blocked holdings when loading portfolios", () => {
    const filtered = filterUnsupportedHoldings([
      { symbol: "COMI", shares: 10 },
      { symbol: "AZG", shares: 5 }
    ], "EG");
    expect(filtered).toEqual([{ symbol: "COMI", shares: 10 }]);
  });

  it("identifies mutual fund tickers by symbol", () => {
    expect(isEgyptianMutualFundTicker("bco")).toBe(true);
    expect(isEgyptianMutualFundTicker("ORHD")).toBe(false);
  });
});
