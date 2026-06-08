import { afterEach, describe, expect, it, vi } from "vitest";

const { mockCreateClient } = vi.hoisted(() => ({
  mockCreateClient: vi.fn()
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: mockCreateClient
}));

import { POST } from "./route";

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/resolveLoginIdentifier", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

async function readJson(response: Response) {
  return await response.json() as Record<string, unknown>;
}

function mockSupabaseClient(rows: unknown[], email = "chantel@example.com") {
  const limit = vi.fn().mockResolvedValue({ data: rows, error: null });
  const ilike = vi.fn(() => ({ limit }));
  const select = vi.fn(() => ({ ilike }));
  const from = vi.fn(() => ({ select }));
  const getUserById = vi.fn().mockResolvedValue({ data: { user: { email } }, error: null });
  mockCreateClient.mockReturnValue({
    from,
    auth: { admin: { getUserById } }
  });
  return { from, getUserById, ilike };
}

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }
  process.env[name] = value;
}

describe("/api/resolveLoginIdentifier", () => {
  const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const originalServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  afterEach(() => {
    restoreEnv("NEXT_PUBLIC_SUPABASE_URL", originalUrl);
    restoreEnv("SUPABASE_SERVICE_ROLE_KEY", originalServiceKey);
    vi.clearAllMocks();
  });

  it("rejects malformed request bodies", async () => {
    const response = await POST(jsonRequest({}));
    const body = await readJson(response);

    expect(response.status).toBe(400);
    expect(body.error).toBeTruthy();
  });

  it("passes email identifiers through without service role lookup", async () => {
    const response = await POST(jsonRequest({ identifier: " USER@Example.COM " }));
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(body.email).toBe("user@example.com");
    expect(mockCreateClient).not.toHaveBeenCalled();
  });

  it("returns a safe error when display name login is not configured", async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    const response = await POST(jsonRequest({ identifier: "Chantel" }));
    const body = await readJson(response);

    expect(response.status).toBe(503);
    expect(body.error).toBe("Display name login is not configured. Please sign in with email.");
  });

  it("returns not found when no display name matches", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
    mockSupabaseClient([]);

    const response = await POST(jsonRequest({ identifier: "Chantel" }));
    const body = await readJson(response);

    expect(response.status).toBe(404);
    expect(body.error).toContain("No account found");
  });

  it("rejects ambiguous display names", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
    mockSupabaseClient([
      { user_id: "user-1", display_name: "Chantel" },
      { user_id: "user-2", display_name: "chantel" }
    ]);

    const response = await POST(jsonRequest({ identifier: "Chantel" }));
    const body = await readJson(response);

    expect(response.status).toBe(409);
    expect(body.error).toContain("More than one account");
  });

  it("resolves an exact display name to the user's email", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
    const { getUserById, ilike } = mockSupabaseClient([{ user_id: "user-1", display_name: "Chantel" }]);

    const response = await POST(jsonRequest({ identifier: "chantel" }));
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(body.email).toBe("chantel@example.com");
    expect(ilike).toHaveBeenCalledWith("display_name", "chantel");
    expect(getUserById).toHaveBeenCalledWith("user-1");
  });
});
