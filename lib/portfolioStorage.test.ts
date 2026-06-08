import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "./profileUtils";
import {
  defaultPortfolioSnapshot,
  portfolioSnapshotFromProfiles,
  portfolioCacheKeys
} from "./portfolioStorage";
import type { PortfolioProfile } from "./types";

describe("portfolioStorage", () => {
  it("scopes cache keys per signed-in user", () => {
    expect(portfolioCacheKeys("guest").profiles).toContain("guest");
    expect(portfolioCacheKeys("user-123").profiles).toContain("user:user-123");
  });

  it("creates an empty default snapshot", () => {
    const snapshot = defaultPortfolioSnapshot();
    expect(snapshot.profiles).toHaveLength(2);
    expect(snapshot.profiles.every((profile) => profile.holdings.length === 0)).toBe(true);
  });

  it("normalizes active profile ids when building snapshots", () => {
    const profiles: PortfolioProfile[] = [
      {
        id: "us-portfolio",
        name: "US Portfolio",
        region: "US",
        currency: "USD",
        holdings: [{
          id: "1",
          symbol: "NASA",
          name: "NASA",
          shares: 2,
          averageCost: 10,
          totalCost: 20,
          news: [],
          selectedStopStyle: "balanced",
          sellPercent: 100
        }],
        settings: DEFAULT_SETTINGS
      }
    ];
    const snapshot = portfolioSnapshotFromProfiles(profiles, "missing-profile", "2026-06-09T00:00:00.000Z");
    expect(snapshot.activeProfileId).toBe("us-portfolio");
    expect(snapshot.cloudUpdatedAt).toBe("2026-06-09T00:00:00.000Z");
  });
});
