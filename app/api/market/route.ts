import { NextResponse } from "next/server";
import { ALPHA_VANTAGE_REQUEST_GAP_MS, getQuote, usesAlphaVantageQuotes } from "@/lib/marketData";
import type { MarketRegion } from "@/lib/types";
import { marketRequestSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
    const rows = usesAlphaVantageQuotes() && quotesOnly !== true
      ? await fetchMarketRowsSequentially(uniqueRows)
      : await Promise.all(uniqueRows.map((row) => fetchMarketRow(row, quotesOnly === true)));
    return NextResponse.json({ rows });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed market fetch" }, { status: 500 });
  }
}

async function fetchMarketRowsSequentially(
  rows: Array<{ symbol: string; region: MarketRegion }>
) {
  const results = [];
  for (let index = 0; index < rows.length; index += 1) {
    results.push(await fetchMarketRow(rows[index], false));
    if (index < rows.length - 1) await sleep(ALPHA_VANTAGE_REQUEST_GAP_MS);
  }
  return results;
}

async function fetchMarketRow({ symbol, region }: { symbol: string; region: MarketRegion }, quotesOnly = false) {
  try {
    const quote = await getQuote(symbol, region, {
      fresh: true,
      // Quote-only refreshes (e.g. before grounded AI analysis) skip Alpha Vantage to preserve quota.
      preferPublicQuote: quotesOnly
    });
    // News is no longer fetched here; the grounded AI analysis sources its own recent news/catalysts.
    return { symbol, quote: quote.data, news: [], warnings: [quote.warning].filter(Boolean) };
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
