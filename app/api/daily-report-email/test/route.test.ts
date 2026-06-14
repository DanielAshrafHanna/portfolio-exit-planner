import { afterEach, describe, expect, it, vi } from "vitest";

const { mockGetUser, mockPortfolioSelect, mockBuildPortfolioReport, mockFetchSeries, mockSendDailyReportEmail } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockPortfolioSelect: vi.fn(),
  mockBuildPortfolioReport: vi.fn(),
  mockFetchSeries: vi.fn(),
  mockSendDailyReportEmail: vi.fn()
}));

vi.mock("@/lib/supabaseServer", () => ({
  bearerTokenFromRequest: () => "test-token",
  createSupabaseUserClient: () => ({
    auth: { getUser: mockGetUser },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: mockPortfolioSelect
        })
      })
    })
  })
}));

vi.mock("@/lib/portfolioReport", () => ({
  buildPortfolioReport: mockBuildPortfolioReport
}));

vi.mock("@/lib/portfolioReportHistory", () => ({
  fetchUserWeeklyChartSeries: mockFetchSeries
}));

vi.mock("@/lib/emailReport", () => ({
  sendDailyReportEmail: mockSendDailyReportEmail
}));

import { POST } from "./route";

function postRequest(body: unknown) {
  return new Request("http://localhost/api/daily-report-email/test", {
    method: "POST",
    headers: {
      Authorization: "Bearer test-token",
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
}

describe("/api/daily-report-email/test", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("rejects invalid email addresses", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1", email: "owner@example.com" } }, error: null });
    const response = await POST(postRequest({ email: "not-an-email" }));
    expect(response.status).toBe(400);
  });

  it("sends a test email to the requested address", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1", email: "owner@example.com" } }, error: null });
    mockPortfolioSelect.mockResolvedValue({
      data: {
        holdings: [],
        settings: { dailyReportEmail: "saved@example.com", dailyReportEmailEnabled: true },
        display_name: "Daniel",
        user_id: "user-1"
      },
      error: null
    });
    mockBuildPortfolioReport.mockResolvedValue({
      generatedAt: "2026-06-14T22:00:00.000Z",
      textDigest: "summary",
      htmlDigest: "<p>summary</p>",
      totalsByCurrency: [],
      profiles: [],
      holdings: [],
      warnings: []
    });
    mockFetchSeries.mockResolvedValue([]);
    mockSendDailyReportEmail.mockResolvedValue({ configured: true, sent: true });

    const response = await POST(postRequest({ email: "user@example.com" }));
    const body = await response.json() as { ok?: boolean; sentTo?: string };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.sentTo).toBe("user@example.com");
    expect(mockSendDailyReportEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: "user@example.com",
      subjectPrefix: "[Test]"
    }));
  });
});
