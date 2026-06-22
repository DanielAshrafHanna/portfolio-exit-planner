"use client";

import type { CurrencyCode } from "@/lib/types";
import type { DailyPlRange } from "@/lib/dailyPlRange";
import { formatMoney } from "@/lib/profileUtils";

type Props = {
  range: DailyPlRange;
  currency?: CurrencyCode;
  variant?: "default" | "compact" | "table";
  label?: string;
};

function formatSignedMoney(value: number, currency: CurrencyCode) {
  const prefix = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${prefix}${formatMoney(Math.abs(value), currency)}`;
}

function formatSignedPercent(value: number) {
  return `${value > 0 ? "+" : ""}${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}%`;
}

function toneClass(value: number) {
  if (value > 0) return "text-marine";
  if (value < 0) return "text-coral";
  return "text-ink/70";
}

function markerToneClass(value: number) {
  if (value > 0) return "border-marine/70";
  if (value < 0) return "border-coral/80";
  return "border-ink/35";
}

function trackToneClass(range: DailyPlRange) {
  if (range.low >= 0 && range.high >= 0) return "bg-gradient-to-r from-marine/10 to-marine/30";
  if (range.low <= 0 && range.high <= 0) return "bg-gradient-to-r from-coral/30 to-coral/10";
  return "bg-gradient-to-r from-coral/25 via-ink/10 to-marine/25";
}

function RangeEndpoint({
  amount,
  percent,
  currency,
  align,
  label,
  compact,
  showPercent
}: {
  amount: number;
  percent: number;
  currency?: CurrencyCode;
  align: "left" | "right";
  label: "Low" | "High";
  compact: boolean;
  showPercent: boolean;
}) {
  const primaryLabel = currency ? formatSignedMoney(amount, currency) : formatSignedPercent(percent);

  return (
    <div className={`flex min-w-0 flex-col ${align === "left" ? "items-start text-left" : "items-end text-right"}`}>
      <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-ink/40">
        {label}
      </span>
      <span className={`max-w-full truncate font-semibold tabular-nums ${compact ? "text-[10px]" : "text-[11px]"} ${toneClass(amount)}`}>
        {primaryLabel}
      </span>
      {currency && showPercent ? (
        <span className="max-w-full truncate text-[10px] tabular-nums text-ink/50">
          {formatSignedPercent(percent)}
        </span>
      ) : null}
    </div>
  );
}

export function DailyPlRangeBar({
  range,
  currency,
  variant = "default",
  label = "Daily range"
}: Props) {
  const isTable = variant === "table";
  const isCompact = variant === "compact";
  const isSmall = isTable || isCompact;
  const markerPercent = `${(range.position * 100).toFixed(1)}%`;
  const lowMoneyLabel = currency ? formatSignedMoney(range.low, currency) : formatSignedPercent(range.lowPercent);
  const highMoneyLabel = currency ? formatSignedMoney(range.high, currency) : formatSignedPercent(range.highPercent);
  const currentLabel = currency ? formatSignedMoney(range.current, currency) : formatSignedPercent(range.currentPercent);
  const zeroPercent = range.low < 0 && range.high > 0
    ? `${((-range.low / (range.high - range.low)) * 100).toFixed(1)}%`
    : undefined;

  return (
    <div className={`w-full min-w-0 ${isTable ? "mt-1.5 max-w-[8.25rem]" : isCompact ? "mt-1.5" : "mt-2"}`}>
      {!isTable ? (
        <div className={`grid grid-cols-2 items-end gap-2 ${isCompact ? "text-[10px]" : "text-xs"}`}>
          <RangeEndpoint amount={range.low} percent={range.lowPercent} currency={currency} align="left" label="Low" compact={isCompact} showPercent={!isCompact} />
          <RangeEndpoint amount={range.high} percent={range.highPercent} currency={currency} align="right" label="High" compact={isCompact} showPercent={!isCompact} />
        </div>
      ) : null}
      <div
        className={`relative ${isTable ? "h-1.5" : isCompact ? "mt-1 h-1.5" : "mt-1.5 h-2"} rounded-full ${trackToneClass(range)}`}
        role="img"
        aria-label={`${label}: low ${lowMoneyLabel}, current ${currentLabel}, high ${highMoneyLabel}`}
      >
        {zeroPercent ? (
          <span
            className="absolute top-0 h-full w-px bg-white/90"
            style={{ left: zeroPercent }}
            aria-hidden
          />
        ) : null}
        <span
          className={`absolute top-1/2 ${isSmall ? "h-3 w-3" : "h-3.5 w-3.5"} -translate-x-1/2 -translate-y-1/2 rounded-full border-2 bg-white shadow-sm ring-2 ring-white ${markerToneClass(range.current)}`}
          style={{ left: markerPercent }}
          aria-hidden
        />
      </div>
    </div>
  );
}
