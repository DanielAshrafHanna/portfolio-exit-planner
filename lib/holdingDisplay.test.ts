import { describe, expect, it } from "vitest";
import { computeHoldingRowMetrics, profitLossTone, badgeTone } from "./holdingDisplay";
import type { EnrichedHolding } from "./types";

const baseHolding: EnrichedHolding = {
  id: "1",
  symbol: "AAPL",
  name: "Apple",
  shares: 10,
  averageCost: 100,
  totalCost: 1000,
  selectedStopStyle: "balanced",
  sellPercent: 100,
  quote: {
    symbol: "AAPL",
    currentPrice: 120,
    dailyChangePercent: 2,
    previousClose: 118
  }
};

describe("holdingDisplay", () => {
  it("computes row metrics when quote exists", () => {
    const metrics = computeHoldingRowMetrics(baseHolding, { fixedTradingFee: 0, percentTradingFee: 0, fxFeePercent: 0 });
    expect(metrics.current?.profitLoss).toBeGreaterThan(0);
    expect(metrics.stopPrice).toBeGreaterThan(0);
    expect(metrics.targetPrice).toBeGreaterThan(0);
  });

  it("returns empty metrics without quote", () => {
    expect(computeHoldingRowMetrics({ ...baseHolding, quote: undefined }, { fixedTradingFee: 0, percentTradingFee: 0, fxFeePercent: 0 })).toEqual({});
  });

  it("maps profit and badge tones", () => {
    expect(profitLossTone(-1)).toBe("loss");
    expect(profitLossTone(1)).toBe("gain");
    expect(badgeTone("Sell")).toBe("danger");
    expect(badgeTone("Hold")).toBe("neutral");
  });
});
