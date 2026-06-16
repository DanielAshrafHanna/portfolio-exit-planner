import { afterEach, describe, expect, it, vi } from "vitest";

const { mockGenerate } = vi.hoisted(() => ({
  mockGenerate: vi.fn()
}));

vi.mock("@/lib/geminiClient", async () => {
  const actual = await vi.importActual<typeof import("@/lib/geminiClient")>("@/lib/geminiClient");
  return { ...actual, generateGeminiGroundedJson: mockGenerate };
});

import { POST } from "./route";

const originalGeminiKey = process.env.GEMINI_API_KEY;

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/analyzePortfolio", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

async function readJson(response: Response) {
  return await response.json() as Record<string, unknown>;
}

function holding(id: string, symbol: string) {
  return { id, symbol, name: symbol, shares: 2, averageCost: 100, totalCost: 200 };
}

function quote(symbol: string) {
  return { symbol, currentPrice: 125, dailyChangePercent: 1, previousClose: 124, ma20: 120, provider: "test" };
}

function validPayload() {
  return {
    region: "US",
    currency: "USD",
    items: [
      { holding: holding("1", "AAPL"), quote: quote("AAPL"), news: [] },
      { holding: holding("2", "MSFT"), quote: quote("MSFT"), news: [] }
    ]
  };
}

function analysisFor(symbol: string) {
  return {
    symbol,
    assetType: "Stock",
    action: "Keep",
    confidence: "Medium",
    riskLevel: "Medium",
    newsSentiment: "Neutral",
    trendStatus: "Bullish",
    upcomingCatalysts: [],
    summary: `Hold ${symbol}.`,
    reasonsToHold: ["Above moving average."],
    reasonsToSell: ["Watch momentum."],
    riskFlags: ["No verified upcoming catalyst found."],
    suggestedActionPlan: {
      primaryAction: "Keep",
      explanation: "Use a defined stop.",
      suggestedStopLoss: 110,
      suggestedTakeProfit: 140,
      reviewAfterCatalyst: false
    },
    sourcesUsed: []
  };
}

describe("/api/analyzePortfolio", () => {
  afterEach(() => {
    process.env.GEMINI_API_KEY = originalGeminiKey;
    vi.clearAllMocks();
  });

  it("rejects malformed request bodies", async () => {
    const response = await POST(jsonRequest({ items: [] }));
    expect(response.status).toBe(400);
  });

  it("falls back per holding when GEMINI_API_KEY is missing", async () => {
    delete process.env.GEMINI_API_KEY;
    const response = await POST(jsonRequest(validPayload()));
    const body = await readJson(response);
    const results = body.results as Array<Record<string, unknown>>;

    expect(response.status).toBe(200);
    expect(mockGenerate).not.toHaveBeenCalled();
    expect(results).toHaveLength(2);
    expect(body.warning).toContain("GEMINI_API_KEY is missing");
  });

  it("maps a grounded batch response back to each holding by symbol", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    mockGenerate.mockResolvedValue(JSON.stringify({ analyses: [analysisFor("AAPL"), analysisFor("MSFT")] }));

    const response = await POST(jsonRequest(validPayload()));
    const body = await readJson(response);
    const results = body.results as Array<{ id: string; analysis: { symbol: string }; fallback: boolean }>;

    expect(mockGenerate).toHaveBeenCalledTimes(1);
    expect(results.map((item) => item.analysis.symbol)).toEqual(["AAPL", "MSFT"]);
    expect(results.every((item) => item.fallback === false)).toBe(true);
    expect(body.warning).toBeUndefined();
  });

  it("uses fallback for holdings the AI omitted and warns", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    mockGenerate.mockResolvedValue(JSON.stringify({ analyses: [analysisFor("AAPL")] }));

    const response = await POST(jsonRequest(validPayload()));
    const body = await readJson(response);
    const results = body.results as Array<{ id: string; fallback: boolean }>;

    expect(results.find((item) => item.id === "2")?.fallback).toBe(true);
    expect(String(body.warning)).toContain("fallback");
  });

  it("falls back entirely when the AI returns junk", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    mockGenerate.mockResolvedValue("not json");

    const response = await POST(jsonRequest(validPayload()));
    const body = await readJson(response);
    const results = body.results as Array<{ fallback: boolean }>;

    expect(results.every((item) => item.fallback)).toBe(true);
    expect(String(body.warning)).toContain("malformed");
  });
});
