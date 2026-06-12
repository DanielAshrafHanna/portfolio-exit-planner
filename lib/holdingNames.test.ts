import { describe, expect, it } from "vitest";
import { applyCompanyNameToHolding, holdingDisplayName } from "./holdingNames";
import type { EnrichedHolding } from "./types";

const holding: EnrichedHolding = {
  id: "h1",
  symbol: "AAPL",
  name: "",
  shares: 1,
  averageCost: 100,
  totalCost: 100,
  news: [],
  selectedStopStyle: "balanced",
  sellPercent: 100,
  quote: {
    symbol: "AAPL",
    currentPrice: 120,
    dailyChangePercent: 1,
    previousClose: 118,
    companyName: "Apple Inc.",
    provider: "yahoo_finance"
  }
};

describe("holdingNames", () => {
  it("uses the quote company name when the holding name is blank", () => {
    expect(holdingDisplayName(holding)).toBe("Apple Inc.");
  });

  it("fills the holding name from the quote when saving market data", () => {
    expect(applyCompanyNameToHolding(holding).name).toBe("Apple Inc.");
  });
});
