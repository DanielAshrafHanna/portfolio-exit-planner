import { describe, expect, it } from "vitest";
import { nextSortState, sortHoldings } from "@/lib/holdingSort";
import type { EnrichedHolding } from "@/lib/types";

const settings = { fixedTradingFee: 0, percentTradingFee: 0, fxFeePercent: 0 };

function holding(partial: Partial<EnrichedHolding> & Pick<EnrichedHolding, "id" | "symbol">): EnrichedHolding {
  return {
    name: "",
    shares: 1,
    averageCost: 10,
    totalCost: 10,
    selectedStopStyle: "balanced",
    sellPercent: 100,
    news: [],
    ...partial
  };
}

describe("holdingSort", () => {
  it("sorts symbols ascending with missing values last", () => {
    const rows = [
      holding({ id: "1", symbol: "ZZZ" }),
      holding({ id: "2", symbol: "AAA" }),
      holding({ id: "3", symbol: "" })
    ];
    const sorted = sortHoldings(rows, settings, "symbol", "asc");
    expect(sorted.map((row) => row.symbol)).toEqual(["AAA", "ZZZ", ""]);
  });

  it("sorts current P/L descending", () => {
    const rows = [
      holding({
        id: "1",
        symbol: "LOSS",
        shares: 10,
        averageCost: 100,
        quote: { symbol: "LOSS", currentPrice: 90, dailyChangePercent: 0, previousClose: 90, provider: "test" }
      }),
      holding({
        id: "2",
        symbol: "WIN",
        shares: 10,
        averageCost: 100,
        quote: { symbol: "WIN", currentPrice: 150, dailyChangePercent: 0, previousClose: 150, provider: "test" }
      })
    ];
    const sorted = sortHoldings(rows, settings, "currentProfitLoss", "desc");
    expect(sorted.map((row) => row.symbol)).toEqual(["WIN", "LOSS"]);
  });

  it("toggles direction when the same sort key is clicked again", () => {
    expect(nextSortState("symbol", "asc", "symbol")).toEqual({ sortKey: "symbol", sortDirection: "desc" });
    expect(nextSortState("symbol", "desc", "currentValue")).toEqual({ sortKey: "currentValue", sortDirection: "asc" });
  });
});
