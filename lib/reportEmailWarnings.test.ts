import { describe, expect, it } from "vitest";
import { sanitizeReportWarningsForEmail } from "./reportEmailWarnings";

describe("sanitizeReportWarningsForEmail", () => {
  it("collapses repeated Alpha Vantage fallback warnings per profile", () => {
    const promo = "(Thank you for using Alpha Vantage! Please consider spreading out your free API requests more sparingly (1 request per second). You may subscribe to any of the premium plans at https://www.alphavantage.co/premium/ to lift the free key rate limit (25 requests per day), raise the per-second burst limit, and instantly unlock all premium endpoints)";
    const warnings = [
      `US Portfolio: Alpha Vantage failed for AAPL; using Yahoo Finance fallback. ${promo}`,
      `US Portfolio: Alpha Vantage failed for NFLX; using Yahoo Finance fallback. ${promo}`,
      "Egypt Portfolio: Egypt quotes are fetched from Mubasher EGX pages because Yahoo Finance can return stale EGX prices."
    ];

    expect(sanitizeReportWarningsForEmail(warnings)).toEqual([
      "US Portfolio: Alpha Vantage rate limit hit for 2 symbols (AAPL, NFLX); using Yahoo Finance quotes.",
      "Egypt Portfolio: Egypt quotes are fetched from Mubasher EGX pages because Yahoo Finance can return stale EGX prices."
    ]);
  });
});
