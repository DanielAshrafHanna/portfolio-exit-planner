import { NextResponse } from "next/server";
import { getNews, getQuote } from "@/lib/marketData";
import type { MarketRegion } from "@/lib/types";
import { marketRequestSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await safeJson(request);
    const parsed = marketRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid market request" }, { status: 400 });
    }
    const { symbols, holdings, region, quotesOnly } = parsed.data;
    const marketRegion: MarketRegion = region === "EG" ? "EG" : "US";
    const rawRows = holdings?.length
      ? holdings.map((holding) => ({
          symbol: holding.symbol.trim().toUpperCase(),
          region: holding.region || marketRegion
        }))
      : (symbols || []).map((symbol) => ({ symbol: symbol.trim().toUpperCase(), region: marketRegion }));

    const uniqueRows = Array.from(
      new Map(rawRows.filter((row) => row.symbol).map((row) => [`${row.region}:${row.symbol}`, row])).values()
    );
    const rows = await Promise.all(uniqueRows.map((row) => fetchMarketRow(row, quotesOnly === true)));
    return NextResponse.json({ rows });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed market fetch" }, { status: 500 });
  }
}

async function fetchMarketRow({ symbol, region }: { symbol: string; region: MarketRegion }, quotesOnly = false) {
  try {
    const quote = await getQuote(symbol, region, { fresh: true });
    if (quotesOnly) {
      return { symbol, quote: quote.data, news: [], warnings: [quote.warning].filter(Boolean) };
    }
    const news = await getNews(symbol, region);
    return { symbol, quote: quote.data, news: news.data, warnings: [quote.warning, news.warning].filter(Boolean) };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      symbol,
      quote: {
        symbol,
        currentPrice: 0,
        previousClose: 0,
        dailyChangePercent: 0,
        provider: "unavailable",
        error: message,
        stale: true
      },
      news: [],
      warnings: [`Market fetch failed for ${symbol}: ${message}`]
    };
  }
}

async function safeJson(request: Request) {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}
