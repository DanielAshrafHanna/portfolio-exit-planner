"use client";

import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { CurrencyCode } from "@/lib/types";
import type { WeeklyChartSeries } from "@/lib/portfolioReportCharts";
import {
  CHART_HEIGHT_CLASS,
  CHART_MARGIN,
  CHART_THEME,
  formatChartSignedAxis,
  formatChartSignedMoney,
  plChartDomain
} from "@/lib/chartFormat";
import { formatSessionLabel } from "@/lib/marketSession";

type Props = {
  series: WeeklyChartSeries;
};

type DailyPlChartPoint = Omit<WeeklyChartSeries["points"][number], "dailyProfitLoss"> & {
  dailyProfitLoss: number | null;
};

export function WeeklyDailyPlChart({ series }: Props) {
  const { chartData, domain } = useMemo(() => {
    const data: DailyPlChartPoint[] = series.points.map((point) => ({
      ...point,
      dailyProfitLoss: point.hasPlData ? point.dailyProfitLoss : null
    }));
    const values = series.points.filter((point) => point.hasPlData).map((point) => point.dailyProfitLoss);
    return { chartData: data, domain: plChartDomain(values) };
  }, [series.points]);

  const title = series.profileName ? `${series.profileName} (${series.currency})` : series.currency;

  return (
    <div className="rounded-md border border-ink/10 bg-white p-3">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-ink">Daily P/L this week</h3>
        <p className="text-xs text-ink/55">{title} · rolling last 7 days</p>
      </div>
      <div
        className={`${CHART_HEIGHT_CLASS} min-w-[280px] w-full overflow-x-auto`}
        role="img"
        aria-label={`Daily profit and loss bar chart for ${title} over the last 7 days`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={CHART_MARGIN}>
            <CartesianGrid strokeDasharray={CHART_THEME.gridDash} stroke={CHART_THEME.grid} />
            <XAxis dataKey="date" interval="preserveStartEnd" tick={CHART_THEME.axisTick} />
            <YAxis
              width={48}
              tickFormatter={(value) => formatChartSignedAxis(Number(value), series.currency)}
              domain={domain}
              tick={CHART_THEME.axisTick}
            />
            <Tooltip content={<DailyPlTooltip currency={series.currency} />} cursor={{ fill: "rgba(20,92,114,0.06)" }} />
            <ReferenceLine y={0} stroke={CHART_THEME.reference} strokeDasharray={CHART_THEME.referenceDash} />
            <Bar dataKey="dailyProfitLoss" radius={[4, 4, 0, 0]} isAnimationActive={false}>
              {chartData.map((point) => (
                <Cell
                  key={point.snapshotDate}
                  fill={!point.hasPlData ? CHART_THEME.empty : point.dailyProfitLoss! >= 0 ? CHART_THEME.gain : CHART_THEME.loss}
                  fillOpacity={point.hasPlData ? 1 : 0.35}
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
  if (!point.hasPlData) {
    return (
      <div className="rounded-md border border-ink/10 bg-white px-3 py-2 text-xs text-ink/70 shadow-soft">
        <div className="font-semibold text-ink">{dateLabel}</div>
        <div>{point.marketClosed ? "Market closed — no trading session" : "No snapshot saved"}</div>
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
