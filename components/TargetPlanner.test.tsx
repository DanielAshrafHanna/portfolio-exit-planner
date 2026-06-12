import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { applyDesiredProfitLossTarget, TargetPlanner } from "./TargetPlanner";
import { calculateSellPriceForProfitLoss } from "@/lib/calculations";
import type { EnrichedHolding } from "@/lib/types";

const settings = { fixedTradingFee: 0, percentTradingFee: 0, fxFeePercent: 0 };

const holding: EnrichedHolding = {
  id: "h1",
  symbol: "AAPL",
  name: "Apple Inc",
  shares: 10,
  averageCost: 100,
  totalCost: 1000,
  selectedStopStyle: "balanced",
  sellPercent: 100,
  quote: {
    symbol: "AAPL",
    currentPrice: 120,
    dailyChangePercent: 1.5,
    previousClose: 118,
    provider: "yahoo_finance"
  }
};

describe("TargetPlanner", () => {
  it("renders planner controls when quote is available", () => {
    const html = renderToStaticMarkup(
      <TargetPlanner
        holding={holding}
        settings={settings}
        currency="USD"
        onChange={() => undefined}
      />
    );
    expect(html).toContain("Target planner");
    expect(html).toContain("AAPL");
    expect(html).toContain("Current target");
    expect(html).toContain("Breakeven");
    expect(html).toContain("P/L at target");
    expect(html).toContain("$100");
    expect(html).toContain("Desired P/L");
    expect(html).toContain("Apply to target");
    expect(html).toContain("$132");
    expect(html).toContain("$320");
  });

  it("renders loading state without a quote", () => {
    const html = renderToStaticMarkup(
      <TargetPlanner
        holding={{ ...holding, quote: undefined }}
        settings={settings}
        currency="USD"
        onChange={() => undefined}
      />
    );
    expect(html).toContain("Loading quote");
  });
});

describe("applyDesiredProfitLossTarget", () => {
  it("sets selectedTargetPrice from desired P/L", () => {
    const expectedPrice = calculateSellPriceForProfitLoss(10, 100, 250, settings);
    const updated = applyDesiredProfitLossTarget(holding, 250, settings);
    expect(updated.selectedTargetPrice).toBe(expectedPrice);
    expect(updated.targetPriceEdited).toBe(true);
  });
});
