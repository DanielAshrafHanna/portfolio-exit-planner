"use client";

import { buildCumulativePoints } from "@/lib/portfolioReportCharts";
import type { WeeklyChartSeries } from "@/lib/portfolioReportCharts";
import type { CurrencyCode } from "@/lib/types";
import { CHART_MARGIN, formatChartSignedAxis, formatChartSignedMoney, plChartDomain } from "@/lib/chartFormat";
import { formatSessionLabel } from "@/lib/marketSession";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Props = {
  series: WeeklyChartSeries;
};

type CumulativeChartPoint = Omit<ReturnType<typeof buildCumulativePoints>[number], "cumulativeProfitLoss"> & {
  cumulativeProfitLoss: number | null;
};

export function WeeklyCumulativePlChart({ series }: Props) {
  const points: CumulativeChartPoint[] = buildCumulativePoints(series.points).map((point) => ({
    ...point,
    cumulativeProfitLoss: point.hasData ? point.cumulativeProfitLoss : null
  }));
  const values = series.points.filter((point) => point.hasData).map((_, index, rows) => {
    let running = 0;
    for (let i = 0; i <= index; i += 1) {
      if (rows[i].hasData) running += rows[i].dailyProfitLoss;
    }
    return running;
  });
  const [domainMin, domainMax] = plChartDomain(values);
  const title = series.profileName ? `${series.profileName} (${series.currency})` : series.currency;

  return (
    <div className="rounded-md border border-ink/10 bg-white p-3">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-ink">Cumulative weekly P/L</h3>
        <p className="text-xs text-ink/55">{title} · running total across the last 7 days</p>
      </div>
      <div className="h-64 min-w-[280px] w-full overflow-x-auto">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={CHART_MARGIN}>
            <CartesianGrid strokeDasharray="3 3" stroke="#d8ded5" />
            <XAxis dataKey="date" interval="preserveStartEnd" tick={{ fontSize: 10 }} />
            <YAxis
              width={48}
              tickFormatter={(value) => formatChartSignedAxis(Number(value), series.currency)}
              domain={[domainMin, domainMax]}
              tick={{ fontSize: 10 }}
            />
            <Tooltip content={<CumulativeTooltip currency={series.currency} />} />
            <ReferenceLine y={0} stroke="#17212b" strokeDasharray="4 4" />
            <Line
              type="monotone"
              dataKey="cumulativeProfitLoss"
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
