import { NextResponse } from "next/server";
import { geminiAnalyzeRequestGapMs, geminiModelName, isGeminiConfigured } from "@/lib/geminiClient";

export function GET() {
  const model = geminiModelName();
  return NextResponse.json({
    configured: isGeminiConfigured(),
    model,
    requestGapMs: geminiAnalyzeRequestGapMs(model),
    usageHint: "One grounded Gemini call per profile per market day at market close. Manual refresh is disabled."
  });
}
