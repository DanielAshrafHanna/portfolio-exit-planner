"use client";

import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { CurrencyCode } from "@/lib/types";
import type { WeeklyChartSeries } from "@/lib/portfolioReportCharts";
import { CHART_MARGIN, formatChartSignedAxis, formatChartSignedMoney, plChartDomain } from "@/lib/chartFormat";
import { formatSessionLabel } from "@/lib/marketSession";

type Props = {
  series: WeeklyChartSeries;
};

type DailyPlChartPoint = Omit<WeeklyChartSeries["points"][number], "dailyProfitLoss"> & {
  dailyProfitLoss: number | null;
};

const GAIN_COLOR = "#145c72";
const LOSS_COLOR = "#ff7a68";
const EMPTY_COLOR = "#d8ded5";

export function WeeklyDailyPlChart({ series }: Props) {
  const chartData: DailyPlChartPoint[] = series.points.map((point) => ({
    ...point,
    dailyProfitLoss: point.hasData ? point.dailyProfitLoss : null
  }));
  const values = series.points.filter((point) => point.hasData).map((point) => point.dailyProfitLoss);
  const [domainMin, domainMax] = plChartDomain(values);
  const title = series.profileName ? `${series.profileName} (${series.currency})` : series.currency;

  return (
    <div className="rounded-md border border-ink/10 bg-white p-3">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-ink">Daily P/L this week</h3>
        <p className="text-xs text-ink/55">{title} · rolling last 7 days</p>
      </div>
      <div className="h-64 min-w-[280px] w-full overflow-x-auto">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={CHART_MARGIN}>
            <CartesianGrid strokeDasharray="3 3" stroke="#d8ded5" />
            <XAxis dataKey="date" interval="preserveStartEnd" tick={{ fontSize: 10 }} />
            <YAxis
              width={48}
              tickFormatter={(value) => formatChartSignedAxis(Number(value), series.currency)}
              domain={[domainMin, domainMax]}
              tick={{ fontSize: 10 }}
            />
            <Tooltip content={<DailyPlTooltip currency={series.currency} />} />
            <ReferenceLine y={0} stroke="#17212b" strokeDasharray="4 4" />
            <Bar dataKey="dailyProfitLoss" radius={[4, 4, 0, 0]}>
              {chartData.map((point) => (
                <Cell
                  key={point.snapshotDate}
                  fill={!point.hasData || point.marketClosed ? EMPTY_COLOR : point.dailyProfitLoss! >= 0 ? GAIN_COLOR : LOSS_COLOR}
                  fillOpacity={point.hasData && !point.marketClosed ? 1 : 0.35}
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
  payload?: Array<{ payload: DailyPlChartPoint }>;
  currency: CurrencyCode;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  const dateLabel = formatSessionLabel(point.snapshotDate);
  if (!point.hasData) {
    return (
      <div className="rounded-md border border-ink/10 bg-white px-3 py-2 text-xs text-ink/70 shadow-soft">
        <div className="font-semibold text-ink">{dateLabel}</div>
        <div>{point.marketClosed ? "Market closed" : "No snapshot saved"}</div>
      </div>
    );
  }
  if (point.marketClosed) {
    return (
      <div className="rounded-md border border-ink/10 bg-white px-3 py-2 text-xs shadow-soft">
        <div className="font-semibold text-ink">{dateLabel}</div>
        <div className="text-ink/60">Market closed</div>
        <div className={point.dailyProfitLoss! >= 0 ? "text-marine" : "text-coral"}>
          {formatChartSignedMoney(point.dailyProfitLoss!, currency)} ({formatPercent(point.dailyProfitLossPercent)})
        </div>
      </div>
    );
  }
  return (
    <div className="rounded-md border border-ink/10 bg-white px-3 py-2 text-xs shadow-soft">
      <div className="font-semibold text-ink">{dateLabel}</div>
      <div className={point.dailyProfitLoss! >= 0 ? "text-marine" : "text-coral"}>
        {formatChartSignedMoney(point.dailyProfitLoss!, currency)} ({formatPercent(point.dailyProfitLossPercent)})
      </div>
    </div>
  );
}

function formatPercent(value: number) {
  return `${value > 0 ? "+" : ""}${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}%`;
}
