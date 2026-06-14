"use client";

import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { CurrencyCode } from "@/lib/types";
import type { WeeklyChartSeries } from "@/lib/portfolioReportCharts";
import { formatMoney } from "@/lib/profileUtils";

type Props = {
  series: WeeklyChartSeries;
};

const GAIN_COLOR = "#145c72";
const LOSS_COLOR = "#ff7a68";
const EMPTY_COLOR = "#d8ded5";

export function WeeklyDailyPlChart({ series }: Props) {
  const values = series.points.filter((point) => point.hasData).map((point) => point.dailyProfitLoss);
  const max = values.length ? Math.max(...values, 0) : 1;
  const min = values.length ? Math.min(...values, 0) : -1;
  const padding = Math.max(Math.abs(max), Math.abs(min), 1) * 0.2;
  const title = series.profileName ? `${series.profileName} (${series.currency})` : series.currency;

  return (
    <div className="rounded-md border border-ink/10 bg-white p-3">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-ink">Daily P/L this week</h3>
        <p className="text-xs text-ink/55">{title} · rolling last 7 days</p>
      </div>
      <div className="h-64 min-w-[280px] w-full overflow-x-auto">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={series.points} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#d8ded5" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis
              tickFormatter={(value) => formatSignedAxis(Number(value), series.currency)}
              domain={[min - padding, max + padding]}
              tick={{ fontSize: 11 }}
            />
            <Tooltip content={<DailyPlTooltip currency={series.currency} />} />
            <ReferenceLine y={0} stroke="#17212b" strokeDasharray="4 4" />
            <Bar dataKey="dailyProfitLoss" radius={[4, 4, 0, 0]}>
              {series.points.map((point) => (
                <Cell
                  key={point.snapshotDate}
                  fill={!point.hasData ? EMPTY_COLOR : point.dailyProfitLoss >= 0 ? GAIN_COLOR : LOSS_COLOR}
                  fillOpacity={point.hasData ? 1 : 0.35}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function DailyPlTooltip({
  active,
  payload,
  currency
}: {
  active?: boolean;
  payload?: Array<{ payload: WeeklyChartSeries["points"][number] }>;
  currency: CurrencyCode;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  if (!point.hasData) {
    return (
      <div className="rounded-md border border-ink/10 bg-white px-3 py-2 text-xs text-ink/70 shadow-soft">
        <div className="font-semibold text-ink">{point.date}</div>
        <div>No snapshot saved</div>
      </div>
    );
  }
  return (
    <div className="rounded-md border border-ink/10 bg-white px-3 py-2 text-xs shadow-soft">
      <div className="font-semibold text-ink">{point.date}</div>
      <div className={point.dailyProfitLoss >= 0 ? "text-marine" : "text-coral"}>
        {formatSignedMoney(point.dailyProfitLoss, currency)} ({formatPercent(point.dailyProfitLossPercent)})
      </div>
    </div>
  );
}

function formatSignedAxis(value: number, currency: CurrencyCode) {
  const prefix = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${prefix}${formatMoney(Math.abs(value), currency)}`;
}

function formatSignedMoney(value: number, currency: CurrencyCode) {
  const prefix = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${prefix}${formatMoney(Math.abs(value), currency)}`;
}

function formatPercent(value: number) {
  return `${value > 0 ? "+" : ""}${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}%`;
}
