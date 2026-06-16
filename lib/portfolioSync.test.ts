import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "./profileUtils";
import {
  mergeProfilesForCloudSave,
  portfolioHasUnsavedSymbols,
  shouldKeepSessionPortfolioEdits,
  shouldPreferLocalPortfolioCache,
  shouldSkipEmptyCloudOverwrite
} from "./portfolioSync";
import { portfolioSnapshotFromProfiles } from "./portfolioStorage";
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

  it("preserves cloud holdings when only another profile's holdings were edited", () => {
    const local = [profile("us-portfolio", "US", []), profile("eg-portfolio", "EG", ["ORHD", "RAYA"])];
    const cloud = [profile("us-portfolio", "US", ["NASA"]), profile("eg-portfolio", "EG", ["ORHD"])];
    const merged = mergeProfilesForCloudSave(local, cloud, new Set(["eg-portfolio"]));
    expect(merged.find((item) => item.id === "us-portfolio")?.holdings.map((holding) => holding.symbol)).toEqual(["NASA"]);
    expect(merged.find((item) => item.id === "eg-portfolio")?.holdings.map((holding) => holding.symbol)).toEqual(["ORHD", "RAYA"]);
  });

  it("prefers a newer local cache over older cloud data", () => {
    const local = portfolioSnapshotFromProfiles(
      [profile("us-portfolio", "US", ["AAPL"]), profile("eg-portfolio", "EG", [])],
      "us-portfolio",
      "2026-06-01T00:00:00.000Z",
      "2026-06-10T12:00:00.000Z"
    );
    const cloud = [profile("us-portfolio", "US", []), profile("eg-portfolio", "EG", [])];
    expect(shouldPreferLocalPortfolioCache(local, cloud, "2026-06-09T00:00:00.000Z")).toBe(true);
  });

  it("allows an intentionally cleared profile to save empty holdings", () => {
    const local = [profile("us-portfolio", "US", []), profile("eg-portfolio", "EG", ["ORHD"])];
    const cloud = [profile("us-portfolio", "US", ["NASA"]), profile("eg-portfolio", "EG", ["ORHD"])];
    const merged = mergeProfilesForCloudSave(local, cloud, new Set(["us-portfolio"]));
    expect(merged.find((item) => item.id === "us-portfolio")?.holdings).toHaveLength(0);
  });

  it("does not let a stale, non-empty, untouched profile clobber newer cloud holdings", () => {
    const local = [profile("us-portfolio", "US", ["AAPL", "NFLX"])];
    const cloud = [profile("us-portfolio", "US", ["AAPL", "NFLX", "QQQM", "DRAM", "TSM", "NASA", "IBM", "INTC"])];
    const merged = mergeProfilesForCloudSave(local, cloud, new Set());
    expect(merged.find((item) => item.id === "us-portfolio")?.holdings.map((holding) => holding.symbol)).toEqual([
      "AAPL", "NFLX", "QQQM", "DRAM", "TSM", "NASA", "IBM", "INTC"
    ]);
  });

  it("keeps local-only additions for an untouched profile while preserving cloud holdings", () => {
    const local = [profile("us-portfolio", "US", ["AAPL", "MSFT"])];
    const cloud = [profile("us-portfolio", "US", ["AAPL", "NFLX"])];
    const merged = mergeProfilesForCloudSave(local, cloud, new Set());
    expect(merged.find((item) => item.id === "us-portfolio")?.holdings.map((holding) => holding.symbol)).toEqual([
      "AAPL", "NFLX", "MSFT"
    ]);
  });

  it("honors deletions on a profile the user edited this session", () => {
    const local = [profile("us-portfolio", "US", ["AAPL"])];
    const cloud = [profile("us-portfolio", "US", ["AAPL", "NFLX"])];
    const merged = mergeProfilesForCloudSave(local, cloud, new Set(["us-portfolio"]));
    expect(merged.find((item) => item.id === "us-portfolio")?.holdings.map((holding) => holding.symbol)).toEqual(["AAPL"]);
  });
});
