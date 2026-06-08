import { afterEach, describe, expect, it, vi } from "vitest";

const { mockOpenAiCreate } = vi.hoisted(() => ({
  mockOpenAiCreate: vi.fn()
}));

vi.mock("openai", () => ({
  default: class MockOpenAI {
    chat = {
      completions: {
        create: mockOpenAiCreate
      }
    };
  }
}));

import { POST } from "./route";

const originalOpenAiKey = process.env.OPENAI_API_KEY;

function formRequest(formData: FormData) {
  return new Request("http://localhost/api/extractImage", {
    method: "POST",
    body: formData
  });
}

function formDataWithFile(file: File) {
  const formData = new FormData();
  formData.append("image", file);
  return formData;
}

function imageFile() {
  return new File([new Uint8Array([1, 2, 3])], "portfolio.png", { type: "image/png" });
}

function openAiResponse(content: string) {
  return {
    choices: [{
      message: { content }
    }]
  };
}

async function readJson(response: Response) {
  return await response.json() as Record<string, unknown>;
}

describe("/api/extractImage", () => {
  afterEach(() => {
    process.env.OPENAI_API_KEY = originalOpenAiKey;
    vi.clearAllMocks();
  });

  it("handles missing OPENAI_API_KEY safely", async () => {
    delete process.env.OPENAI_API_KEY;

    const response = await POST(formRequest(formDataWithFile(imageFile())));
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(mockOpenAiCreate).not.toHaveBeenCalled();
    expect(body.unavailable).toBe(true);
    expect(body.warning).toContain("OPENAI_API_KEY is missing");
  });

  it("rejects missing image", async () => {
    process.env.OPENAI_API_KEY = "test-key";

    const response = await POST(formRequest(new FormData()));
    const body = await readJson(response);

    expect(response.status).toBe(400);
    expect(body.error).toBe("image file is required");
  });

  it("rejects unsupported file types", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    const file = new File(["not an image"], "notes.txt", { type: "text/plain" });

    const response = await POST(formRequest(formDataWithFile(file)));
    const body = await readJson(response);

    expect(response.status).toBe(400);
    expect(body.error).toContain("Unsupported image type");
  });

  it("rejects files over the size limit", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    const response = await POST(new Request("http://localhost/api/extractImage", {
      method: "POST",
      headers: { "content-length": String(10 * 1024 * 1024) }
    }));
    const body = await readJson(response);

    expect(response.status).toBe(413);
    expect(body.error).toContain("too large");
  });

  it("handles malformed OCR JSON safely", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    mockOpenAiCreate.mockResolvedValue(openAiResponse("not json"));

    const response = await POST(formRequest(formDataWithFile(imageFile())));
    const body = await readJson(response);

    expect(response.status).toBe(422);
    expect(body.rows).toEqual([]);
    expect(body.warning).toContain("unreadable JSON");
  });

  it("returns normalized rows only", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    mockOpenAiCreate.mockResolvedValue(openAiResponse(JSON.stringify({
      rows: [
        { symbol: "", name: "Unreadable", shares: 1, averageCost: 2, totalCost: 2 },
        {
          symbol: " tsm ",
          name: " Taiwan Semiconductor ",
          shares: "8",
          averageCost: "$142.50",
          totalCost: "$1,140.00",
          brokerCurrentValue: "$3,500.25",
          notes: ""
        }
      ],
      warnings: ["Confirm extracted rows."],
      rawSymbols: ["TSM"]
    })));

    const response = await POST(formRequest(formDataWithFile(imageFile())));
    const body = await readJson(response);
    const rows = body.rows as Array<Record<string, unknown>>;

    expect(response.status).toBe(200);
    expect(rows).toEqual([{
      symbol: "TSM",
      name: "Taiwan Semiconductor",
      shares: 8,
      averageCost: 142.5,
      totalCost: 1140,
      brokerCurrentValue: 3500.25,
      notes: "Extracted from image; confirm fields before analysis."
    }]);
    expect(body.warnings).toEqual(["Confirm extracted rows."]);
    expect(body.rawSymbols).toEqual(["TSM"]);
  });
});
