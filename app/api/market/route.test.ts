import { afterEach, describe, expect, it, vi } from "vitest";
import type { MarketQuote } from "@/lib/types";

const { mockGetQuote } = vi.hoisted(() => ({
  mockGetQuote: vi.fn()
}));

vi.mock("@/lib/marketData", () => ({
  getQuote: mockGetQuote,
  usesAlphaVantageQuotes: () => false,
  ALPHA_VANTAGE_REQUEST_GAP_MS: 1100
}));

import { POST } from "./route";

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/market", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

async function readJson(response: Response) {
  return await response.json() as Record<string, unknown>;
}

const quote: MarketQuote = {
  symbol: "AAPL",
  currentPrice: 125,
  dailyChangePercent: 1,
  previousClose: 124,
  provider: "test"
};

describe("/api/market", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("rejects requests with no symbols or holdings array", async () => {
    const response = await POST(jsonRequest({}));
    const body = await readJson(response);

    expect(response.status).toBe(400);
    expect(body.error).toBe("symbols or holdings must be a non-empty array");
  });

  it("rejects more than 50 symbols", async () => {
    const response = await POST(jsonRequest({ symbols: Array.from({ length: 51 }, (_, index) => `T${index}`) }));
    const body = await readJson(response);

    expect(response.status).toBe(400);
    expect(String(body.error)).toContain("Array must contain at most 50");
  });

  it("normalizes and deduplicates symbols before fetching", async () => {
    mockGetQuote.mockResolvedValue({ data: quote, warning: "quote warning" });

    const response = await POST(jsonRequest({ symbols: [" aapl ", "AAPL"] }));
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(mockGetQuote).toHaveBeenCalledTimes(1);
    expect(mockGetQuote).toHaveBeenCalledWith("AAPL", "US", { fresh: true, preferPublicQuote: false });
    expect(body.rows).toMatchObject([{
      symbol: "AAPL",
      quote,
      news: [],
      warnings: ["quote warning"]
    }]);
  });

  it("handles unexpected market provider failures safely", async () => {
    mockGetQuote.mockRejectedValue(new Error("provider down"));

    const response = await POST(jsonRequest({ symbols: ["IBM"] }));
    const body = await readJson(response);
    const rows = body.rows as Array<{ quote: MarketQuote; warnings: string[] }>;

    expect(response.status).toBe(200);
    expect(rows).toHaveLength(1);
    expect(rows[0].quote.symbol).toBe("IBM");
    expect(rows[0].quote.provider).toBe("unavailable");
    expect(rows[0].quote.error).toBe("provider down");
    expect(rows[0].warnings[0]).toContain("Market fetch failed for IBM");
  });

  it("uses the public quote provider when quotesOnly is true", async () => {
    mockGetQuote.mockResolvedValue({ data: quote });

    const response = await POST(jsonRequest({ symbols: ["AAPL"], quotesOnly: true }));
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(mockGetQuote).toHaveBeenCalledWith("AAPL", "US", { fresh: true, preferPublicQuote: true });
    expect(body.rows).toMatchObject([{ symbol: "AAPL", quote, news: [] }]);
  });

  it("returns rows with quote and warnings shape and never includes news", async () => {
    mockGetQuote.mockResolvedValue({ data: quote });

    const response = await POST(jsonRequest({ holdings: [{ symbol: "ibm", region: "US" }] }));
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(body.rows).toMatchObject([{
      symbol: "IBM",
      quote,
      news: [],
      warnings: []
    }]);
  });
});

