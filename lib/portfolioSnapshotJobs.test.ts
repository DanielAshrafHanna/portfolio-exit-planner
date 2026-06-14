import { describe, expect, it, vi } from "vitest";
import {
  createCachedQuoteFetcher,
  shouldSnapshotCloudPortfolio,
  type UserSnapshotResult
} from "./portfolioSnapshotJobs";
import type { CloudPortfolioRow } from "./cloudPortfolio";
import type { MarketRegion } from "./types";

describe("shouldSnapshotCloudPortfolio", () => {
  it("returns false when every profile is empty", () => {
    const row: CloudPortfolioRow = {
      holdings: [{
        id: "us-portfolio",
        name: "US Portfolio",
        region: "US",
        currency: "USD",
        holdings: []
      }],
      settings: {}
    };
    expect(shouldSnapshotCloudPortfolio(row)).toBe(false);
  });

  it("returns true when any profile has a holding symbol", () => {
    const row: CloudPortfolioRow = {
      holdings: [{
        id: "us-portfolio",
        name: "US Portfolio",
        region: "US",
        currency: "USD",
        holdings: [{
          id: "1",
          symbol: "AAPL",
          name: "Apple",
          shares: 5,
          averageCost: 100,
          totalCost: 500
        }]
      }],
      settings: {}
    };
    expect(shouldSnapshotCloudPortfolio(row)).toBe(true);
  });
});

describe("createCachedQuoteFetcher", () => {
  it("reuses the same quote promise for duplicate symbol requests", async () => {
    const fetchQuote = vi.fn(async (symbol: string, region: MarketRegion) => ({
      data: {
        symbol,
        region,
        currentPrice: 100,
        previousClose: 99,
        provider: "test"
      }
    }));
    const cached = createCachedQuoteFetcher(fetchQuote);

    await cached("AAPL", "US");
    await cached("aapl", "US");
    await cached("MSFT", "US");

    expect(fetchQuote).toHaveBeenCalledTimes(2);
  });
});

describe("UserSnapshotResult", () => {
  it("allows skipped empty portfolios without treating them as failures", () => {
    const result: UserSnapshotResult = {
      userId: "user-1",
      ok: true,
      skipped: true,
      skipReason: "no_holdings"
    };
    expect(result.ok).toBe(true);
    expect(result.skipped).toBe(true);
  });
});
