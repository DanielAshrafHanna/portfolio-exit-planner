"use client";

import { useId, useMemo } from "react";
import type { WeeklyChartSeries } from "@/lib/portfolioReportCharts";
import type { CurrencyCode } from "@/lib/types";
import { formatMoney, formatMoneyTable } from "@/lib/profileUtils";
import { CHART_HEIGHT_CLASS, CHART_MARGIN, CHART_THEME, valueChartDomain } from "@/lib/chartFormat";
import { formatSessionLabel } from "@/lib/marketSession";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Props = {
  series: WeeklyChartSeries;
};

type ValueChartPoint = Omit<WeeklyChartSeries["points"][number], "portfolioValue"> & {
  portfolioValue: number | null;
};

export function PortfolioValueTrendChart({ series }: Props) {
  const gradientId = useId();
  const { chartData, domain } = useMemo(() => {
    const data: ValueChartPoint[] = series.points.map((point) => ({
      ...point,
      portfolioValue: point.hasData ? point.portfolioValue : null
    }));
    const values = series.points.filter((point) => point.hasData).map((point) => point.portfolioValue);
    return { chartData: data, domain: valueChartDomain(values) };
  }, [series.points]);

  const title = series.profileName ? `${series.profileName} (${series.currency})` : series.currency;

  return (
    <div className="rounded-md border border-ink/10 bg-white p-3">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-ink">Portfolio value trend</h3>
        <p className="text-xs text-ink/55">{title} · gross value over the last 7 days</p>
      </div>
      <div
        className={`${CHART_HEIGHT_CLASS} min-w-[280px] w-full overflow-x-auto`}
        role="img"
        aria-label={`Portfolio value trend line chart for ${title} over the last 7 days`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={CHART_MARGIN}>
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
              tickFormatter={(value) => formatMoneyTable(Number(value), series.currency)}
              domain={domain}
              allowDataOverflow
              tick={CHART_THEME.axisTick}
            />
            <Tooltip content={<ValueTooltip currency={series.currency} />} />
            <Area
              type="monotone"
              dataKey="portfolioValue"
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
  const dateLabel = formatSessionLabel(point.snapshotDate);
  if (!point.hasData) {
    return (
      <div className="rounded-md border border-ink/10 bg-white px-3 py-2 text-xs text-ink/70 shadow-soft">
        <div className="font-semibold text-ink">{dateLabel}</div>
        <div>{point.marketClosed ? "Market closed" : "No snapshot saved"}</div>
      </div>
    );
  }
  return (
    <div className="rounded-md border border-ink/10 bg-white px-3 py-2 text-xs shadow-soft">
      <div className="font-semibold text-ink">{dateLabel}</div>
      <div className="text-marine">{formatMoney(point.portfolioValue ?? 0, currency)}</div>
    </div>
  );
}
