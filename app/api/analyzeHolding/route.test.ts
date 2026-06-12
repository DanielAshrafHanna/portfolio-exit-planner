import { afterEach, describe, expect, it, vi } from "vitest";

const { mockGenerateGeminiJson } = vi.hoisted(() => ({
  mockGenerateGeminiJson: vi.fn()
}));

vi.mock("@/lib/geminiClient", () => ({
  isGeminiConfigured: () => Boolean(process.env.GEMINI_API_KEY?.trim()),
  generateGeminiJson: mockGenerateGeminiJson
}));

import { POST } from "./route";

const originalGeminiKey = process.env.GEMINI_API_KEY;

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/analyzeHolding", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

async function readJson(response: Response) {
  return await response.json() as Record<string, unknown>;
}

const validHolding = {
  id: "1",
  symbol: "AAPL",
  name: "Apple",
  shares: 2,
  averageCost: 100,
  totalCost: 200
};

const validQuote = {
  symbol: "AAPL",
  currentPrice: 125,
  dailyChangePercent: 1,
  previousClose: 124,
  ma20: 120,
  provider: "test"
};

const validNews = [{
  headline: "Apple headline",
  source: "Test News",
  date: "2026-06-08",
  url: "https://example.com/aapl",
  summary: "A summary."
}];

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    holding: validHolding,
    quote: validQuote,
    news: validNews,
    ...overrides
  };
}

describe("/api/analyzeHolding", () => {
  afterEach(() => {
    process.env.GEMINI_API_KEY = originalGeminiKey;
    vi.clearAllMocks();
  });

  it("rejects malformed request bodies", async () => {
    const response = await POST(jsonRequest({ holding: { symbol: "AAPL" } }));
    const body = await readJson(response);

    expect(response.status).toBe(400);
    expect(body.error).toBeTruthy();
  });

  it("rejects more than 12 news items", async () => {
    const response = await POST(jsonRequest(validPayload({
      news: Array.from({ length: 13 }, () => validNews[0])
    })));
    const body = await readJson(response);

    expect(response.status).toBe(400);
    expect(String(body.error)).toContain("Array must contain at most 12");
  });

  it("falls back when GEMINI_API_KEY is missing", async () => {
    delete process.env.GEMINI_API_KEY;

    const response = await POST(jsonRequest(validPayload()));
    const body = await readJson(response);
    const analysis = body.analysis as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(mockGenerateGeminiJson).not.toHaveBeenCalled();
    expect(body.warning).toContain("GEMINI_API_KEY is missing");
    expect(analysis.confidence).toBe("Low");
    expect(analysis.symbol).toBe("AAPL");
  });

  it("falls back safely when Gemini returns malformed JSON", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    mockGenerateGeminiJson.mockResolvedValue("not json");

    const response = await POST(jsonRequest(validPayload()));
    const body = await readJson(response);
    const analysis = body.analysis as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body.warning).toContain("malformed analysis JSON");
    expect(analysis.confidence).toBe("Low");
    expect(analysis.symbol).toBe("AAPL");
  });

  it("validates and normalizes AI analysis output before returning it", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    mockGenerateGeminiJson.mockResolvedValue(JSON.stringify({
      symbol: "aapl",
      assetType: "Stock",
      action: "Watch",
      confidence: "Medium",
      riskLevel: "Medium",
      newsSentiment: "Neutral",
      trendStatus: "Bullish",
      upcomingCatalysts: [],
      summary: "Monitor the position.",
      reasonsToHold: ["Price is above the supplied moving average."],
      reasonsToSell: ["News is not decisive."],
      riskFlags: ["No verified upcoming catalyst found."],
      suggestedActionPlan: {
        primaryAction: "Watch",
        explanation: "Use a defined stop and review news.",
        suggestedStopLoss: 110,
        suggestedTakeProfit: 140,
        reviewAfterCatalyst: false
      },
      sourcesUsed: []
    }));

    const response = await POST(jsonRequest(validPayload()));
    const body = await readJson(response);
    const analysis = body.analysis as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body.warning).toBeUndefined();
    expect(analysis.symbol).toBe("AAPL");
    expect(analysis.action).toBe("Watch");
    expect(analysis.confidence).toBe("Medium");
  });
});
