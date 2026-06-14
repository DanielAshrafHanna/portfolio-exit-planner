"use client";

import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { CurrencyCode } from "@/lib/types";
import { CHART_HEIGHT_CLASS, CHART_MARGIN, CHART_THEME, formatChartSignedAxis, formatChartSignedMoney } from "@/lib/chartFormat";

type Mover = {
  symbol: string;
  name: string;
  dailyProfitLoss: number;
};

type Props = {
  holdings: Mover[];
  currency: CurrencyCode;
  title?: string;
  subtitle?: string;
  sessionLabel?: string;
  isMarketClosed?: boolean;
};

export function TodayHoldingMoversChart({
  holdings,
  currency,
  title = "Today's top movers",
  subtitle,
  sessionLabel,
  isMarketClosed = false
}: Props) {
  const { chartData, domain } = useMemo(() => {
    const values = holdings.map((holding) => holding.dailyProfitLoss);
    const max = Math.max(...values, 0);
    const min = Math.min(...values, 0);
    const padding = Math.max(Math.abs(max), Math.abs(min), 1) * 0.15;
    return {
      chartData: holdings.map((holding) => ({ ...holding, label: holding.symbol })),
      domain: [min - padding, max + padding] as [number, number]
    };
  }, [holdings]);

  if (!holdings.length) {
    return (
      <div className="rounded-md border border-ink/10 bg-white p-3">
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        {subtitle ? <p className="mt-1 text-xs text-ink/55">{subtitle}</p> : null}
        <p className="mt-2 text-sm text-ink/60">No quoted holdings with daily P/L yet.</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-ink/10 bg-white p-3">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        <p className="text-xs text-ink/55">
          {subtitle || "Largest daily gainers and losers from the latest live quotes"}
          {sessionLabel ? ` · ${sessionLabel}` : ""}
          {isMarketClosed ? " · market closed" : ""}
        </p>
      </div>
      <div
        className={`${CHART_HEIGHT_CLASS} min-w-[280px] w-full overflow-x-auto`}
        role="img"
        aria-label={`Top daily movers bar chart for ${currency} holdings`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical" margin={{ ...CHART_MARGIN, left: 8 }}>
            <CartesianGrid strokeDasharray={CHART_THEME.gridDash} stroke={CHART_THEME.grid} />
            <XAxis
              type="number"
              domain={domain}
              tickFormatter={(value) => formatChartSignedAxis(Number(value), currency)}
              tick={CHART_THEME.axisTick}
            />
            <YAxis type="category" dataKey="label" width={56} tick={CHART_THEME.axisTick} />
            <Tooltip content={<MoversTooltip currency={currency} />} cursor={{ fill: "rgba(20,92,114,0.06)" }} />
            <ReferenceLine x={0} stroke={CHART_THEME.reference} strokeDasharray={CHART_THEME.referenceDash} />
            <Bar dataKey="dailyProfitLoss" radius={[0, 4, 4, 0]} isAnimationActive={false}>
              {chartData.map((holding) => (
                <Cell
                  key={holding.symbol}
                  fill={holding.dailyProfitLoss >= 0 ? CHART_THEME.gain : CHART_THEME.loss}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function MoversTooltip({
  active,
  payload,
  currency
}: {
  active?: boolean;
  payload?: Array<{ payload: Mover & { label: string } }>;
  currency: CurrencyCode;
}) {
  if (!active || !payload?.length) return null;
  const holding = payload[0].payload;
  return (
    <div className="rounded-md border border-ink/10 bg-white px-3 py-2 text-xs shadow-soft">
      <div className="font-semibold text-ink">{holding.symbol}</div>
      <div className="text-ink/60">{holding.name}</div>
      <div className={holding.dailyProfitLoss >= 0 ? "text-marine" : "text-coral"}>
        {formatChartSignedMoney(holding.dailyProfitLoss, currency)}
      </div>
    </div>
  );
}
