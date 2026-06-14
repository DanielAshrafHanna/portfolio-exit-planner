import { describe, expect, it } from "vitest";
import {
  isEmailNoiseWarning,
  sanitizeReportWarningsForEmail,
  stripWarningsFromTextDigest
} from "./reportEmailWarnings";

describe("sanitizeReportWarningsForEmail", () => {
  it("removes quote-source transparency warnings from daily emails", () => {
    const promo = "(Thank you for using Alpha Vantage! Please consider spreading out your free API requests more sparingly (1 request per second). You may subscribe to any of the premium plans at https://www.alphavantage.co/premium/ to lift the free key rate limit (25 requests per day), raise the per-second burst limit, and instantly unlock all premium endpoints)";
    const warnings = [
      `US Portfolio: Alpha Vantage failed for AAPL; using Yahoo Finance fallback. ${promo}`,
      `US Portfolio: Alpha Vantage failed for NFLX; using Yahoo Finance fallback. ${promo}`,
      "US Portfolio: Alpha Vantage rate limit hit for 8 symbols (AAPL, NFLX, QQQM, DRAM, …); using Yahoo Finance quotes.",
      "Egypt Portfolio: Egypt quotes are fetched from Mubasher EGX pages because Yahoo Finance can return stale EGX prices."
    ];

    expect(sanitizeReportWarningsForEmail(warnings)).toEqual([]);
  });

  it("keeps actionable quote failures in daily emails", () => {
    const warnings = [
      "US Portfolio: No live quote was found for FAKE.",
      "Egypt Portfolio: COMI has no live EGX stock quote. If this is a mutual fund, it is not supported here."
    ];

    expect(sanitizeReportWarningsForEmail(warnings)).toEqual(warnings);
  });
});

describe("isEmailNoiseWarning", () => {
  it("treats Yahoo fallback transparency as email noise", () => {
    expect(isEmailNoiseWarning("US Portfolio: Alpha Vantage failed for AAPL; using Yahoo Finance fallback.")).toBe(true);
  });
});

describe("stripWarningsFromTextDigest", () => {
  it("removes the warnings block from plain-text digest", () => {
    const digest = "Daily Portfolio Summary - Jun 13, 2026\n\nUS Portfolio: value $1,000\n\nWarnings:\n- US Portfolio: Alpha Vantage failed";
    expect(stripWarningsFromTextDigest(digest)).toBe("Daily Portfolio Summary - Jun 13, 2026\n\nUS Portfolio: value $1,000");
  });
});
