import { GoogleGenAI } from "@google/genai";

/** Free tier default: gemini-3.1-flash-lite (~15 RPM, multimodal + JSON). */
const DEFAULT_MODEL = "gemini-3.1-flash-lite";

/** @deprecated Use geminiAnalyzeRequestGapMs() — kept for tests referencing the constant. */
export const GEMINI_CLIENT_REQUEST_GAP_MS = 4500;

const MAX_RATE_LIMIT_RETRIES = 4;

export function isGeminiConfigured() {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

export function geminiModelName() {
  return process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
}

/** Pacing between portfolio analyze calls — slower for 5 RPM models like gemini-3.5-flash. */
export function geminiAnalyzeRequestGapMs(model = geminiModelName()) {
  const override = Number(process.env.GEMINI_REQUEST_GAP_MS);
  if (Number.isFinite(override) && override > 0) return override;
  return gapForModel(model);
}

export function gapForModel(model: string) {
  const id = model.trim().toLowerCase();
  if (id.includes("flash-lite")) return 4500;
  if (id.includes("3.5-flash") || (id.includes("2.5-flash") && !id.includes("lite"))) return 13_000;
  if (id.includes("3-flash") && !id.includes("lite")) return 7000;
  return 4500;
}

export function isGeminiRateLimitError(error: unknown) {
  const message = errorMessage(error);
  return message.includes("429")
    || message.includes("RESOURCE_EXHAUSTED")
    || message.includes("quota")
    || message.includes("rate limit");
}

export function formatGeminiError(error: unknown, label = "AI analysis") {
  if (isGeminiRateLimitError(error)) {
    return "Gemini daily quota reached, so this is data-only fallback analysis (no AI commentary). The quota resets on Google's schedule — try Refresh AI again later, or rely on the cached daily run.";
  }
  const message = errorMessage(error).trim();
  return message ? `${label} unavailable: ${message}` : `${label} unavailable.`;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function retryDelayMs(error: unknown) {
  const match = errorMessage(error).match(/retry in ([\d.]+)s/i);
  if (match) return Math.ceil(Number(match[1]) * 1000) + 500;
  return 15_000;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new Error("GEMINI_API_KEY is missing");
  return new GoogleGenAI({ apiKey });
}

async function generateWithRetry<T>(run: () => Promise<T>) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_RATE_LIMIT_RETRIES; attempt++) {
    try {
      return await run();
    } catch (error) {
      lastError = error;
      if (!isGeminiRateLimitError(error) || attempt === MAX_RATE_LIMIT_RETRIES) throw error;
      await sleep(retryDelayMs(error));
    }
  }
  throw lastError;
}

export async function generateGeminiJson(params: {
  systemInstruction: string;
  userContent: string;
  temperature?: number;
}) {
  const response = await generateWithRetry(() => getClient().models.generateContent({
    model: geminiModelName(),
    contents: params.userContent,
    config: {
      systemInstruction: params.systemInstruction,
      responseMimeType: "application/json",
      temperature: params.temperature ?? 0.1
    }
  }));
  return response.text ?? "{}";
}

/**
 * Generate JSON with Google Search grounding enabled so the model can cite
 * real, recent news instead of inventing it. Grounding is incompatible with
 * forced JSON response mime type, so we instruct JSON-only output and extract
 * the JSON payload from the response text.
 */
export async function generateGeminiGroundedJson(params: {
  systemInstruction: string;
  userContent: string;
  temperature?: number;
}) {
  const response = await generateWithRetry(() => getClient().models.generateContent({
    model: geminiModelName(),
    contents: params.userContent,
    config: {
      systemInstruction: `${params.systemInstruction}\n\nReturn ONLY valid minified JSON with no markdown fences or commentary.`,
      tools: [{ googleSearch: {} }],
      temperature: params.temperature ?? 0.2
    }
  }));
  return response.text ?? "{}";
}

/** Extract a JSON object/array from model text that may include prose or ``` fences. */
export function extractJsonPayload(raw: string): unknown {
  if (!raw) return undefined;
  const direct = tryParseJson(raw);
  if (direct !== undefined) return direct;

  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    const parsed = tryParseJson(fenced[1].trim());
    if (parsed !== undefined) return parsed;
  }

  const firstBrace = raw.search(/[[{]/);
  if (firstBrace === -1) return undefined;
  const lastBrace = Math.max(raw.lastIndexOf("}"), raw.lastIndexOf("]"));
  if (lastBrace <= firstBrace) return undefined;
  return tryParseJson(raw.slice(firstBrace, lastBrace + 1));
}

function tryParseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

export async function generateGeminiJsonFromImage(params: {
  systemInstruction: string;
  userText: string;
  imageMimeType: string;
  imageBase64: string;
}) {
  const response = await generateWithRetry(() => getClient().models.generateContent({
    model: geminiModelName(),
    contents: [{
      role: "user",
      parts: [
        { text: params.userText },
        { inlineData: { mimeType: params.imageMimeType, data: params.imageBase64 } }
      ]
    }],
    config: {
      systemInstruction: params.systemInstruction,
      responseMimeType: "application/json",
      temperature: 0
    }
  }));
  return response.text ?? "{\"rows\":[],\"warnings\":[]}";
}
