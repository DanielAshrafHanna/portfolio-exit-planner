"use client";

import { buildCumulativePoints } from "@/lib/portfolioReportCharts";
import type { WeeklyChartSeries } from "@/lib/portfolioReportCharts";
import type { CurrencyCode } from "@/lib/types";
import { formatMoney } from "@/lib/profileUtils";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Props = {
  series: WeeklyChartSeries;
};

export function WeeklyCumulativePlChart({ series }: Props) {
  const points = buildCumulativePoints(series.points);
  const values = points.filter((point) => point.hasData).map((point) => point.cumulativeProfitLoss);
  const max = values.length ? Math.max(...values, 0) : 1;
  const min = values.length ? Math.min(...values, 0) : -1;
  const padding = Math.max(Math.abs(max), Math.abs(min), 1) * 0.2;
  const title = series.profileName ? `${series.profileName} (${series.currency})` : series.currency;

  return (
    <div className="rounded-md border border-ink/10 bg-white p-3">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-ink">Cumulative weekly P/L</h3>
        <p className="text-xs text-ink/55">{title} · running total across the last 7 days</p>
      </div>
      <div className="h-64 min-w-[280px] w-full overflow-x-auto">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#d8ded5" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis
              tickFormatter={(value) => formatSignedAxis(Number(value), series.currency)}
              domain={[min - padding, max + padding]}
              tick={{ fontSize: 11 }}
            />
            <Tooltip content={<CumulativeTooltip currency={series.currency} />} />
            <ReferenceLine y={0} stroke="#17212b" strokeDasharray="4 4" />
            <Line
              type="monotone"
              dataKey="cumulativeProfitLoss"
              stroke="#145c72"
              strokeWidth={2}
              dot={{ r: 3, fill: "#145c72" }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function CumulativeTooltip({
  active,
  payload,
  currency
}: {
  active?: boolean;
  payload?: Array<{ payload: ReturnType<typeof buildCumulativePoints>[number] }>;
  currency: CurrencyCode;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-md border border-ink/10 bg-white px-3 py-2 text-xs shadow-soft">
      <div className="font-semibold text-ink">{point.date}</div>
      <div className={point.cumulativeProfitLoss >= 0 ? "text-marine" : "text-coral"}>
        {formatSignedMoney(point.cumulativeProfitLoss, currency)}
      </div>
      {point.hasData ? (
        <div className="text-ink/60">Day: {formatSignedMoney(point.dailyProfitLoss, currency)}</div>
      ) : null}
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
