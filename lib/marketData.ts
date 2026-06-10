import type { MarketQuote, MarketRegion, NewsItem } from "./types";
import { normalizeMarketSymbol } from "./profileUtils";
import { mockNews, mockQuote } from "./sampleData";
import { getUnsupportedTickerMessage } from "./unsupportedTickers";

const ALPHA_URL = "https://www.alphavantage.co/query";
const MUBASHER_EGX_URL = "https://english.mubasher.info/markets/EGX/stocks";
const MUBASHER_FETCH_HEADERS = {
  "User-Agent": "Mozilla/5.0 (compatible; PortfolioExitPlanner/1.0)",
  Accept: "text/html,application/xhtml+xml",
  "Accept-Language": "en-US,en;q=0.9"
};

type QuoteFetchOptions = {
  fresh?: boolean;
};

function providerFetch(url: string, init: RequestInit = {}, fresh = false) {
  return fetch(url, {
    ...init,
    ...(fresh ? { cache: "no-store" as const } : { next: { revalidate: 300 } }),
    headers: { ...MUBASHER_FETCH_HEADERS, ...init.headers }
  });
}

function mubasherFetch(url: string, fresh = false) {
  return providerFetch(url, {}, fresh);
}
const YAHOO_NEWS_RSS = "https://feeds.finance.yahoo.com/rss/2.0/headline";
const YAHOO_CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart";

