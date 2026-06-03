import OpenAI from "openai";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({
      rows: [],
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
      model: process.env.OPENAI_VISION_MODEL || "gpt-4o-mini",
      response_format: { type: "json_object" },
      temperature: 0,
      messages: [
        {
          role: "system",
          content: "Extract portfolio holdings from the image. Return JSON only: {\"rows\":[{\"symbol\":\"string\",\"name\":\"string\",\"shares\":number,\"averageCost\":number,\"totalCost\":number,\"brokerCurrentValue\":number|null,\"notes\":\"string\"}]}. If a value is uncertain, use null or empty string. Do not infer missing ticker symbols."
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Extract editable portfolio rows from this broker screenshot. The user will confirm before analysis." },
            { type: "image_url", image_url: { url: dataUrl } }
          ]
        }
      ]
    });
    return NextResponse.json(JSON.parse(completion.choices[0]?.message.content || "{\"rows\":[]}"));
  } catch (error) {
    return NextResponse.json({ rows: [], warning: `OCR failed: ${error instanceof Error ? error.message : "Unknown error"}` }, { status: 500 });
  }
}
