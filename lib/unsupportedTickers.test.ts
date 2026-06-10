import { describe, expect, it } from "vitest";
import { isUnsupportedTicker } from "./unsupportedTickers";

describe("unsupportedTickers", () => {
  it("does not block supported Egyptian fund tickers", () => {
    expect(isUnsupportedTicker("AZG", "EG")).toBe(false);
    expect(isUnsupportedTicker("BFI", "EG")).toBe(false);
    expect(isUnsupportedTicker("COMI", "EG")).toBe(false);
  });
});
