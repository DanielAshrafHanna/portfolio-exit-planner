"use client";

import { useId, useMemo } from "react";
import { buildCumulativePoints } from "@/lib/portfolioReportCharts";
import type { WeeklyChartSeries } from "@/lib/portfolioReportCharts";
import type { CurrencyCode } from "@/lib/types";
import {
  CHART_HEIGHT_CLASS,
  CHART_MARGIN,
  CHART_THEME,
  formatChartSignedAxis,
  formatChartSignedMoney,
  plChartDomain
} from "@/lib/chartFormat";
import { formatSessionLabel } from "@/lib/marketSession";
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Props = {
  series: WeeklyChartSeries;
};

type CumulativeChartPoint = Omit<ReturnType<typeof buildCumulativePoints>[number], "cumulativeProfitLoss"> & {
  cumulativeProfitLoss: number | null;
};

export function WeeklyCumulativePlChart({ series }: Props) {
  const gradientId = useId();
  const { points, domain } = useMemo(() => {
    const cumulative = buildCumulativePoints(series.points);
    const data: CumulativeChartPoint[] = cumulative.map((point) => ({
      ...point,
      cumulativeProfitLoss: point.hasPlData ? point.cumulativeProfitLoss : null
    }));
    const values = cumulative.filter((point) => point.hasPlData).map((point) => point.cumulativeProfitLoss);
    return { points: data, domain: plChartDomain(values) };
  }, [series.points]);

  const title = series.profileName ? `${series.profileName} (${series.currency})` : series.currency;

  return (
    <div className="rounded-md border border-ink/10 bg-white p-3">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-ink">Cumulative weekly P/L</h3>
        <p className="text-xs text-ink/55">{title} · running total across the last 7 days</p>
      </div>
      <div
        className={`${CHART_HEIGHT_CLASS} min-w-[280px] w-full overflow-x-auto`}
        role="img"
        aria-label={`Cumulative weekly profit and loss line chart for ${title}`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={points} margin={CHART_MARGIN}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CHART_THEME.gain} stopOpacity={0.22} />
                <stop offset="100%" stopColor={CHART_THEME.gain} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray={CHART_THEME.gridDash} stroke={CHART_THEME.grid} />
            <XAxis dataKey="date" interval="preserveStartEnd" tick={CHART_THEME.axisTick} />
            <YAxis
              width={48}
              tickFormatter={(value) => formatChartSignedAxis(Number(value), series.currency)}
              domain={domain}
              tick={CHART_THEME.axisTick}
            />
            <Tooltip content={<CumulativeTooltip currency={series.currency} />} />
            <ReferenceLine y={0} stroke={CHART_THEME.reference} strokeDasharray={CHART_THEME.referenceDash} />
            <Area
              type="monotone"
              dataKey="cumulativeProfitLoss"
              stroke={CHART_THEME.gain}
              strokeWidth={2}
              fill={`url(#${gradientId})`}
              dot={{ r: 3, fill: CHART_THEME.gain }}
              connectNulls={false}
              isAnimationActive={false}
            />
          </AreaChart>
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
  payload?: Array<{ payload: CumulativeChartPoint }>;
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
      <div className={point.cumulativeProfitLoss! >= 0 ? "text-marine" : "text-coral"}>
        {formatChartSignedMoney(point.cumulativeProfitLoss!, currency)}
      </div>
      <div className="text-ink/60">
        Day: {formatChartSignedMoney(point.dailyProfitLoss, currency)}
        {point.marketClosed ? " · market closed" : ""}
      </div>
    </div>
  );
}
