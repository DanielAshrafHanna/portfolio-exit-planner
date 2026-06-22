"use client";

import type { CurrencyCode } from "@/lib/types";
import type { DailyPlRange } from "@/lib/dailyPlRange";
import { formatMoney } from "@/lib/profileUtils";

type Props = {
  range: DailyPlRange;
  currency?: CurrencyCode;
  mode?: "percent" | "money";
  compact?: boolean;
  label?: string;
};

function formatSignedMoney(value: number, currency: CurrencyCode) {
  const prefix = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${prefix}${formatMoney(Math.abs(value), currency)}`;
}

function formatSignedPercent(value: number) {
  return `${value > 0 ? "+" : ""}${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}%`;
}

function formatEndpoint(value: number, mode: "percent" | "money", currency?: CurrencyCode) {
  if (mode === "percent") return formatSignedPercent(value);
  if (!currency) return String(value);
  return formatSignedMoney(value, currency);
}

export function DailyPlRangeBar({
  range,
  currency,
  mode = "percent",
  compact = false,
  label = "Daily range"
}: Props) {
  const lowValue = mode === "percent" ? range.lowPercent : range.low;
  const highValue = mode === "percent" ? range.highPercent : range.high;
  const markerPercent = `${(range.position * 100).toFixed(1)}%`;

  return (
    <div className={`w-full ${compact ? "mt-1 max-w-[9rem]" : "mt-1.5"}`}>
      <div className={`grid grid-cols-[1fr_auto_1fr] items-end gap-1 ${compact ? "text-[9px]" : "text-[10px]"} text-ink/55`}>
        <span className="truncate text-left font-medium tabular-nums text-ink/70">
          {formatEndpoint(lowValue, mode, currency)}
        </span>
        <span className="px-1 text-center text-ink/45">{label}</span>
        <span className="truncate text-right font-medium tabular-nums text-ink/70">
          {formatEndpoint(highValue, mode, currency)}
        </span>
      </div>
      <div
        className={`relative ${compact ? "mt-0.5 h-1" : "mt-1 h-1.5"} rounded-full bg-ink/15`}
        role="img"
        aria-label={`Daily P/L range from ${formatEndpoint(lowValue, mode, currency)} to ${formatEndpoint(highValue, mode, currency)}`}
      >
        <span
          className={`absolute top-1/2 ${compact ? "h-2 w-2" : "h-2.5 w-2.5"} -translate-x-1/2 -translate-y-1/2 rounded-full border border-ink/20 bg-white shadow-sm`}
          style={{ left: markerPercent }}
          aria-hidden
        />
      </div>
    </div>
  );
}
