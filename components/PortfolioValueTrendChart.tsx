"use client";

import type { WeeklyChartSeries } from "@/lib/portfolioReportCharts";
import type { CurrencyCode } from "@/lib/types";
import { formatMoney } from "@/lib/profileUtils";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Props = {
  series: WeeklyChartSeries;
};

export function PortfolioValueTrendChart({ series }: Props) {
  const values = series.points.filter((point) => point.hasData).map((point) => point.portfolioValue);
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 1;
  const padding = Math.max((max - min) * 0.1, max * 0.05, 1);
  const title = series.profileName ? `${series.profileName} (${series.currency})` : series.currency;

  return (
    <div className="rounded-md border border-ink/10 bg-white p-3">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-ink">Portfolio value trend</h3>
        <p className="text-xs text-ink/55">{title} · gross value over the last 7 days</p>
      </div>
      <div className="h-64 min-w-[280px] w-full overflow-x-auto">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={series.points} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#d8ded5" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis
              tickFormatter={(value) => formatMoney(Number(value), series.currency)}
              domain={[Math.max(0, min - padding), max + padding]}
              tick={{ fontSize: 11 }}
            />
            <Tooltip content={<ValueTooltip currency={series.currency} />} />
            <Line
              type="monotone"
              dataKey="portfolioValue"
              stroke="#145c72"
              strokeWidth={2}
              dot={{ r: 3, fill: "#145c72" }}
              connectNulls={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function ValueTooltip({
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
      <div className="text-marine">{formatMoney(point.portfolioValue, currency)}</div>
    </div>
  );
}
