import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "./profileUtils";
import {
  mergeProfilesForCloudSave,
  portfolioHasUnsavedSymbols,
  shouldKeepSessionPortfolioEdits,
  shouldSkipEmptyCloudOverwrite
} from "./portfolioSync";
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

describe("portfolio sync policy", () => {
  it("does not keep local portfolio on fresh load without session edits", () => {
    const local = [profile("us-portfolio", "US", []), profile("eg-portfolio", "EG", [])];
    const cloud = [profile("us-portfolio", "US", ["NASA"]), profile("eg-portfolio", "EG", [])];
    expect(shouldKeepSessionPortfolioEdits(local, cloud, false)).toBe(false);
  });

  it("keeps local portfolio during an active editing session", () => {
    const local = [profile("us-portfolio", "US", ["NASA"]), profile("eg-portfolio", "EG", [])];
    const cloud = [profile("us-portfolio", "US", []), profile("eg-portfolio", "EG", [])];
    expect(shouldKeepSessionPortfolioEdits(local, cloud, true)).toBe(true);
  });

  it("detects unsaved local symbols", () => {
    const local = [profile("us-portfolio", "US", ["NASA"]), profile("eg-portfolio", "EG", [])];
    const cloud = [profile("us-portfolio", "US", ["AAPL"]), profile("eg-portfolio", "EG", [])];
    expect(portfolioHasUnsavedSymbols(local, cloud)).toBe(true);
  });

  it("blocks empty autosave from overwriting cloud holdings", () => {
    const local = [profile("us-portfolio", "US", []), profile("eg-portfolio", "EG", [])];
    expect(shouldSkipEmptyCloudOverwrite(local, 1, false)).toBe(true);
    expect(shouldSkipEmptyCloudOverwrite(local, 1, true)).toBe(false);
  });

  it("preserves cloud holdings for profiles that were not edited locally", () => {
    const local = [profile("us-portfolio", "US", []), profile("eg-portfolio", "EG", ["ORHD"])];
    const cloud = [profile("us-portfolio", "US", ["NASA"]), profile("eg-portfolio", "EG", ["ORHD"])];
    const merged = mergeProfilesForCloudSave(local, cloud, new Set(["eg-portfolio"]));
    expect(merged.find((item) => item.id === "us-portfolio")?.holdings.map((holding) => holding.symbol)).toEqual(["NASA"]);
    expect(merged.find((item) => item.id === "eg-portfolio")?.holdings.map((holding) => holding.symbol)).toEqual(["ORHD"]);
  });

  it("allows an intentionally cleared profile to save empty holdings", () => {
    const local = [profile("us-portfolio", "US", []), profile("eg-portfolio", "EG", ["ORHD"])];
    const cloud = [profile("us-portfolio", "US", ["NASA"]), profile("eg-portfolio", "EG", ["ORHD"])];
    const merged = mergeProfilesForCloudSave(local, cloud, new Set(["us-portfolio"]));
    expect(merged.find((item) => item.id === "us-portfolio")?.holdings).toHaveLength(0);
  });
});
