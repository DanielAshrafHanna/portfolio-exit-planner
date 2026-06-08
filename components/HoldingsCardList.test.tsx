import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { HoldingsCardList } from "./HoldingsCardList";
import type { EnrichedHolding } from "@/lib/types";

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
    previousClose: 118
  },
  analysis: {
    action: "Hold",
    confidence: "High",
    riskLevel: "Medium",
    summary: "Test",
    reasonsToHold: [],
    reasonsToSell: [],
    upcomingCatalysts: [],
    suggestedActionPlan: { suggestedTakeProfit: 130, suggestedStopLoss: 110 }
  }
};

describe("HoldingsCardList", () => {
  it("renders holding symbol and metrics", () => {
    const html = renderToStaticMarkup(
      <HoldingsCardList
        holdings={[holding]}
        settings={{ fixedTradingFee: 0, percentTradingFee: 0, fxFeePercent: 0 }}
        currency="USD"
        onChange={() => undefined}
      />
    );
    expect(html).toContain("AAPL");
    expect(html).toContain("Apple Inc");
    expect(html).toContain("Hold");
  });

  it("returns null for empty holdings", () => {
    const html = renderToStaticMarkup(
      <HoldingsCardList
        holdings={[]}
        settings={{ fixedTradingFee: 0, percentTradingFee: 0, fxFeePercent: 0 }}
        currency="USD"
      />
    );
    expect(html).toBe("");
  });
});
