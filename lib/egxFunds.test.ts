import { describe, expect, it } from "vitest";
import {
  buildEgxFundQuote,
  findFundPriceInArticle,
  getEgxFundConfig,
  isStaleFundArticle,
  parseMubasherFundCsv,
  parseMubasherNewsFundPrices
} from "./egxFunds";

describe("egxFunds", () => {
  it("maps supported Egyptian fund tickers", () => {
    expect(getEgxFundConfig("BFI")?.names[0]).toContain("Financial");
    expect(getEgxFundConfig("AZG")?.fundId).toBe(5989);
  });

  it("parses fund prices from plain Mubasher articles", () => {
    const prices = parseMubasherNewsFundPrices(`
      <p>Fund Name: Azimut Gold (az-gold)</p>
      <p>Price per Certificate (EGP): 26.78075</p>
    `);
    expect(findFundPriceInArticle(`Fund Name: Azimut Gold (az-gold) Price per Certificate (EGP): 26.78075`, getEgxFundConfig("AZG")!)).toBe(26.78075);
    expect(prices.size).toBeGreaterThan(0);
  });

  it("parses span-split and strong-tagged Mubasher article HTML", () => {
    const html = `
      <p><strong>Fund Name</strong>:&nbsp;Beltone 3 Financial Sector</p>
      <p>Price per Certificate (EGP):&nbsp;&nbsp;1.<span>40427</span></p>
    `;
    expect(findFundPriceInArticle(html, getEgxFundConfig("BFI")!)).toBe(1.40427);
  });

  it("marks older article ids as stale", () => {
    expect(isStaleFundArticle(4562664)).toBe(true);
    expect(isStaleFundArticle(4602512)).toBe(false);
  });

  it("parses fund CSV rows", () => {
    expect(parseMubasherFundCsv(`
2025/05/12/00:00:00,18.18332
2025/05/13/00:00:00,18.49887
2025/05/14/00:00:00,18.35806
`)).toEqual({ currentPrice: 18.35806, previousClose: 18.49887 });
  });

  it("builds a stale fund quote", () => {
    const quote = buildEgxFundQuote("BFI", 1.40427, 1.392, { stale: true });
    expect(quote.stale).toBe(true);
    expect(quote.provider).toBe("mubasher_egx_fund");
  });
});
