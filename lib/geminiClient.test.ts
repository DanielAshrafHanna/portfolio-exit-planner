import { describe, expect, it } from "vitest";
import { geminiModelName, isGeminiConfigured } from "./geminiClient";

describe("geminiClient config", () => {
  it("defaults to gemini-2.5-flash", () => {
    const original = process.env.GEMINI_MODEL;
    delete process.env.GEMINI_MODEL;
    expect(geminiModelName()).toBe("gemini-2.5-flash");
    process.env.GEMINI_MODEL = original;
  });

  it("detects missing API key", () => {
    const original = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    expect(isGeminiConfigured()).toBe(false);
    process.env.GEMINI_API_KEY = original;
  });
});
