import { NextResponse } from "next/server";
import { getNews, getQuote } from "@/lib/marketData";

export async function POST(request: Request) {
  try {
    const { symbols } = await request.json();
    if (!Array.isArray(symbols)) return NextResponse.json({ error: "symbols must be an array" }, { status: 400 });
    const uniqueSymbols = [...new Set(symbols.map((symbol) => String(symbol).trim().toUpperCase()).filter(Boolean))];
    const rows = await Promise.all(uniqueSymbols.map(async (symbol) => {
      const [quote, news] = await Promise.all([getQuote(symbol), getNews(symbol)]);
      return { symbol, quote: quote.data, news: news.data, warnings: [quote.warning, news.warning].filter(Boolean) };
    }));
    return NextResponse.json({ rows });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed market fetch" }, { status: 500 });
  }
}
