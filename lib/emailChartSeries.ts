import type { PortfolioReport } from "./portfolioReport";
import { type WeeklyChartSeries } from "./portfolioReportCharts";
import { chartAxisDateLabel } from "./marketSession";
import { snapshotDateForRegion } from "./portfolioSnapshots";

export function seriesHasPlottedPoints(series: WeeklyChartSeries[]) {
  return series.some((item) => item.points.some((point) => point.hasPlData));
}

export function resolveEmailChartSeries(
  report: PortfolioReport,
  series: WeeklyChartSeries[] = []
): WeeklyChartSeries[] {
  if (seriesHasPlottedPoints(series)) return series;

  const now = new Date(report.generatedAt);
  return report.profiles
    .filter((profile) => profile.totals.quotedHoldingsCount > 0)
    .map((profile) => {
      const snapshotDate = snapshotDateForRegion(now, profile.region);
      return {
        currency: profile.currency,
        region: profile.region,
        profileId: profile.id,
        profileName: profile.name,
        points: [{
          date: chartAxisDateLabel(snapshotDate, now),
          snapshotDate,
          dailyProfitLoss: profile.totals.dailyProfitLoss,
          dailyProfitLossPercent: profile.totals.dailyProfitLossPercent,
          portfolioValue: profile.totals.currentValue,
          totalProfitLoss: profile.totals.profitLoss,
          hasData: true,
          hasPlData: true,
          marketClosed: false
        }]
      };
    });
}
