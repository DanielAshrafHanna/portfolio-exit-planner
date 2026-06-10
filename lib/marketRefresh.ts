import type { EnrichedHolding, MarketQuote, MarketRegion } from "./types";
import { displayMarketSymbol } from "./profileUtils";

export const US_QUOTE_INTERVAL_OPEN_MS = 15_000;
export const US_QUOTE_INTERVAL_CLOSED_MS = 120_000;
export const EG_QUOTE_INTERVAL_OPEN_MS = 60_000;
export const EG_QUOTE_INTERVAL_CLOSED_MS = 180_000;
export const HIDDEN_TAB_QUOTE_INTERVAL_MS = 300_000;

export function liveQuoteKey(region: MarketRegion, symbol: string) {
  return `${region}:${symbol.trim().toUpperCase()}`;
}

export function applyLiveQuotes(
  holdings: EnrichedHolding[],
  liveQuotes: Record<string, MarketQuote>,
  region: MarketRegion
): EnrichedHolding[] {
  return holdings.map((holding) => {
    const symbol = displayMarketSymbol(holding.symbol, region);
    if (!symbol) return holding;
    const quote = liveQuotes[liveQuoteKey(region, symbol)];
    return quote ? { ...holding, quote } : holding;
  });
}

function weekdayInTimeZone(timeZone: string, now: Date) {
  return new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(now);
}

function hourMinuteInTimeZone(timeZone: string, now: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(now);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  return hour * 60 + minute;
}

export function isUsMarketOpen(now = new Date()) {
  const weekday = weekdayInTimeZone("America/New_York", now);
  if (weekday === "Sat" || weekday === "Sun") return false;
  const minutes = hourMinuteInTimeZone("America/New_York", now);
  return minutes >= 9 * 60 + 30 && minutes < 16 * 60;
}

export function isEgxMarketOpen(now = new Date()) {
  const weekday = weekdayInTimeZone("Africa/Cairo", now);
  if (weekday === "Fri" || weekday === "Sat") return false;
  const minutes = hourMinuteInTimeZone("Africa/Cairo", now);
  return minutes >= 10 * 60 && minutes < 14 * 60 + 30;
}

export function getQuoteRefreshIntervalMs(region: MarketRegion, options: { hidden?: boolean; now?: Date } = {}) {
  if (options.hidden) return HIDDEN_TAB_QUOTE_INTERVAL_MS;
  const now = options.now ?? new Date();
  if (region === "EG") {
    return isEgxMarketOpen(now) ? EG_QUOTE_INTERVAL_OPEN_MS : EG_QUOTE_INTERVAL_CLOSED_MS;
  }
  return isUsMarketOpen(now) ? US_QUOTE_INTERVAL_OPEN_MS : US_QUOTE_INTERVAL_CLOSED_MS;
}
