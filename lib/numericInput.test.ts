import { describe, expect, it } from "vitest";
import { isIncompleteNumericInput, parseNumericInput } from "./numericInput";

describe("isIncompleteNumericInput", () => {
  it("treats trailing decimal and lone minus as incomplete", () => {
    expect(isIncompleteNumericInput("302.")).toBe(true);
    expect(isIncompleteNumericInput("-")).toBe(true);
    expect(isIncompleteNumericInput(".")).toBe(true);
  });

  it("keeps draft for partial decimals like 302.0", () => {
    expect(isIncompleteNumericInput("302.0")).toBe(true);
    expect(isIncompleteNumericInput("0.0")).toBe(true);
  });

  it("accepts complete decimal values", () => {
    expect(isIncompleteNumericInput("302.06")).toBe(false);
    expect(isIncompleteNumericInput("0.5")).toBe(false);
    expect(isIncompleteNumericInput("302")).toBe(false);
  });
});

describe("parseNumericInput", () => {
  it("parses numeric strings and falls back to zero", () => {
    expect(parseNumericInput("302.06")).toBe(302.06);
    expect(parseNumericInput("302.0")).toBe(302);
    expect(parseNumericInput("")).toBe(0);
    expect(parseNumericInput(".")).toBe(0);
  });
});
