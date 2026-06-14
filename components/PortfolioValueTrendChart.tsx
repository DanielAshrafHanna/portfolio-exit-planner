"use client";

import type { WeeklyChartSeries } from "@/lib/portfolioReportCharts";
import type { CurrencyCode } from "@/lib/types";
import { formatMoney, formatMoneyTable } from "@/lib/profileUtils";
import { CHART_MARGIN } from "@/lib/chartFormat";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Props = {
  series: WeeklyChartSeries;
};

type ValueChartPoint = Omit<WeeklyChartSeries["points"][number], "portfolioValue"> & {
  portfolioValue: number | null;
};

export function PortfolioValueTrendChart({ series }: Props) {
  const chartData: ValueChartPoint[] = series.points.map((point) => ({
    ...point,
    portfolioValue: point.hasData ? point.portfolioValue : null
  }));
  const values = series.points
    .filter((point) => point.hasData)
    .map((point) => point.portfolioValue);
  const [domainMin, domainMax] = valueChartDomain(values);
  const title = series.profileName ? `${series.profileName} (${series.currency})` : series.currency;

  return (
    <div className="rounded-md border border-ink/10 bg-white p-3">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-ink">Portfolio value trend</h3>
        <p className="text-xs text-ink/55">{title} · gross value over the last 7 days</p>
      </div>
      <div className="h-64 min-w-[280px] w-full overflow-x-auto">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={CHART_MARGIN}>
            <CartesianGrid strokeDasharray="3 3" stroke="#d8ded5" />
            <XAxis dataKey="date" interval="preserveStartEnd" tick={{ fontSize: 10 }} />
            <YAxis
              width={48}
              tickFormatter={(value) => formatMoneyTable(Number(value), series.currency)}
              domain={[domainMin, domainMax]}
              allowDataOverflow
              tick={{ fontSize: 10 }}
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

function valueChartDomain(values: number[]): [number, number] {
  const finite = values.filter((value) => Number.isFinite(value));
  if (!finite.length) return [0, 1];
  const min = Math.min(...finite);
  const max = Math.max(...finite);
  const span = Math.max(max - min, Math.abs(max) * 0.02, 1);
  return [Math.max(0, min - span * 0.1), max + span * 0.1];
}

function ValueTooltip({
  active,
  payload,
  currency
}: {
  active?: boolean;
  payload?: Array<{ payload: ValueChartPoint }>;
  currency: CurrencyCode;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  if (!point.hasData) {
    return (
      <div className="rounded-md border border-ink/10 bg-white px-3 py-2 text-xs text-ink/70 shadow-soft">
        <div className="font-semibold text-ink">{point.date}</div>
        <div>{point.marketClosed ? "Market closed" : "No snapshot saved"}</div>
      </div>
    );
  }
  return (
    <div className="rounded-md border border-ink/10 bg-white px-3 py-2 text-xs shadow-soft">
      <div className="font-semibold text-ink">{point.date}</div>
      <div className="text-marine">{formatMoney(point.portfolioValue ?? 0, currency)}</div>
    </div>
  );
}
