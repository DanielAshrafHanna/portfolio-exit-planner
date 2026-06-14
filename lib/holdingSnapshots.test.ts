import { describe, expect, it } from "vitest";
import {
  buildMoverDateOptions,
  mergeHoldingSnapshotsForMovers,
  parseHoldingsSnapshot
} from "./holdingSnapshots";

describe("parseHoldingsSnapshot", () => {
  it("coerces valid holding rows and ignores invalid entries", () => {
    const parsed = parseHoldingsSnapshot([
      { symbol: "AAPL", name: "Apple", daily_profit_loss: 12.5, daily_profit_loss_percent: 1.2, shares: 4 },
      { symbol: 123 },
      null
    ]);
    expect(parsed).toEqual([{ symbol: "AAPL", name: "Apple", daily_profit_loss: 12.5, daily_profit_loss_percent: 1.2, shares: 4 }]);
  });
});

describe("mergeHoldingSnapshotsForMovers", () => {
  it("merges holdings for a selected day and profile filter", () => {
    const movers = mergeHoldingSnapshotsForMovers([
      {
        snapshotDate: "2026-06-12",
        profileId: "us-portfolio",
        currency: "USD",
        holdings: [
          { symbol: "AAPL", name: "Apple", daily_profit_loss: 10, daily_profit_loss_percent: 2, shares: 2 },
          { symbol: "MSFT", name: "Microsoft", daily_profit_loss: -5, daily_profit_loss_percent: -1, shares: 1 }
        ]
      }
    ], {
      currency: "USD",
      profileId: "us-portfolio",
      snapshotDate: "2026-06-12"
    });

    expect(movers).toHaveLength(2);
    expect(movers[0]).toMatchObject({ symbol: "AAPL", dailyProfitLoss: 10, dailyProfitLossPercent: 2, shares: 2 });
  });
});

describe("buildMoverDateOptions", () => {
  it("includes live and historical session dates", () => {
    const options = buildMoverDateOptions(
      ["2026-06-11", "2026-06-12"],
      [{
        snapshotDate: "2026-06-12",
        profileId: "us-portfolio",
        currency: "USD",
        holdings: [{ symbol: "AAPL", name: "Apple", daily_profit_loss: 1, daily_profit_loss_percent: 0.5, shares: 1 }]
      }],
      { currency: "USD", profileId: "us-portfolio" },
      new Date("2026-06-14T12:00:00.000Z")
    );

    expect(options[0]).toMatchObject({ id: "live", label: "Latest (live)" });
    expect(options.map((option) => option.id)).toEqual(["live", "2026-06-11", "2026-06-12"]);
    expect(options[2].hasHoldings).toBe(true);
    expect(options[1].hasHoldings).toBe(false);
  });
});
