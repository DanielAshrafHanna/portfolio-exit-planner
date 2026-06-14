import { isEgxMarketOpen, isUsMarketOpen } from "./marketRefresh";
import type { MarketRegion } from "./types";

export type DailyPlSessionInfo = {
  region: MarketRegion;
  sessionDate: string;
  sessionLabel: string;
  columnLabel: string;
  moversTitle: string;
  subtitle: string;
  isMarketClosed: boolean;
};

const REGION_TIMEZONES: Record<MarketRegion, string> = {
  US: "America/New_York",
  EG: "Africa/Cairo"
};

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

export function isTradingWeekday(region: MarketRegion, date: Date | string) {
  const instant = typeof date === "string" ? new Date(`${date}T12:00:00.000Z`) : date;
  const weekday = weekdayInTimeZone(REGION_TIMEZONES[region], instant);
  if (region === "EG") return weekday !== "Fri" && weekday !== "Sat";
  return weekday !== "Sat" && weekday !== "Sun";
}

export function isBeforeMarketOpen(region: MarketRegion, now = new Date()) {
  const timeZone = REGION_TIMEZONES[region];
  const weekday = weekdayInTimeZone(timeZone, now);
  const minutes = hourMinuteInTimeZone(timeZone, now);
  if (region === "EG") {
    if (weekday === "Fri" || weekday === "Sat") return true;
    return minutes < 10 * 60;
  }
  if (weekday === "Sat" || weekday === "Sun") return true;
  return minutes < 9 * 60 + 30;
}

export function isAfterMarketClose(region: MarketRegion, now = new Date()) {
  const timeZone = REGION_TIMEZONES[region];
  const weekday = weekdayInTimeZone(timeZone, now);
  const minutes = hourMinuteInTimeZone(timeZone, now);
  if (region === "EG") {
    if (weekday === "Fri" || weekday === "Sat") return true;
    return minutes >= 14 * 60 + 30;
  }
  if (weekday === "Sat" || weekday === "Sun") return true;
  return minutes >= 16 * 60;
}

export function marketDateString(region: MarketRegion, now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: REGION_TIMEZONES[region],
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(now);
  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

export function formatSessionLabel(sessionDate: string, now = new Date()) {
  const currentYear = Number(marketDateString("US", now).slice(0, 4));
  const dateYear = Number(sessionDate.slice(0, 4));
  return new Date(`${sessionDate}T12:00:00.000Z`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    ...(dateYear === currentYear ? {} : { year: "numeric" })
  });
}

export function regionFromCurrency(currency: "USD" | "EGP"): MarketRegion {
  return currency === "EGP" ? "EG" : "US";
}

export function getLastTradingDate(region: MarketRegion, now = new Date()) {
  const cursor = marketDateString(region, now);
  const date = new Date(`${cursor}T12:00:00.000Z`);

  if (isTradingWeekday(region, date) && isAfterMarketClose(region, now)) {
    return cursor;
  }

  const previous = new Date(date);
  previous.setUTCDate(previous.getUTCDate() - 1);
  while (!isTradingWeekday(region, previous)) {
    previous.setUTCDate(previous.getUTCDate() - 1);
  }
  return previous.toISOString().slice(0, 10);
}

export function getDailyPlSessionInfo(region: MarketRegion, now = new Date()): DailyPlSessionInfo {
  const isOpen = region === "EG" ? isEgxMarketOpen(now) : isUsMarketOpen(now);
  const tradingToday = isTradingWeekday(region, now);
  const sessionDate = isOpen || (tradingToday && isAfterMarketClose(region, now))
    ? marketDateString(region, now)
    : getLastTradingDate(region, now);
  const sessionLabel = formatSessionLabel(sessionDate, now);
  const marketName = region === "EG" ? "EGX" : "US";

  if (isOpen) {
    return {
      region,
      sessionDate,
      sessionLabel,
      columnLabel: `Today (${sessionLabel})`,
      moversTitle: `Top movers · ${sessionLabel}`,
      subtitle: `${marketName} market open`,
      isMarketClosed: false
    };
  }

  if (!tradingToday) {
    return {
      region,
      sessionDate,
      sessionLabel,
      columnLabel: sessionLabel,
      moversTitle: `Top movers · ${sessionLabel}`,
      subtitle: `${marketName} market closed (weekend)`,
      isMarketClosed: true
    };
  }

  if (isBeforeMarketOpen(region, now)) {
    return {
      region,
      sessionDate,
      sessionLabel,
      columnLabel: `Last session (${sessionLabel})`,
      moversTitle: `Top movers · ${sessionLabel}`,
      subtitle: `${marketName} market closed · opens later today`,
      isMarketClosed: true
    };
  }

  return {
    region,
    sessionDate,
    sessionLabel,
    columnLabel: sessionLabel,
    moversTitle: `Top movers · ${sessionLabel}`,
    subtitle: `${marketName} market closed`,
    isMarketClosed: true
  };
}

export function chartDateLabel(
  snapshotDate: string,
  region: MarketRegion,
  now = new Date()
) {
  const base = formatSessionLabel(snapshotDate, now);
  return isTradingWeekday(region, snapshotDate) ? base : `${base} · closed`;
}
