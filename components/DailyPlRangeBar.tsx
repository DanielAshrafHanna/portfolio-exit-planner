"use client";

import type { CurrencyCode } from "@/lib/types";
import type { DailyPlRange } from "@/lib/dailyPlRange";
import { formatMoney } from "@/lib/profileUtils";

type Props = {
  range: DailyPlRange;
  currency?: CurrencyCode;
  variant?: "default" | "table";
  label?: string;
};

function formatSignedMoney(value: number, currency: CurrencyCode) {
  const prefix = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${prefix}${formatMoney(Math.abs(value), currency)}`;
}

function formatSignedPercent(value: number) {
  return `${value > 0 ? "+" : ""}${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}%`;
}

function RangeEndpoint({
  amount,
  percent,
  currency,
  align
}: {
  amount: number;
  percent: number;
  currency?: CurrencyCode;
  align: "left" | "right";
}) {
  return (
    <div className={`flex min-w-0 flex-col ${align === "left" ? "items-start text-left" : "items-end text-right"}`}>
      {currency ? (
        <span className="truncate font-semibold tabular-nums text-ink">
          {formatSignedMoney(amount, currency)}
        </span>
      ) : null}
      <span className="truncate tabular-nums text-ink/60">
        {formatSignedPercent(percent)}
      </span>
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
  const markerPercent = `${(range.position * 100).toFixed(1)}%`;
  const lowMoneyLabel = currency ? formatSignedMoney(range.low, currency) : formatSignedPercent(range.lowPercent);
  const highMoneyLabel = currency ? formatSignedMoney(range.high, currency) : formatSignedPercent(range.highPercent);

  return (
    <div className={`w-full ${isTable ? "mt-1.5 min-w-[8.5rem]" : "mt-2"}`}>
      <div className={`grid grid-cols-[1fr_auto_1fr] items-end gap-2 ${isTable ? "text-[11px]" : "text-xs"} text-ink/55`}>
        <RangeEndpoint amount={range.low} percent={range.lowPercent} currency={currency} align="left" />
        <span className={`px-1 text-center font-medium uppercase tracking-wide text-ink/45 ${isTable ? "text-[10px]" : "text-[11px]"}`}>
          {label}
        </span>
        <RangeEndpoint amount={range.high} percent={range.highPercent} currency={currency} align="right" />
      </div>
      <div
        className={`relative ${isTable ? "mt-1.5 h-2" : "mt-2 h-2.5"} rounded-full bg-ink/20`}
        role="img"
        aria-label={`Daily P/L range from ${lowMoneyLabel} to ${highMoneyLabel}`}
      >
        <span
          className={`absolute top-1/2 ${isTable ? "h-3.5 w-3.5" : "h-4 w-4"} -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-marine/35 bg-white shadow-md ring-2 ring-white`}
          style={{ left: markerPercent }}
          aria-hidden
        />
      </div>
      {currency && !isTable ? (
        <div className="mt-1 text-center text-xs font-semibold tabular-nums text-ink">
          Now {formatSignedMoney(range.current, currency)} ({formatSignedPercent(range.currentPercent)})
        </div>
      ) : null}
    </div>
  );
}
