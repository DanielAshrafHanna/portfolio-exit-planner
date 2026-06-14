"use client";

import { AlertTriangle, BarChart3, RefreshCw } from "lucide-react";
import { useMemo } from "react";
import { PortfolioValueTrendChart } from "@/components/PortfolioValueTrendChart";
import { TodayHoldingMoversChart } from "@/components/TodayHoldingMoversChart";
import { WeeklyCumulativePlChart } from "@/components/WeeklyCumulativePlChart";
import { WeeklyDailyPlChart } from "@/components/WeeklyDailyPlChart";
import { reportProfileTabClass } from "@/components/reportTabs";
import { SectionCard } from "@/components/ui/SectionCard";
import { topHoldingMovers } from "@/lib/portfolioReportCharts";
import type { WeeklyChartSeries } from "@/lib/portfolioReportCharts";
import type { PortfolioReport } from "@/lib/portfolioReport";
import { getDailyPlSessionInfo, regionFromCurrency } from "@/lib/marketSession";
import type { CurrencyCode } from "@/lib/types";

type Props = {
  report: PortfolioReport | null;
  historySeries: WeeklyChartSeries[];
  selectedProfileId: string;
  onSelectedProfileIdChange: (profileId: string) => void;
  isLoadingReport: boolean;
  isLoadingHistory: boolean;
  error: string | null;
  warnings: string[];
  onRefresh: () => void;
};

export function PortfolioReportChartsPanel({
  report,
  historySeries,
  selectedProfileId,
  onSelectedProfileIdChange,
  isLoadingReport,
  isLoadingHistory,
  error,
  warnings,
  onRefresh
}: Props) {
  const isLoading = isLoadingReport || isLoadingHistory;

  const selectedProfile = useMemo(() => (
    report?.profiles.find((profile) => profile.id === selectedProfileId)
  ), [report, selectedProfileId]);

  const holdingsForMovers = useMemo(() => {
    const rows = selectedProfile ? selectedProfile.holdings : report?.holdings || [];
    return rows.filter((holding) => holding.currentPrice !== undefined);
  }, [report?.holdings, selectedProfile]);

  const moversByCurrency = useMemo(() => {
    const grouped = new Map<CurrencyCode, ReturnType<typeof topHoldingMovers>>();
    holdingsForMovers.forEach((holding) => {
      const existing = grouped.get(holding.currency) || [];
      existing.push({
        symbol: holding.symbol,
        name: holding.name,
        dailyProfitLoss: holding.dailyProfitLoss
      });
      grouped.set(holding.currency, existing);
    });
    return [...grouped.entries()].map(([currency, holdings]) => {
      const session = getDailyPlSessionInfo(regionFromCurrency(currency));
      return {
        currency,
        movers: topHoldingMovers(holdings),
        session
      };
    });
  }, [holdingsForMovers]);

  const historyDataDays = useMemo(() => (
    historySeries.reduce((count, series) => (
      Math.max(count, series.points.filter((point) => point.hasData).length)
    ), 0)
  ), [historySeries]);

  const generatedLabel = report ? formatDateTime(report.generatedAt) : "Not loaded";

  return (
    <SectionCard
      variant="secondary"
      icon={BarChart3}
      eyebrow="Report"
      title="Charts"
      description="Live movers update instantly. Weekly history is saved when you open the report or when the daily cron runs."
      action={(
        <button
          className="inline-flex min-h-10 items-center gap-2 rounded-md border border-marine/25 bg-white px-3 py-2 text-sm font-semibold text-marine hover:border-marine/50 disabled:cursor-not-allowed disabled:opacity-60"
          type="button"
          onClick={onRefresh}
          disabled={isLoading}
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} aria-hidden />
          Refresh
        </button>
      )}
    >
      <div className="space-y-4 p-3 sm:p-4">
        <div className="text-xs text-ink/55">{generatedLabel}</div>

        {error ? (
          <div className="flex gap-2 rounded-md border border-coral/30 bg-coral/10 p-3 text-sm text-coral">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            {error}
          </div>
        ) : null}

        {warnings.length ? (
          <div className="rounded-md border border-amber/35 bg-amber/10 p-3 text-sm text-ink/75">
            <div className="mb-1 flex items-center gap-2 font-semibold text-ink">
              <AlertTriangle className="h-4 w-4 text-amber" aria-hidden />
              Notes
            </div>
            <ul className="space-y-1">
              {warnings.map((warning) => <li key={warning}>{warning}</li>)}
            </ul>
          </div>
        ) : null}

        {report || historySeries.length ? (
          <>
            {report ? (
              <div className="flex gap-2 overflow-x-auto pb-1">
                <button className={reportProfileTabClass(selectedProfileId === "all")} type="button" onClick={() => onSelectedProfileIdChange("all")}>All</button>
                {report.profiles.map((profile) => (
                  <button
                    className={reportProfileTabClass(selectedProfileId === profile.id)}
                    type="button"
                    key={profile.id}
                    onClick={() => onSelectedProfileIdChange(profile.id)}
                  >
                    {profile.name}
                  </button>
                ))}
              </div>
            ) : null}

            {historyDataDays < 2 ? (
              <div className="rounded-md border border-ink/10 bg-mint/20 p-3 text-sm text-ink/70">
                Weekly charts fill in as daily snapshots are saved. Check back after a few market days.
              </div>
            ) : null}

            <div className="grid gap-4 xl:grid-cols-2">
              {historySeries.map((series) => <WeeklyDailyPlChart series={series} key={`daily-${series.profileId}-${series.currency}`} />)}
              {report ? moversByCurrency.map((entry) => (
                <TodayHoldingMoversChart
                  holdings={entry.movers}
                  currency={entry.currency}
                  key={`movers-${entry.currency}`}
                  title={`${entry.session.moversTitle} (${entry.currency})`}
                  subtitle={entry.session.subtitle}
                  sessionLabel={entry.session.sessionLabel}
                  isMarketClosed={entry.session.isMarketClosed}
                />
              )) : null}
              {historySeries.map((series) => <WeeklyCumulativePlChart series={series} key={`cumulative-${series.profileId}-${series.currency}`} />)}
              {historySeries.map((series) => <PortfolioValueTrendChart series={series} key={`value-${series.profileId}-${series.currency}`} />)}
            </div>
          </>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {[0, 1, 2, 3].map((item) => <div className="h-64 animate-pulse rounded-md bg-white" key={item} />)}
          </div>
        )}
      </div>
    </SectionCard>
  );
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}
