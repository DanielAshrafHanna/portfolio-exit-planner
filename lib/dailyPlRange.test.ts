import { describe, expect, it } from "vitest";
import { aggregateDailyPlRangeFromHoldings, computeDailyPlRange } from "./dailyPlRange";

describe("computeDailyPlRange", () => {
  it("maps session low/high prices into daily P/L endpoints and marker position", () => {
    const range = computeDailyPlRange({
      shares: 10,
      previousClose: 100,
      dayLow: 95,
      dayHigh: 110,
      currentPrice: 98
    });

    expect(range).toEqual({
      low: -50,
      high: 100,
      current: -20,
      lowPercent: -5,
      highPercent: 10,
      currentPercent: -2,
      position: 0.2
    });
  });

  it("returns undefined when day range data is missing", () => {
    expect(computeDailyPlRange({
      shares: 10,
      previousClose: 100,
      currentPrice: 98
    })).toBeUndefined();
  });
});

describe("aggregateDailyPlRangeFromHoldings", () => {
  it("sums holding ranges into a portfolio daily range", () => {
    const range = aggregateDailyPlRangeFromHoldings([
      {
        shares: 10,
        previousClose: 100,
        dayLow: 95,
        dayHigh: 110,
        currentPrice: 98
      },
      {
        shares: 5,
        previousClose: 200,
        dayLow: 190,
        dayHigh: 210,
        currentPrice: 205
      }
    ]);

    expect(range).toMatchObject({
      low: -100,
      high: 150,
      current: 5
    });
    expect(range?.position).toBeGreaterThan(0);
    expect(range?.position).toBeLessThan(1);
  });
});
