import type { MarketQuote, MarketRegion, PriceSession } from "./types";
import { normalizeMarketSymbol } from "./profileUtils";
import { getUnsupportedTickerMessage } from "./unsupportedTickers";

const ALPHA_URL = "https://www.alphavantage.co/query";
const MUBASHER_EGX_URL = "https://english.mubasher.info/markets/EGX/stocks";
const MUBASHER_FETCH_HEADERS = {
  "User-Agent": "Mozilla/5.0 (compatible; PortfolioExitPlanner/1.0)",
  Accept: "text/html,application/xhtml+xml",
  "Accept-Language": "en-US,en;q=0.9"
};

const YAHOO_FETCH_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "application/json,text/plain,*/*",
  "Accept-Language": "en-US,en;q=0.9",
  Referer: "https://finance.yahoo.com/"
};

type QuoteFetchOptions = {
  fresh?: boolean;
  /** Use Yahoo/Mubasher for cron snapshots to preserve Alpha Vantage daily quota. */
  preferPublicQuote?: boolean;
};

function mubasherFetch(url: string, fresh = false) {
  return fetch(url, {
    ...(fresh ? { cache: "no-store" as const } : { next: { revalidate: 300 } }),
    headers: MUBASHER_FETCH_HEADERS
  });
}

function yahooFetch(url: string, fresh = false) {
  return fetch(url, {
    ...(fresh ? { cache: "no-store" as const } : { next: { revalidate: 300 } }),
    headers: YAHOO_FETCH_HEADERS
  });
}

/** Alpha Vantage free tier allows ~1 request per second. */
export const ALPHA_VANTAGE_REQUEST_GAP_MS = 1100;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
const YAHOO_CHART_HOSTS = [
  "https://query1.finance.yahoo.com/v8/finance/chart",
  "https://query2.finance.yahoo.com/v8/finance/chart"
];

