import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "./profileUtils";
import { shouldPreferLocalPortfolio } from "./portfolioSync";
import type { PortfolioProfile } from "./types";

function profile(id: string, region: "US" | "EG", symbols: string[]): PortfolioProfile {
  return {
    id,
    name: id,
    region,
    currency: region === "EG" ? "EGP" : "USD",
    settings: DEFAULT_SETTINGS,
    holdings: symbols.map((symbol, index) => ({
      id: `holding-${index}`,
      symbol,
      name: symbol,
      shares: 1,
      averageCost: 10,
      totalCost: 10,
      news: [],
      selectedStopStyle: "balanced",
      sellPercent: 100
    }))
  };
}

describe("shouldPreferLocalPortfolio", () => {
  it("prefers cloud when local is empty but cloud has holdings", () => {
    const local = [profile("us-portfolio", "US", []), profile("eg-portfolio", "EG", [])];
    const cloud = [profile("us-portfolio", "US", ["NASA"]), profile("eg-portfolio", "EG", [])];
    expect(shouldPreferLocalPortfolio(local, cloud, {
      localIsNewer: true,
      userEditedDuringLoad: false,
      localHasUnsavedHoldings: false
    })).toBe(false);
  });

  it("keeps local when it has symbols missing from cloud", () => {
    const local = [profile("us-portfolio", "US", ["NASA"]), profile("eg-portfolio", "EG", [])];
    const cloud = [profile("us-portfolio", "US", []), profile("eg-portfolio", "EG", [])];
    expect(shouldPreferLocalPortfolio(local, cloud, {
      localIsNewer: false,
      userEditedDuringLoad: false,
      localHasUnsavedHoldings: true
    })).toBe(true);
  });

  it("keeps newer local data when local still has holdings", () => {
    const local = [profile("us-portfolio", "US", ["AAPL"]), profile("eg-portfolio", "EG", [])];
    const cloud = [profile("us-portfolio", "US", ["AAPL"]), profile("eg-portfolio", "EG", [])];
    expect(shouldPreferLocalPortfolio(local, cloud, {
      localIsNewer: true,
      userEditedDuringLoad: false,
      localHasUnsavedHoldings: false
    })).toBe(true);
  });
});
