import { afterEach, describe, expect, it, vi } from "vitest";

const { mockGenerate } = vi.hoisted(() => ({
  mockGenerate: vi.fn()
}));

vi.mock("@/lib/geminiClient", async () => {
  const actual = await vi.importActual<typeof import("@/lib/geminiClient")>("@/lib/geminiClient");
  return { ...actual, generateGeminiGroundedJson: mockGenerate };
});

import { POST } from "./route";
import { marketDateString } from "@/lib/marketSession";

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

describe("/api/analyzePortfolio", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("rejects malformed request bodies", async () => {
    const response = await POST(jsonRequest({ items: [] }));
    expect(response.status).toBe(400);
  });

  it("rejects manual refresh requests", async () => {
    const response = await POST(jsonRequest({ ...validPayload(), force: true }));
    const body = await readJson(response);

    expect(response.status).toBe(403);
    expect(String(body.error)).toContain("Manual AI refresh is disabled");
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it("returns data-only fallback without calling Gemini when no cache exists", async () => {
    const response = await POST(jsonRequest(validPayload()));
    const body = await readJson(response);
    const results = body.results as Array<{ analysis: { summary: string }; fallback: boolean }>;

    expect(response.status).toBe(200);
    expect(mockGenerate).not.toHaveBeenCalled();
    expect(results).toHaveLength(2);
    expect(results.every((item) => item.fallback)).toBe(true);
    expect(String(body.warning)).toContain("No daily AI cache for today");
  });

  it("returns cached analyses from clientDailyAiCache without calling Gemini", async () => {
    const marketDate = marketDateString("US", new Date());
    const response = await POST(jsonRequest({
      ...validPayload(),
      profileId: "us-portfolio",
      clientDailyAiCache: {
        entries: {
          "us-portfolio": {
            profileId: "us-portfolio",
            profileName: "US Portfolio",
            marketDate,
            generatedAt: "2099-01-01T20:00:00.000Z",
            summary: {
              overview: "Cached overview",
              marketContext: "",
              holdings: [{ symbol: "AAPL", action: "Keep", note: "Cached note." }],
              watchItems: [],
              sources: []
            },
            analysesBySymbol: {
              AAPL: {
                symbol: "AAPL",
                assetType: "Stock",
                action: "Keep",
                confidence: "Low",
                riskLevel: "Medium",
                newsSentiment: "Unknown",
                trendStatus: "Neutral",
                upcomingCatalysts: [],
                summary: "Cached AAPL.",
                reasonsToHold: [],
                reasonsToSell: [],
                riskFlags: [],
                suggestedActionPlan: {
                  primaryAction: "Keep",
                  explanation: "Hold.",
                  suggestedStopLoss: 100,
                  suggestedTakeProfit: 140,
                  reviewAfterCatalyst: false
                },
                sourcesUsed: []
              }
            },
            fallback: false,
            runType: "automatic"
          }
        }
      }
    }));
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(body.cached).toBe(true);
    expect(mockGenerate).not.toHaveBeenCalled();
  });
});