type ProviderResult<T> = {
  data: T;
  warning?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function providerName() {
  const configured = process.env.MARKET_DATA_PROVIDER?.trim();
  if (configured) return configured;
  // Deployed builds should prefer live quotes even without Alpha Vantage configured.
  return process.env.VERCEL ? "yahoo" : "mock";
}

function apiKey() {
  return process.env.MARKET_DATA_API_KEY || process.env.ALPHA_VANTAGE_API_KEY;
}

export function usesAlphaVantageQuotes() {
  return providerName() === "alpha_vantage" && Boolean(apiKey());
}

export function usesYahooQuoteFallback() {
  return !usesAlphaVantageQuotes();
}

function unavailableQuote(symbol: string, error: string): MarketQuote {
  return {
    symbol,
    currentPrice: 0,
    previousClose: 0,
    dailyChangePercent: 0,
    provider: "unavailable",
    error,
    stale: true
  };
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
  const quoteData = await fetchAlpha({ function: "GLOBAL_QUOTE", symbol });
  await sleep(ALPHA_VANTAGE_REQUEST_GAP_MS);
  const dailyData = await fetchAlpha({ function: "TIME_SERIES_DAILY_ADJUSTED", symbol, outputsize: "full" });
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
    const yahooQuote = await getYahooQuote(marketSymbol, cleanSymbol, options.fresh);
    if (yahooQuote) {
      return {
        data: { ...yahooQuote, symbol: cleanSymbol, stale: true },
        warning: `Live Mubasher quote unavailable for ${cleanSymbol}; showing Yahoo Finance fallback which may be stale for EGX.`
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
  if (usesYahooQuoteFallback() || options.preferPublicQuote) {
    const yahooQuote = await getYahooQuote(marketSymbol, cleanSymbol, options.fresh, !options.preferPublicQuote);
    if (yahooQuote) {
      return {
        data: { ...yahooQuote, symbol: cleanSymbol },
        warning: usesAlphaVantageQuotes()
          ? undefined
          : providerName() === "yahoo"
            ? "Quotes are fetched from Yahoo Finance's public chart feed."
            : "Market API key is missing, so quotes are fetched from Yahoo Finance's public chart feed."
      };
    }
    return {
      data: unavailableQuote(cleanSymbol, `No live quote was found for ${cleanSymbol}.`),
      warning: `Live quote fetch failed for ${cleanSymbol}.`
    };
  }
  try {
    return { data: await alphaQuote(marketSymbol) };
  } catch (error) {
    const yahooQuote = await getYahooQuote(marketSymbol, cleanSymbol, options.fresh, !options.preferPublicQuote);
    if (yahooQuote) {
      const alphaMessage = error instanceof Error ? error.message : "Failed quote fetch";
      const shortAlphaMessage = alphaMessage.includes("spreading out your free API requests")
        || alphaMessage.includes("premium plans")
        ? "Alpha Vantage free-tier rate limit reached."
        : alphaMessage.length > 120
          ? `${alphaMessage.slice(0, 120)}…`
          : alphaMessage;
      return {
        data: { ...yahooQuote, symbol: cleanSymbol },
        warning: `Alpha Vantage failed for ${cleanSymbol}; using Yahoo Finance fallback. (${shortAlphaMessage})`
      };
    }
    const message = error instanceof Error ? error.message : "Failed quote fetch";
    return {
      data: unavailableQuote(cleanSymbol, message),
      warning: `Quote fetch failed for ${cleanSymbol}: ${message}`
    };
  }
}

async function getMubasherEgxQuote(symbol: string, fresh = false): Promise<MarketQuote | undefined> {
  try {
    const response = await mubasherFetch(`${MUBASHER_EGX_URL}/${encodeURIComponent(symbol)}/`, fresh);
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
  const patterns = [
    new RegExp(`<span class="market-summary__block-text">\\s*${escapedLabel}\\s*<\\/span>\\s*<span class="market-summary__block-number">\\s*([\\d,.]+)\\s*<\\/span>`, "i"),
    new RegExp(`<span class="market-summary__block-number">\\s*([\\d,.]+)\\s*<\\/span>\\s*<span class="market-summary__block-text">\\s*${escapedLabel}\\s*<\\/span>`, "i")
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) return parseFormattedNumber(match[1]);
  }
  return undefined;
}

function parseFormattedNumber(value: string) {
  const parsed = Number(value.replaceAll(",", "").trim());
  return Number.isFinite(parsed) ? parsed : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function quoteCompanyNameFromMeta(meta?: Record<string, unknown>) {
  if (!meta) return undefined;
  return stringValue(meta.longName) || stringValue(meta.shortName);
}

function nullableNumberArray(value: unknown): Array<number | null> {
  return Array.isArray(value) ? value.map((item) => numberValue(item) ?? null) : [];
}

async function getYahooQuote(
  marketSymbol: string,
  displaySymbol: string,
  fresh = false,
  allowExtendedHours = true
): Promise<MarketQuote | undefined> {
  for (const host of YAHOO_CHART_HOSTS) {
    try {
      const url = new URL(`${host}/${encodeURIComponent(marketSymbol)}`);
      url.searchParams.set("range", "1y");
      url.searchParams.set("interval", "1d");
      const response = await yahooFetch(url.toString(), fresh);
      if (!response.ok) continue;
      const data = await response.json();
      const quote = parseYahooChartQuote(data, displaySymbol, { allowExtendedHours });
      if (quote) return quote;
    } catch {
      // Try the next Yahoo host.
    }
  }
  return undefined;
}

function normalizeYahooMarketState(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim().toUpperCase() : undefined;
}

function isStaleExtendedCopy(
  extendedPrice: number,
  regularMarketPrice: number,
  latestBarClose: number
): boolean {
  return (
    Math.abs(regularMarketPrice - extendedPrice) / Math.max(extendedPrice, 0.01) <= 0.02
    && Math.abs(extendedPrice - latestBarClose) / latestBarClose > 0.15
  );
}

function isValidExtendedQuote(
  extendedPrice: number,
  regularMarketPrice: number,
  latestBarClose: number
): boolean {
  if (extendedPrice <= 0 || regularMarketPrice <= 0 || latestBarClose <= 0) return false;
  const withinBand = Math.abs(extendedPrice - regularMarketPrice) / regularMarketPrice <= 0.15;
  if (!withinBand) return false;
  return !isStaleExtendedCopy(extendedPrice, regularMarketPrice, latestBarClose);
}

function resolveYahooCurrentPrice(
  regularMarketPrice: number,
  closes: number[],
  meta?: Record<string, unknown>,
  options: { allowExtendedHours?: boolean } = {}
): { currentPrice: number; priceSession: PriceSession } {
  const allowExtendedHours = options.allowExtendedHours !== false;
  const latestBarClose = closes[0];
  if (!latestBarClose || latestBarClose <= 0) {
    return {
      currentPrice: Number(regularMarketPrice.toFixed(2)),
      priceSession: "regular"
    };
  }

  const marketState = normalizeYahooMarketState(meta?.marketState);
  const preMarketPrice = meta ? numberValue(meta.preMarketPrice) : undefined;
  const postMarketPrice = meta ? numberValue(meta.postMarketPrice) : undefined;

  if (allowExtendedHours) {
    if (marketState === "PRE" || marketState === "PREPRE") {
      if (preMarketPrice && isValidExtendedQuote(preMarketPrice, regularMarketPrice, latestBarClose)) {
        return {
          currentPrice: Number(preMarketPrice.toFixed(2)),
          priceSession: "pre"
        };
      }
    }
    if (marketState === "POST" || marketState === "POSTPOST") {
      if (postMarketPrice && isValidExtendedQuote(postMarketPrice, regularMarketPrice, latestBarClose)) {
        return {
          currentPrice: Number(postMarketPrice.toFixed(2)),
          priceSession: "post"
        };
      }
    }
  }

  const extendedPrices = [
    postMarketPrice,
    preMarketPrice
  ].filter((price): price is number => price !== undefined && price > 0);

  const nearLatestBar = Math.abs(regularMarketPrice - latestBarClose) / latestBarClose <= 0.03;
  if (nearLatestBar || !extendedPrices.length) {
    const priceSession: PriceSession = marketState === "REGULAR" || nearLatestBar ? "regular" : "closed";
    return {
      currentPrice: Number(regularMarketPrice.toFixed(2)),
      priceSession
    };
  }

  const matchesStaleExtended = extendedPrices.some((extendedPrice) => (
    isStaleExtendedCopy(extendedPrice, regularMarketPrice, latestBarClose)
  ));

  return {
    currentPrice: Number((matchesStaleExtended ? latestBarClose : regularMarketPrice).toFixed(2)),
    priceSession: matchesStaleExtended ? "closed" : "regular"
  };
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

export function parseYahooChartQuote(
  data: unknown,
  symbol: string,
  options: { allowExtendedHours?: boolean } = {}
): MarketQuote | undefined {
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
  const { currentPrice, priceSession } = resolveYahooCurrentPrice(regularMarketPrice, closes, meta, options);
  const previousClose = Number(resolveYahooPreviousClose(currentPrice, closes, meta).toFixed(2));
  const dailyChangePercent = previousClose > 0 ? Number((((currentPrice - previousClose) / previousClose) * 100).toFixed(2)) : 0;
  const week52High = meta ? numberValue(meta.fiftyTwoWeekHigh) : undefined;
  const week52Low = meta ? numberValue(meta.fiftyTwoWeekLow) : undefined;
  const regularMarketVolume = meta ? numberValue(meta.regularMarketVolume) : undefined;
  const regularMarketDayHigh = meta ? numberValue(meta.regularMarketDayHigh) : undefined;
  const regularMarketDayLow = meta ? numberValue(meta.regularMarketDayLow) : undefined;
  const sessionDayHigh = regularMarketDayHigh ?? rows[0]?.high;
  const sessionDayLow = regularMarketDayLow ?? rows[0]?.low;

  return {
    symbol,
    currentPrice,
    dailyChangePercent,
    previousClose,
    dayHigh: sessionDayHigh !== undefined ? Number(sessionDayHigh.toFixed(2)) : undefined,
    dayLow: sessionDayLow !== undefined ? Number(sessionDayLow.toFixed(2)) : undefined,
    priceSession,
    companyName: quoteCompanyNameFromMeta(meta),
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

