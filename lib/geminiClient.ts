import { GoogleGenAI } from "@google/genai";

const DEFAULT_MODEL = "gemini-2.5-flash";

export function isGeminiConfigured() {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

export function geminiModelName() {
  return process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
}

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new Error("GEMINI_API_KEY is missing");
  return new GoogleGenAI({ apiKey });
}

export async function generateGeminiJson(params: {
  systemInstruction: string;
  userContent: string;
  temperature?: number;
}) {
  const ai = getClient();
  const response = await ai.models.generateContent({
    model: geminiModelName(),
    contents: params.userContent,
    config: {
      systemInstruction: params.systemInstruction,
      responseMimeType: "application/json",
      temperature: params.temperature ?? 0.1
    }
  });
  return response.text ?? "{}";
}

export async function generateGeminiJsonFromImage(params: {
  systemInstruction: string;
  userText: string;
  imageMimeType: string;
  imageBase64: string;
}) {
  const ai = getClient();
  const response = await ai.models.generateContent({
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
  });
  return response.text ?? "{\"rows\":[],\"warnings\":[]}";
}
