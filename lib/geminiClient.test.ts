import { describe, expect, it } from "vitest";
import { extractJsonPayload, gapForModel, geminiModelName, isGeminiConfigured, isGeminiRateLimitError, formatGeminiError } from "./geminiClient";

describe("geminiClient config", () => {
  it("defaults to gemini-3.1-flash-lite for newer free-tier RPM", () => {
    const original = process.env.GEMINI_MODEL;
    delete process.env.GEMINI_MODEL;
    expect(geminiModelName()).toBe("gemini-3.1-flash-lite");
    process.env.GEMINI_MODEL = original;
  });

  it("detects missing API key", () => {
    const original = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    expect(isGeminiConfigured()).toBe(false);
    process.env.GEMINI_API_KEY = original;
  });
});

describe("geminiAnalyzeRequestGapMs", () => {
  it("paces flash-lite models faster than full flash models", () => {
    expect(gapForModel("gemini-3.1-flash-lite")).toBe(4500);
    expect(gapForModel("gemini-3.5-flash")).toBe(13_000);
    expect(gapForModel("gemini-2.5-flash")).toBe(13_000);
  });
});

describe("extractJsonPayload", () => {
  it("parses plain JSON", () => {
    expect(extractJsonPayload('{"a":1}')).toEqual({ a: 1 });
  });

  it("parses JSON inside markdown fences", () => {
    expect(extractJsonPayload('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it("extracts JSON embedded in surrounding prose", () => {
    expect(extractJsonPayload('Here is the result: {"analyses":[]} thanks')).toEqual({ analyses: [] });
  });

  it("returns undefined for non-JSON text", () => {
    expect(extractJsonPayload("no json here")).toBeUndefined();
  });
});

describe("geminiClient errors", () => {
  it("detects rate limit errors", () => {
    expect(isGeminiRateLimitError(new Error('{"error":{"code":429,"status":"RESOURCE_EXHAUSTED"}}'))).toBe(true);
  });

  it("formats rate limit errors without dumping raw JSON", () => {
    const message = formatGeminiError(new Error('quota exceeded 429 RESOURCE_EXHAUSTED retry in 14s'));
    expect(message).toContain("Gemini daily quota");
    expect(message).not.toContain("generativelanguage.googleapis.com");
  });
});
