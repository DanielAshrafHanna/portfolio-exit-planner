import { NextResponse } from "next/server";
import { getNews, getQuote } from "@/lib/marketData";
import type { MarketRegion } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const { symbols, holdings, region } = await request.json();
    const marketRegion: MarketRegion = region === "EG" ? "EG" : "US";
    const rawRows = Array.isArray(holdings)
      ? holdings.map((holding) => ({
          symbol: String(holding.symbol || "").trim().toUpperCase(),
          region: holding.region === "EG" ? "EG" as const : holding.region === "US" ? "US" as const : marketRegion
        }))
      : Array.isArray(symbols)
        ? symbols.map((symbol) => ({ symbol: String(symbol).trim().toUpperCase(), region: marketRegion }))
        : undefined;

    if (!rawRows) return NextResponse.json({ error: "symbols or holdings must be an array" }, { status: 400 });

    const uniqueRows = Array.from(
      new Map(rawRows.filter((row) => row.symbol).map((row) => [`${row.region}:${row.symbol}`, row])).values()
    );
    const rows = await Promise.all(uniqueRows.map(async ({ symbol, region: rowRegion }) => {
      const [quote, news] = await Promise.all([getQuote(symbol, rowRegion), getNews(symbol, rowRegion)]);
      return { symbol, quote: quote.data, news: news.data, warnings: [quote.warning, news.warning].filter(Boolean) };
    }));
    return NextResponse.json({ rows });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed market fetch" }, { status: 500 });
  }
}
