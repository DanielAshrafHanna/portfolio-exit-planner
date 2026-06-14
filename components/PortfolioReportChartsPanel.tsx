"use client";

import { AlertTriangle, BarChart3, Loader2, RefreshCw } from "lucide-react";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { ChartLegend } from "@/components/ChartLegend";
import { reportProfileTabClass } from "@/components/reportTabs";
import { SectionCard } from "@/components/ui/SectionCard";
import { buildMoverDateOptions, mergeHoldingSnapshotsForMovers, type HoldingSnapshotDay } from "@/lib/holdingSnapshots";
import { topHoldingMovers } from "@/lib/portfolioReportCharts";
import type { WeeklyChartSeries } from "@/lib/portfolioReportCharts";
import type { PortfolioReport } from "@/lib/portfolioReport";
import { formatSessionLabel, getDailyPlSessionInfo, regionFromCurrency } from "@/lib/marketSession";
import type { CurrencyCode } from "@/lib/types";

const ChartFallback = () => <div className="h-64 animate-pulse rounded-md bg-surface-muted" />;

const WeeklyDailyPlChart = dynamic(
  () => import("@/components/WeeklyDailyPlChart").then((mod) => mod.WeeklyDailyPlChart),
  { ssr: false, loading: ChartFallback }
);
const WeeklyCumulativePlChart = dynamic(
  () => import("@/components/WeeklyCumulativePlChart").then((mod) => mod.WeeklyCumulativePlChart),
  { ssr: false, loading: ChartFallback }
);
const PortfolioValueTrendChart = dynamic(
  () => import("@/components/PortfolioValueTrendChart").then((mod) => mod.PortfolioValueTrendChart),
  { ssr: false, loading: ChartFallback }
);
const TodayHoldingMoversChart = dynamic(
  () => import("@/components/TodayHoldingMoversChart").then((mod) => mod.TodayHoldingMoversChart),
  { ssr: false, loading: ChartFallback }
);

