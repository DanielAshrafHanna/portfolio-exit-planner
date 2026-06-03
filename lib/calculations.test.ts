import { describe, expect, it } from "vitest";
import { calculatePartialSale, calculateProfitLoss, calculateStopLosses, defaultSellTargets, totalCostFor } from "./calculations";

const holding = {
  id: "1",
  symbol: "TSM",
  name: "Taiwan Semiconductor",
  shares: 10,
  averageCost: 100,
  totalCost: 1000
};

it("calculates total cost from shares and average cost", () => {
  expect(totalCostFor(12.5, 8)).toBe(100);
});

describe("profit/loss", () => {
  it("includes fixed, trading, and FX fees in net P/L", () => {
    const result = calculateProfitLoss(10, 100, 120, { fixedTradingFee: 2, percentTradingFee: 1, fxFeePercent: 0.5 });
    expect(result.grossValue).toBe(1200);
    expect(result.fees).toBe(20);
    expect(result.profitLoss).toBe(180);
    expect(result.profitLossPercent).toBe(18);
  });
});

describe("stop loss rules", () => {
  it("uses ATR multiples and protects part of profit", () => {
    const stops = calculateStopLosses(holding, {
      symbol: "TSM",
      currentPrice: 140,
      dailyChangePercent: 1,
      previousClose: 138,
      atr: 4,
      provider: "test"
    });
    expect(stops.tight.price).toBeGreaterThanOrEqual(110);
    expect(stops.balanced.price).toBeGreaterThanOrEqual(110);
    expect(stops.loose.price).toBeGreaterThan(0);
  });

  it("falls back to percentage stops when ATR is missing", () => {
    const stops = calculateStopLosses(holding, {
      symbol: "TSM",
      currentPrice: 100,
      dailyChangePercent: 0,
      previousClose: 100,
      provider: "test"
    });
    expect(stops.tight.price).toBe(94);
    expect(stops.balanced.price).toBe(90);
    expect(stops.loose.price).toBe(82);
  });
});

it("creates default target prices", () => {
  expect(defaultSellTargets(100, 112).map((target) => target.price)).toEqual([105, 110, 115, 112]);
});

it("calculates partial sale and remaining position", () => {
  const result = calculatePartialSale(holding, 120, 50, { fixedTradingFee: 0, percentTradingFee: 0, fxFeePercent: 0 });
  expect(result.soldShares).toBe(5);
  expect(result.realizedProfitLoss).toBe(100);
  expect(result.remainingShares).toBe(5);
  expect(result.remainingUnrealizedProfitLoss).toBe(100);
});
