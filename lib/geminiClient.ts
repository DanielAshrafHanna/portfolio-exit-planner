import { GoogleGenAI } from "@google/genai";

/** Free tier: gemini-2.0-flash allows ~15 RPM vs ~5 RPM for 2.5-flash. */
const DEFAULT_MODEL = "gemini-2.0-flash";

/** Minimum gap between analyze API calls from the client (ms). */
export const GEMINI_CLIENT_REQUEST_GAP_MS = 4500;

const MAX_RATE_LIMIT_RETRIES = 4;

export function isGeminiConfigured() {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

export function geminiModelName() {
  return process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
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
    return "Gemini free tier rate limit reached. Analysis runs one holding at a time with automatic retries — wait a moment and try again if some rows still show fallback analysis.";
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
