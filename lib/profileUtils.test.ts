import { describe, expect, it } from "vitest";
import { displayMarketSymbol, formatMoney, formatMoneyTable, normalizeMarketSymbol } from "./profileUtils";

describe("market symbol normalization", () => {
  it("keeps US symbols unchanged", () => {
    expect(normalizeMarketSymbol("aapl", "US")).toBe("AAPL");
  });

  it("adds the Yahoo Finance Egyptian exchange suffix", () => {
    expect(normalizeMarketSymbol("comi", "EG")).toBe("COMI.CA");
  });

  it("does not duplicate the Egyptian suffix", () => {
    expect(normalizeMarketSymbol("COMI.CA", "EG")).toBe("COMI.CA");
  });

  it("removes the Egyptian suffix for display", () => {
    expect(displayMarketSymbol("COMI.CA", "EG")).toBe("COMI");
  });
});

describe("currency formatting", () => {
  it("formats dollars and Egyptian pounds", () => {
    expect(formatMoney(1234.56, "USD")).toBe("$1,234.56");
    expect(formatMoney(1234.56, "EGP")).toBe("EGP 1,234.56");
  });

  it("formats compact table money without repeating the EGP prefix", () => {
    expect(formatMoneyTable(1234.56, "USD")).toBe("$1,234.56");
    expect(formatMoneyTable(1234567.89, "EGP")).toBe("1,234,567.89");
  });
});