type ProviderResult<T> = {
  data: T;
  warning?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function providerName() {
  return process.env.MARKET_DATA_PROVIDER || "mock";
}

function apiKey() {
  return process.env.MARKET_DATA_API_KEY || process.env.ALPHA_VANTAGE_API_KEY;
}

async function fetchAlpha(params: Record<string, string>) {
  const key = apiKey();
  if (!key) throw new Error("Missing MARKET_DATA_API_KEY");
  const url = new URL(ALPHA_URL);
  Object.entries({ ...params, apikey: key }).forEach(([name, value]) => url.searchParams.set(name, value));
  const response = await fetch(url, { next: { revalidate: 300 } });
  if (!response.ok) throw new Error(`Alpha Vantage failed with ${response.status}`);
  const data = await response.json();
  if (data.Note || data.Information) throw new Error(data.Note || data.Information);
  return data;
}

function movingAverage(values: number[], length: number) {
  const slice = values.slice(0, length);
  if (slice.length < length) return undefined;
  return Math.round((slice.reduce((sum, value) => sum + value, 0) / length) * 100) / 100;
}

function calculateAtr(rows: Array<{ high: number; low: number; close: number }>, length = 14) {
  if (rows.length <= length) return undefined;
  const trueRanges = rows.slice(0, length).map((row, index) => {
    const previousClose = rows[index + 1]?.close ?? row.close;
    return Math.max(row.high - row.low, Math.abs(row.high - previousClose), Math.abs(row.low - previousClose));
  });
  return Math.round((trueRanges.reduce((sum, value) => sum + value, 0) / trueRanges.length) * 100) / 100;
}

function calculateRsi(closes: number[], length = 14) {
  if (closes.length <= length) return undefined;
  let gains = 0;
  let losses = 0;
  for (let index = 0; index < length; index += 1) {
    const change = closes[index] - closes[index + 1];
    if (change >= 0) gains += change;
    else losses += Math.abs(change);
  }
  if (losses === 0) return 100;
  const rs = gains / length / (losses / length);
  return Math.round((100 - 100 / (1 + rs)) * 10) / 10;
}

async function alphaQuote(symbol: string): Promise<MarketQuote> {
  const [quoteData, dailyData] = await Promise.all([
    fetchAlpha({ function: "GLOBAL_QUOTE", symbol }),
    fetchAlpha({ function: "TIME_SERIES_DAILY_ADJUSTED", symbol, outputsize: "full" })
  ]);
  const quote = isRecord(quoteData) && isRecord(quoteData["Global Quote"]) ? quoteData["Global Quote"] : undefined;
  const series = isRecord(dailyData) && isRecord(dailyData["Time Series (Daily)"]) ? dailyData["Time Series (Daily)"] : undefined;
  if (!quote?.["05. price"] || !series) throw new Error(`Invalid ticker or unavailable quote for ${symbol}`);
  const rows = Object.values(series).map((row) => {
    const dailyRow = isRecord(row) ? row : {};
    return {
      high: Number(dailyRow["2. high"]),
      low: Number(dailyRow["3. low"]),
      close: Number(dailyRow["4. close"]),
      volume: Number(dailyRow["6. volume"])
    };
  }).filter((row) => Number.isFinite(row.high) && Number.isFinite(row.low) && Number.isFinite(row.close));
  if (!rows.length) throw new Error(`Daily price history is unavailable for ${symbol}`);
  const closes = rows.map((row) => row.close);
  return {
    symbol,
    currentPrice: Number(Number(quote["05. price"]).toFixed(2)),
    dailyChangePercent: Number(String(quote["10. change percent"]).replace("%", "")),
    previousClose: Number(Number(quote["08. previous close"]).toFixed(2)),
    week52High: Math.max(...closes.slice(0, 252)),
    week52Low: Math.min(...closes.slice(0, 252)),
    volume: Number(quote["06. volume"]),
    ma20: movingAverage(closes, 20),
    ma50: movingAverage(closes, 50),
    ma200: movingAverage(closes, 200),
    atr: calculateAtr(rows),
    rsi: calculateRsi(closes),
    provider: "alpha_vantage"
  };
}

export async function getQuote(
  symbol: string,
  region: MarketRegion = "US",
  options: QuoteFetchOptions = {}
): Promise<ProviderResult<MarketQuote>> {
  const cleanSymbol = symbol.trim().toUpperCase();
  const marketSymbol = normalizeMarketSymbol(cleanSymbol, region);
  if (!cleanSymbol) throw new Error("Ticker is required");
  const unsupportedMessage = getUnsupportedTickerMessage(cleanSymbol, region);
  if (unsupportedMessage) {
    return {
      data: {
        symbol: cleanSymbol,
        currentPrice: 0,
        previousClose: 0,
        dailyChangePercent: 0,
        provider: "unavailable",
        error: unsupportedMessage
      },
      warning: unsupportedMessage
    };
  }
  if (region === "EG") {
    const mubasherQuote = await getMubasherEgxQuote(cleanSymbol, options.fresh);
    if (mubasherQuote) {
      return {
        data: mubasherQuote,
        warning: "Egypt quotes are fetched from Mubasher EGX pages because Yahoo Finance can return stale EGX prices."
      };
    }
    return {
      data: {
        symbol: cleanSymbol,
        currentPrice: 0,
        previousClose: 0,
        dailyChangePercent: 0,
        provider: "unavailable",
        error: `No live EGX stock quote was found for ${cleanSymbol}.`
      },
      warning: `${cleanSymbol} has no live EGX stock quote. If this is a mutual fund, it is not supported here.`
    };
  }
  if (providerName() !== "alpha_vantage" || !apiKey()) {
    const yahooQuote = await getYahooQuote(marketSymbol, cleanSymbol, options.fresh);
    if (yahooQuote) {
      return {
        data: { ...yahooQuote, symbol: cleanSymbol },
        warning: "Market API key is missing, so quotes are fetched from Yahoo Finance's public chart feed."
      };
    }
    return {
      data: mockQuote(cleanSymbol),
      warning: `Market API key is missing and no public quote was found for ${cleanSymbol}. Showing sample market data.`
    };
  }
  try {
    return { data: await alphaQuote(marketSymbol) };
  } catch (error) {
    return {
      data: { ...mockQuote(cleanSymbol), error: error instanceof Error ? error.message : "Failed quote fetch" },
      warning: `Quote fetch failed for ${cleanSymbol}; showing sample data.`
    };
  }
}

async function getMubasherEgxQuote(symbol: string, fresh = false): Promise<MarketQuote | undefined> {
  try {
    const response = await mubasherFetch(`${MUBASHER_EGX_URL}/${encodeURIComponent(symbol)}`, fresh);
    if (!response.ok) return undefined;
    return parseMubasherEgxQuote(await response.text(), symbol);
  } catch {
    return undefined;
  }
}

export function parseMubasherEgxQuote(html: string, symbol: string): MarketQuote | undefined {
  const currentPrice = numberFromClass(html, "market-summary__last-price");
  const previousClose = numberForLabel(html, "Previous Close");
  if (!currentPrice || !previousClose) return undefined;
  const volume = numberForLabel(html, "Volume");
  return {
    symbol,
    currentPrice,
    dailyChangePercent: previousClose > 0 ? Number((((currentPrice - previousClose) / previousClose) * 100).toFixed(2)) : 0,
    previousClose,
    volume,
    provider: "mubasher_egx"
  };
}

function numberFromClass(html: string, className: string) {
  const escapedClassName = className.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = html.match(new RegExp(`<[^>]+class="[^"]*${escapedClassName}[^"]*"[^>]*>\\s*([\\d,.]+)\\s*<`, "i"));
  return match ? parseFormattedNumber(match[1]) : undefined;
}

function numberForLabel(html: string, label: string) {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = html.match(new RegExp(`<span class="market-summary__block-text">\\s*${escapedLabel}\\s*<\\/span>\\s*<span class="market-summary__block-number">\\s*([\\d,.]+)\\s*<\\/span>`, "i"));
  return match ? parseFormattedNumber(match[1]) : undefined;
}

function parseFormattedNumber(value: string) {
  const parsed = Number(value.replaceAll(",", "").trim());
  return Number.isFinite(parsed) ? parsed : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function nullableNumberArray(value: unknown): Array<number | null> {
  return Array.isArray(value) ? value.map((item) => numberValue(item) ?? null) : [];
}

export async function getNews(symbol: string, region: MarketRegion = "US"): Promise<ProviderResult<NewsItem[]>> {
  const cleanSymbol = symbol.trim().toUpperCase();
  const marketSymbol = normalizeMarketSymbol(cleanSymbol, region);
  if (providerName() !== "alpha_vantage" || !apiKey()) {
    const yahooNews = await yahooRssNews(marketSymbol);
    if (yahooNews.length) {
      return {
        data: yahooNews,
        warning: "News is fetched from Yahoo Finance RSS."
      };
    }
    return {
      data: mockNews(cleanSymbol),
      warning: "News API key is missing or provider is set to mock. Showing sample news."
    };
  }
  try {
    const data = await fetchAlpha({ function: "NEWS_SENTIMENT", tickers: marketSymbol, sort: "LATEST", limit: "8" });
    const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
    const feed = isRecord(data) && Array.isArray(data.feed) ? data.feed : [];
    const items = feed.map((item) => {
      const newsItem = isRecord(item) ? item : {};
      return {
        headline: typeof newsItem.title === "string" ? newsItem.title : "",
        source: typeof newsItem.source === "string" ? newsItem.source : "",
        date: typeof newsItem.time_published === "string" ? newsItem.time_published : "",
        url: typeof newsItem.url === "string" ? newsItem.url : "",
        summary: typeof newsItem.summary === "string" && newsItem.summary ? newsItem.summary : "No summary provided."
      };
    }).filter((item: NewsItem) => {
      const parsed = Date.parse(item.date);
      return Number.isNaN(parsed) || parsed >= cutoff;
    });
    return { data: items.length ? items : [] };
  } catch (error) {
    return {
      data: [],
      warning: `News fetch failed for ${cleanSymbol}: ${error instanceof Error ? error.message : "Unknown error"}`
    };
  }
}

async function getYahooQuote(marketSymbol: string, displaySymbol: string, fresh = false): Promise<MarketQuote | undefined> {
  try {
    const url = new URL(`${YAHOO_CHART_URL}/${encodeURIComponent(marketSymbol)}`);
    url.searchParams.set("range", "1y");
    url.searchParams.set("interval", "1d");
    const response = await providerFetch(url.toString(), {}, fresh);
    if (!response.ok) return undefined;
    const data = await response.json();
    return parseYahooChartQuote(data, displaySymbol);
  } catch {
    return undefined;
  }
}

function resolveYahooCurrentPrice(
  regularMarketPrice: number,
  closes: number[],
  meta?: Record<string, unknown>
) {
  const latestBarClose = closes[0];
  if (!latestBarClose || latestBarClose <= 0) {
    return Number(regularMarketPrice.toFixed(2));
  }

  const extendedPrices = [
    meta ? numberValue(meta.postMarketPrice) : undefined,
    meta ? numberValue(meta.preMarketPrice) : undefined
  ].filter((price): price is number => price !== undefined && price > 0);

  const nearLatestBar = Math.abs(regularMarketPrice - latestBarClose) / latestBarClose <= 0.03;
  if (nearLatestBar || !extendedPrices.length) {
    return Number(regularMarketPrice.toFixed(2));
  }

  const matchesStaleExtended = extendedPrices.some((extendedPrice) => (
    Math.abs(regularMarketPrice - extendedPrice) / Math.max(extendedPrice, 0.01) <= 0.02
    && Math.abs(extendedPrice - latestBarClose) / latestBarClose > 0.15
  ));

  return Number((matchesStaleExtended ? latestBarClose : regularMarketPrice).toFixed(2));
}

function resolveYahooPreviousClose(
  currentPrice: number,
  closes: number[],
  meta?: Record<string, unknown>
) {
  const latestBarClose = closes[0];
  const priorBarClose = closes.length >= 2 ? closes[1] : undefined;
  const metaPreviousClose = meta
    ? numberValue(meta.previousClose) ?? numberValue(meta.chartPreviousClose)
    : undefined;

  if (priorBarClose === undefined) {
    return metaPreviousClose ?? latestBarClose ?? currentPrice;
  }

  const liveNearLatestBar = latestBarClose > 0
    && Math.abs(currentPrice - latestBarClose) / latestBarClose <= 0.03;
  const barPreviousClose = liveNearLatestBar ? priorBarClose : latestBarClose;

  if (metaPreviousClose === undefined) return barPreviousClose;

  const deviation = Math.abs(metaPreviousClose - barPreviousClose) / Math.max(barPreviousClose, 0.01);
  return deviation > 0.05 ? barPreviousClose : metaPreviousClose;
}

export function parseYahooChartQuote(data: unknown, symbol: string): MarketQuote | undefined {
  const chart = isRecord(data) ? data.chart : undefined;
  const result = isRecord(chart) && Array.isArray(chart.result) ? chart.result[0] : undefined;
  const meta = isRecord(result) && isRecord(result.meta) ? result.meta : undefined;
  const indicators = isRecord(result) && isRecord(result.indicators) ? result.indicators : undefined;
  const quoteRows = indicators && Array.isArray(indicators.quote) && isRecord(indicators.quote[0]) ? indicators.quote[0] : undefined;
  const regularMarketPrice = meta ? numberValue(meta.regularMarketPrice) : undefined;
  const close = quoteRows ? nullableNumberArray(quoteRows.close) : [];
  if (!regularMarketPrice || !close.length || !quoteRows) return undefined;

  const high = nullableNumberArray(quoteRows.high);
  const low = nullableNumberArray(quoteRows.low);
  const barVolumes = nullableNumberArray(quoteRows.volume);
  const rows = close.map((closeValue, index) => ({
    close: closeValue,
    high: high[index] ?? null,
    low: low[index] ?? null,
    volume: barVolumes[index] ?? null
  })).filter((row): row is { close: number; high: number; low: number; volume: number | null } => (
    typeof row.close === "number" && typeof row.high === "number" && typeof row.low === "number"
  )).reverse();
  if (!rows.length) return undefined;

  const closes = rows.map((row) => row.close);
  const currentPrice = resolveYahooCurrentPrice(regularMarketPrice, closes, meta);
  const previousClose = Number(resolveYahooPreviousClose(currentPrice, closes, meta).toFixed(2));
  const dailyChangePercent = previousClose > 0 ? Number((((currentPrice - previousClose) / previousClose) * 100).toFixed(2)) : 0;
  const week52High = meta ? numberValue(meta.fiftyTwoWeekHigh) : undefined;
  const week52Low = meta ? numberValue(meta.fiftyTwoWeekLow) : undefined;
  const regularMarketVolume = meta ? numberValue(meta.regularMarketVolume) : undefined;

  return {
    symbol,
    currentPrice,
    dailyChangePercent,
    previousClose,
    week52High: week52High !== undefined ? Number(week52High.toFixed(2)) : Math.round(Math.max(...closes.slice(0, 252)) * 100) / 100,
    week52Low: week52Low !== undefined ? Number(week52Low.toFixed(2)) : Math.round(Math.min(...closes.slice(0, 252)) * 100) / 100,
    volume: regularMarketVolume ?? rows[0]?.volume ?? undefined,
    ma20: movingAverage(closes, 20),
    ma50: movingAverage(closes, 50),
    ma200: movingAverage(closes, 200),
    atr: calculateAtr(rows),
    rsi: calculateRsi(closes),
    provider: "yahoo_finance"
  };
}

function decodeXml(value: string) {
  return value
    .replaceAll("<![CDATA[", "")
    .replaceAll("]]>", "")
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", "\"")
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .trim();
}

function tagValue(item: string, tag: string) {
  const match = item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? decodeXml(match[1]) : "";
}

async function yahooRssNews(symbol: string): Promise<NewsItem[]> {
  try {
    const url = new URL(YAHOO_NEWS_RSS);
    url.searchParams.set("s", symbol);
    url.searchParams.set("region", "US");
    url.searchParams.set("lang", "en-US");
    const response = await fetch(url, { next: { revalidate: 900 } });
    if (!response.ok) return [];
    const xml = await response.text();
    const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
    return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].slice(0, 8).map((match) => {
      const item = match[1];
      const date = tagValue(item, "pubDate");
      const parsedDate = Date.parse(date);
      return {
        headline: tagValue(item, "title"),
        source: "Yahoo Finance RSS",
        date: Number.isNaN(parsedDate) ? date : new Date(parsedDate).toISOString(),
        url: tagValue(item, "link"),
        summary: tagValue(item, "description") || "No summary provided."
      };
    }).filter((item) => {
      if (!item.headline || !item.url) return false;
      const parsed = Date.parse(item.date);
      return Number.isNaN(parsed) || parsed >= cutoff;
    });
  } catch {
    return [];
  }
}
