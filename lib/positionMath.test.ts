import { describe, expect, it } from "vitest";
import {
  applySaleToHolding,
  consolidateHoldingsBySymbol,
  mergeBuyIntoHolding,
  reconcileHolding,
  SHARE_EPSILON
} from "./positionMath";

const settings = { fixedTradingFee: 0, percentTradingFee: 0, fxFeePercent: 0 };

describe("reconcileHolding", () => {
  it("clamps negative shares and keeps totalCost aligned", () => {
    expect(reconcileHolding({ shares: -5, averageCost: 10, totalCost: 999 })).toEqual({
      shares: 0,
      averageCost: 10,
      totalCost: 0
    });
  });

  it("preserves fractional shares and high-precision average cost", () => {
    const reconciled = reconcileHolding({ shares: 5.12345, averageCost: 5.12345, totalCost: 0 });
    expect(reconciled.shares).toBe(5.12345);
    expect(reconciled.averageCost).toBe(5.12345);
  });
});

describe("mergeBuyIntoHolding", () => {
  it("blends weighted average cost on additional buys", () => {
    const merged = mergeBuyIntoHolding({ shares: 10, averageCost: 100, totalCost: 1000 }, 5, 130);
    expect(merged.shares).toBe(15);
    expect(merged.averageCost).toBe(110);
    expect(merged.totalCost).toBe(1650);
  });

  it("returns existing holding when buy shares are zero", () => {
    const existing = { shares: 4, averageCost: 50, totalCost: 200 };
    expect(mergeBuyIntoHolding(existing, 0, 60)).toEqual(reconcileHolding(existing));
  });
});

describe("applySaleToHolding", () => {
  it("reduces shares on partial sale without changing average cost", () => {
    const result = applySaleToHolding({ shares: 10, averageCost: 100, totalCost: 1000 }, 120, 50, settings);
    expect(result.closed).toBe(false);
    expect(result.soldShares).toBe(5);
    expect(result.remainingShares).toBe(5);
    expect(result.holding).toEqual({ shares: 5, averageCost: 100, totalCost: 500 });
    expect(result.realizedProfitLoss).toBe(100);
  });

  it("closes the position on a full sale", () => {
    const result = applySaleToHolding({ shares: 3, averageCost: 40, totalCost: 120 }, 55, 100, settings);
    expect(result.closed).toBe(true);
    expect(result.holding).toBeNull();
    expect(result.remainingShares).toBe(0);
    expect(result.realizedProfitLoss).toBe(45);
  });

  it("treats tiny remaining shares as closed", () => {
    const tiny = SHARE_EPSILON / 2;
    const result = applySaleToHolding({ shares: tiny, averageCost: 10, totalCost: 0 }, 12, 100, settings);
    expect(result.closed).toBe(true);
    expect(result.holding).toBeNull();
  });
});

describe("consolidateHoldingsBySymbol", () => {
  it("merges duplicate symbols into one weighted-average row", () => {
    const consolidated = consolidateHoldingsBySymbol([
      { id: "1", symbol: "AAPL", name: "Apple", shares: 10, averageCost: 100, totalCost: 1000 },
      { id: "2", symbol: "aapl", name: "Apple Inc", shares: 5, averageCost: 130, totalCost: 650 }
    ]);

    expect(consolidated).toHaveLength(1);
    expect(consolidated[0].shares).toBe(15);
    expect(consolidated[0].averageCost).toBe(110);
    expect(consolidated[0].totalCost).toBe(1650);
  });
});