type Props = {
  report: PortfolioReport | null;
  historySeries: WeeklyChartSeries[];
  holdingSnapshots: HoldingSnapshotDay[];
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
  holdingSnapshots,
  selectedProfileId,
  onSelectedProfileIdChange,
  isLoadingReport,
  isLoadingHistory,
  error,
  warnings,
  onRefresh
}: Props) {
  const isLoading = isLoadingReport || isLoadingHistory;
  const hasData = Boolean(report) || historySeries.length > 0;
  const [moversDateByCurrency, setMoversDateByCurrency] = useState<Partial<Record<CurrencyCode, string>>>({});

  const selectedProfile = useMemo(() => (
    report?.profiles.find((profile) => profile.id === selectedProfileId)
  ), [report, selectedProfileId]);

  const holdingsForMovers = useMemo(() => {
    const rows = selectedProfile ? selectedProfile.holdings : report?.holdings || [];
    return rows.filter((holding) => holding.currentPrice !== undefined);
  }, [report?.holdings, selectedProfile]);

  const moversByCurrency = useMemo(() => {
    const grouped = new Map<CurrencyCode, Array<{ symbol: string; name: string; dailyProfitLoss: number; shares: number }>>();
    holdingsForMovers.forEach((holding) => {
      const existing = grouped.get(holding.currency) || [];
      existing.push({
        symbol: holding.symbol,
        name: holding.name,
        dailyProfitLoss: holding.dailyProfitLoss,
        shares: holding.shares
      });
      grouped.set(holding.currency, existing);
    });

    const currencies = new Set<CurrencyCode>([
      ...grouped.keys(),
      ...historySeries
        .filter((series) => selectedProfileId === "all" || series.profileId === selectedProfileId)
        .map((series) => series.currency)
    ]);

    return [...currencies].sort().map((currency) => {
      const session = getDailyPlSessionInfo(regionFromCurrency(currency));
      const selectedDateId = moversDateByCurrency[currency] || "live";
      const snapshotDates = historySeries
        .filter((series) => series.currency === currency && (selectedProfileId === "all" || series.profileId === selectedProfileId))
        .flatMap((series) => series.points.filter((point) => point.hasPlData).map((point) => point.snapshotDate));
      const dateOptions = buildMoverDateOptions(snapshotDates, holdingSnapshots, {
        currency,
        profileId: selectedProfileId
      });

      const liveHoldings = grouped.get(currency) || [];
      let movers: Array<{ symbol: string; name: string; dailyProfitLoss: number; shares?: number }> = [];
      let emptyMessage = "No quoted holdings with daily P/L for this day.";

      if (selectedDateId === "live") {
        movers = topHoldingMovers(liveHoldings).map((holding) => {
          const full = liveHoldings.find((row) => row.symbol === holding.symbol);
          return { ...holding, shares: full?.shares };
        });
      } else {
        const historical = mergeHoldingSnapshotsForMovers(holdingSnapshots, {
          currency,
          profileId: selectedProfileId,
          snapshotDate: selectedDateId
        });
        if (!historical.length) {
          emptyMessage = `No saved mover breakdown for ${formatSessionLabel(selectedDateId)} yet. Open the report on a market day after updating, or pick Latest (live).`;
        }
        movers = topHoldingMovers(historical).map((holding) => {
          const full = historical.find((row) => row.symbol === holding.symbol);
          return { ...holding, shares: full?.shares };
        });
      }

      return {
        currency,
        movers,
        session,
        dateOptions,
        selectedDateId,
        emptyMessage
      };
    });
  }, [holdingSnapshots, historySeries, holdingsForMovers, moversDateByCurrency, selectedProfileId]);

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
      description="Pick a day for top movers. Latest uses live quotes; past days use saved snapshots from when you opened the report."
      action={(
        <button
          className="inline-flex min-h-10 items-center gap-2 rounded-md border border-marine/25 bg-white px-3 py-2 text-sm font-semibold text-marine hover:border-marine/50 disabled:cursor-not-allowed disabled:opacity-60"
          type="button"
          onClick={onRefresh}
          disabled={isLoading}
          aria-busy={isLoading}
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

        {hasData ? (
          <>
            {report ? (
              <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Filter charts by portfolio">
                <button
                  className={reportProfileTabClass(selectedProfileId === "all")}
                  type="button"
                  aria-pressed={selectedProfileId === "all"}
                  onClick={() => onSelectedProfileIdChange("all")}
                >
                  All
                </button>
                {report.profiles.map((profile) => (
                  <button
                    className={reportProfileTabClass(selectedProfileId === profile.id)}
                    type="button"
                    key={profile.id}
                    aria-pressed={selectedProfileId === profile.id}
                    onClick={() => onSelectedProfileIdChange(profile.id)}
                  >
                    {profile.name}
                  </button>
                ))}
              </div>
            ) : null}

            <ChartLegend />

            {historyDataDays < 2 ? (
              <div className="rounded-md border border-ink/10 bg-mint/20 p-3 text-sm text-ink/70">
                Weekly charts fill in as daily snapshots are saved. Check back after a few market days.
              </div>
            ) : null}

            <div className="relative" aria-busy={isLoading}>
              {isLoading ? (
                <div className="pointer-events-none absolute inset-0 z-10 flex items-start justify-center rounded-md bg-white/55">
                  <span className="mt-6 inline-flex items-center gap-2 rounded-full border border-marine/20 bg-white px-3 py-1 text-xs font-semibold text-marine shadow-soft">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                    Updating charts
                  </span>
                </div>
              ) : null}
              <div className={`grid gap-4 transition-opacity xl:grid-cols-2 ${isLoading ? "opacity-60" : "opacity-100"}`}>
                {historySeries.map((series) => <WeeklyDailyPlChart series={series} key={`daily-${series.profileId}-${series.currency}`} />)}
                {report ? moversByCurrency.map((entry) => (
                  <TodayHoldingMoversChart
                    holdings={entry.movers}
                    currency={entry.currency}
                    key={`movers-${entry.currency}`}
                    title={`Top movers · ${entry.currency}`}
                    subtitle={entry.selectedDateId === "live" ? entry.session.subtitle : `Saved snapshot · ${formatSessionLabel(entry.selectedDateId)}`}
                    sessionLabel={entry.selectedDateId === "live" ? entry.session.sessionLabel : undefined}
                    isMarketClosed={entry.selectedDateId === "live" ? entry.session.isMarketClosed : false}
                    dateOptions={entry.dateOptions}
                    selectedDateId={entry.selectedDateId}
                    onDateChange={(dateId) => setMoversDateByCurrency((existing) => ({ ...existing, [entry.currency]: dateId }))}
                    emptyMessage={entry.emptyMessage}
                  />
                )) : null}
                {historySeries.map((series) => <WeeklyCumulativePlChart series={series} key={`cumulative-${series.profileId}-${series.currency}`} />)}
                {historySeries.map((series) => <PortfolioValueTrendChart series={series} key={`value-${series.profileId}-${series.currency}`} />)}
              </div>
            </div>
          </>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2" aria-busy={isLoading}>
            {[0, 1, 2, 3].map((item) => <div className="h-64 animate-pulse rounded-md bg-surface-muted" key={item} />)}
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
