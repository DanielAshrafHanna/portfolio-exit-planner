import { describe, expect, it } from "vitest";
import { coerceHoldings, emptyPortfolioBootstrap, loadPortfolioState } from "./storageMigration";

describe("portfolio storage migration", () => {
  it("bootstraps new accounts with empty US and Egypt profiles", () => {
    const state = emptyPortfolioBootstrap();
    expect(state.profiles).toHaveLength(2);
    expect(state.profiles.every((profile) => profile.holdings.length === 0)).toBe(true);
    expect(state.activeProfileId).toBe("us-portfolio");
  });

  it("ignores corrupted JSON and falls back to default profiles", () => {
    const state = loadPortfolioState({
      storedProfiles: "{bad json",
      storedHoldings: null,
      storedSettings: null,
      storedActiveProfileId: null
    });

    expect(state.profiles).toHaveLength(2);
    expect(state.activeProfileId).toBe("us-portfolio");
    expect(state.warnings).toContain("Stored portfolio profiles was unreadable and was ignored.");
  });

  it("migrates legacy holdings and removes old demo sample rows", () => {
    const state = loadPortfolioState({
      storedProfiles: null,
      storedHoldings: JSON.stringify([
        { id: "tsm", symbol: "TSM", name: "Sample", shares: 1, averageCost: 100, totalCost: 100, notes: "Sample holding" },
        { id: "real", symbol: "AAPL", name: "Apple", shares: 2, averageCost: 150, totalCost: 300 }
      ]),
      storedSettings: JSON.stringify({ fixedTradingFee: 2 }),
      storedActiveProfileId: null
    });

    expect(state.profiles[0].holdings.map((holding) => holding.symbol)).toEqual(["AAPL"]);
    expect(state.profiles[0].settings.fixedTradingFee).toBe(2);
    expect(state.warnings).toContain("Existing portfolio data was moved into the US Portfolio profile.");
  });

  it("coerces malformed holding fields without preserving invalid market data", () => {
    const holdings = coerceHoldings([
      {
        symbol: "ibm",
        shares: "4",
        averageCost: "100",
        totalCost: "-1",
        quote: { symbol: "IBM", currentPrice: -20, dailyChangePercent: 0, previousClose: 0, provider: "bad" },
        selectedStopStyle: "wild"
      }
    ]);

    expect(holdings).toHaveLength(1);
    expect(holdings[0]).toMatchObject({
      symbol: "IBM",
      shares: 4,
      averageCost: 100,
      totalCost: 400,
      selectedStopStyle: "balanced"
    });
    expect(holdings[0].quote).toBeUndefined();
  });
});

