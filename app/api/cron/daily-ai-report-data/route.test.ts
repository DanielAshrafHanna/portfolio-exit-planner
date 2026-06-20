import { afterEach, describe, expect, it, vi } from "vitest";

const { mockFetchDailyAiReportData, mockCreateSupabaseAdminClient } = vi.hoisted(() => ({
  mockFetchDailyAiReportData: vi.fn(),
  mockCreateSupabaseAdminClient: vi.fn(() => ({}))
}));

vi.mock("@/lib/dailyAiReportData", async () => {
  const actual = await vi.importActual<typeof import("@/lib/dailyAiReportData")>("@/lib/dailyAiReportData");
  return {
    ...actual,
    fetchDailyAiReportData: mockFetchDailyAiReportData
  };
});

vi.mock("@/lib/supabaseServer", () => ({
  createSupabaseAdminClient: mockCreateSupabaseAdminClient
}));

import { GET } from "./route";

function getRequest(query = "email=owner@example.com") {
  return new Request(`http://localhost/api/cron/daily-ai-report-data?${query}`, {
    headers: { Authorization: "Bearer test-secret" }
  });
}

describe("/api/cron/daily-ai-report-data", () => {
  const originalSecret = process.env.CRON_SECRET;

  afterEach(() => {
    vi.clearAllMocks();
    if (originalSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = originalSecret;
  });

  it("rejects missing CRON_SECRET", async () => {
    delete process.env.CRON_SECRET;
    const response = await GET(getRequest());
    expect(response.status).toBe(503);
  });

  it("rejects unauthorized requests", async () => {
    process.env.CRON_SECRET = "test-secret";
    const response = await GET(new Request("http://localhost/api/cron/daily-ai-report-data?email=owner@example.com"));
    expect(response.status).toBe(401);
  });

  it("rejects invalid profileId values", async () => {
    process.env.CRON_SECRET = "test-secret";
    const response = await GET(getRequest("email=owner@example.com&profileId=bad-profile"));
    expect(response.status).toBe(400);
  });

  it("returns report payload for authorized requests", async () => {
    process.env.CRON_SECRET = "test-secret";
    mockFetchDailyAiReportData.mockResolvedValue({
      data: {
        ok: true,
        email: "owner@example.com",
        userId: "user-1",
        ownershipVerified: true,
        profileId: "us-portfolio",
        activeProfileId: "us-portfolio",
        availableProfiles: [],
        generatedAt: "2026-06-18T22:00:00.000Z",
        cloudUpdatedAt: null,
        profiles: [],
        history: [],
        warnings: []
      }
    });

    const response = await GET(getRequest("email=owner@example.com&profileId=us-portfolio&historyDays=7"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.profileId).toBe("us-portfolio");
    expect(mockFetchDailyAiReportData).toHaveBeenCalledWith({}, expect.objectContaining({
      email: "owner@example.com",
      profileId: "us-portfolio",
      historyDays: 7
    }));
  });
});
