import OpenAI from "openai";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({
      rows: [],
      unavailable: true,
      warning: "OPENAI_API_KEY is missing, so OCR extraction is unavailable. Please enter holdings manually or import CSV."
    });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("image");
    if (!(file instanceof File)) return NextResponse.json({ error: "image file is required" }, { status: 400 });
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
    const parsed = JSON.parse(completion.choices[0]?.message.content || "{\"rows\":[],\"warnings\":[]}");
    const rows = Array.isArray(parsed.rows) ? parsed.rows : [];
    return NextResponse.json({
      rows: rows.map((row: any) => ({
        symbol: typeof row.symbol === "string" ? row.symbol.trim().toUpperCase() : "",
        name: typeof row.name === "string" ? row.name.trim() : "",
        shares: numberOrNull(row.shares),
        averageCost: numberOrNull(row.averageCost),
        totalCost: numberOrNull(row.totalCost),
        brokerCurrentValue: numberOrNull(row.brokerCurrentValue),
        notes: typeof row.notes === "string" ? row.notes : "Extracted from image; confirm fields before analysis."
      })).filter((row: any) => row.symbol),
      warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
      rawSymbols: Array.isArray(parsed.rawSymbols) ? parsed.rawSymbols : []
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
