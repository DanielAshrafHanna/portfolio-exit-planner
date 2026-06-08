import OpenAI from "openai";
import { NextResponse } from "next/server";
import { z } from "zod";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const ocrRowSchema = z.object({
  symbol: z.string().trim().max(24).catch(""),
  name: z.string().trim().max(160).catch(""),
  shares: z.unknown().optional(),
  averageCost: z.unknown().optional(),
  totalCost: z.unknown().optional(),
  brokerCurrentValue: z.unknown().optional(),
  notes: z.string().trim().max(1000).optional()
});

const ocrResponseSchema = z.object({
  rows: z.array(ocrRowSchema).default([]),
  warnings: z.array(z.string().trim().max(300)).default([]),
  rawSymbols: z.array(z.string().trim().max(24)).default([])
});

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({
      rows: [],
      unavailable: true,
      warning: "OPENAI_API_KEY is missing, so OCR extraction is unavailable. Please enter holdings manually or import CSV."
    });
  }
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_IMAGE_BYTES + 1024 * 1024) {
    return NextResponse.json({ error: "Image upload is too large. Please upload a screenshot under 8 MB." }, { status: 413 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("image");
    if (!(file instanceof File)) return NextResponse.json({ error: "image file is required" }, { status: 400 });
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      return NextResponse.json({ error: "Unsupported image type. Please upload a JPEG, PNG, or WebP screenshot." }, { status: 400 });
    }
    if (file.size > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: "Image is too large. Please upload a screenshot under 8 MB." }, { status: 413 });
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    const dataUrl = `data:${file.type};base64,${bytes.toString("base64")}`;
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_VISION_MODEL || "gpt-4o",
      response_format: { type: "json_object" },
      temperature: 0,
      messages: [
        {
          role: "system",
          content: [
            "You extract stock and ETF holdings from broker screenshots.",
            "Scan the entire image from top to bottom and left to right. Do not stop after the first visible rows.",
            "Return every visible holding row, including rows that are partially visible if the ticker/symbol is readable.",
            "Only use values visible in the image. Do not invent tickers, company names, share counts, costs, or values.",
            "Numbers may contain commas, currency symbols, parentheses, or negative signs. Convert them to plain numbers.",
            "If a field is unreadable, use null for numbers or an empty string for text.",
            "Return JSON only with this shape: {\"rows\":[{\"symbol\":\"string\",\"name\":\"string\",\"shares\":number|null,\"averageCost\":number|null,\"totalCost\":number|null,\"brokerCurrentValue\":number|null,\"notes\":\"string\"}],\"warnings\":[\"string\"],\"rawSymbols\":[\"string\"]}."
          ].join(" ")
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Extract all visible portfolio holding rows from this screenshot. Include every visible ticker. The user will confirm and edit fields before analysis." },
            { type: "image_url", image_url: { url: dataUrl, detail: "high" } }
          ]
        }
      ]
    });
    const decoded = safeJson(completion.choices[0]?.message.content || "{\"rows\":[],\"warnings\":[]}");
    if (decoded === undefined) {
      return NextResponse.json({
        rows: [],
        warning: "OCR returned unreadable JSON. Try a sharper screenshot, or import CSV/manual rows."
      }, { status: 422 });
    }
    const parsed = ocrResponseSchema.safeParse(decoded);
    if (!parsed.success) {
      return NextResponse.json({
        rows: [],
        warning: "OCR returned malformed JSON. Try a sharper screenshot, or import CSV/manual rows."
      }, { status: 422 });
    }
    const rows = parsed.data.rows;
    return NextResponse.json({
      rows: rows.map((row) => ({
        symbol: row.symbol.trim().toUpperCase(),
        name: row.name.trim(),
        shares: numberOrNull(row.shares),
        averageCost: numberOrNull(row.averageCost),
        totalCost: numberOrNull(row.totalCost),
        brokerCurrentValue: numberOrNull(row.brokerCurrentValue),
        notes: row.notes || "Extracted from image; confirm fields before analysis."
      })).filter((row) => row.symbol),
      warnings: parsed.data.warnings,
      rawSymbols: parsed.data.rawSymbols
    });
  } catch (error) {
    return NextResponse.json({ rows: [], warning: `OCR failed: ${error instanceof Error ? error.message : "Unknown error"}` }, { status: 500 });
  }
}

function numberOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const raw = String(value).trim();
  const isNegativeParentheses = raw.startsWith("(") && raw.endsWith(")");
  const cleaned = raw.replace(/[$,%\s,()]/g, "");
  const number = Number(cleaned);
  if (!Number.isFinite(number)) return null;
  return isNegativeParentheses ? -number : number;
}

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}
