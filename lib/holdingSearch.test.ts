import { describe, expect, it } from "vitest";
import { filterHoldingsBySearch } from "./holdingSearch";
import type { EnrichedHolding } from "./types";

const baseHolding = (symbol: string, name: string): EnrichedHolding => ({
  id: symbol,
  symbol,
  name,
  shares: 1,
  averageCost: 10,
  totalCost: 10,
  news: [],
  selectedStopStyle: "balanced",
  sellPercent: 100
});

describe("filterHoldingsBySearch", () => {
  const holdings = [
    baseHolding("AAPL", "Apple Inc"),
    baseHolding("MSFT", "Microsoft Corporation"),
    baseHolding("COMI", "Commercial International Bank")
  ];

  it("returns all holdings when the query is empty", () => {
    expect(filterHoldingsBySearch(holdings, "")).toHaveLength(3);
    expect(filterHoldingsBySearch(holdings, "   ")).toHaveLength(3);
  });

  it("matches ticker symbols case-insensitively", () => {
    expect(filterHoldingsBySearch(holdings, "aapl")).toEqual([holdings[0]]);
    expect(filterHoldingsBySearch(holdings, "ms")).toEqual([holdings[1]]);
  });

  it("matches company names case-insensitively", () => {
    expect(filterHoldingsBySearch(holdings, "apple")).toEqual([holdings[0]]);
    expect(filterHoldingsBySearch(holdings, "commercial")).toEqual([holdings[2]]);
  });

  it("matches provider company names when the stored holding name is empty", () => {
    const unnamedApple = {
      ...holdings[0],
      name: "",
      quote: {
        symbol: "AAPL",
        currentPrice: 190,
        dailyChangePercent: 1,
        previousClose: 188,
        companyName: "Apple Inc.",
        provider: "yahoo_finance"
      }
    };
    expect(filterHoldingsBySearch([unnamedApple], "apple")).toEqual([unnamedApple]);
  });

  it("returns an empty list when nothing matches", () => {
    expect(filterHoldingsBySearch(holdings, "tesla")).toEqual([]);
  });
});
