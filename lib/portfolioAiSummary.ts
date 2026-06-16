import { formatSignedMoney, formatPercent, type PortfolioReport, type PortfolioReportProfile } from "./portfolioReport";
import { buildAnalysisItemsFromReportProfile, buildUnifiedProfileAnalysis } from "./unifiedPortfolioAnalysis";
import { unifiedResultToEmailSummary } from "./dailyAiPersistence";
import type { DailyPortfolioSummary } from "./validation";

export type DailyPortfolioSummaryResult = {
  profileId: string;
  profileName: string;
  summary: DailyPortfolioSummary;
  fallback: boolean;
  warning?: string;
};

type BuildOptions = {
  generate?: NonNullable<Parameters<typeof buildUnifiedProfileAnalysis>[2]>["generate"];
  configured?: boolean;
};

export async function buildDailyPortfolioAiSummaries(
  report: PortfolioReport,
  options: BuildOptions = {}
): Promise<DailyPortfolioSummaryResult[]> {
  const results: DailyPortfolioSummaryResult[] = [];
  for (const reportProfile of report.profiles) {
    const items = buildAnalysisItemsFromReportProfile(
      reportProfile,
      reportProfile.holdings.map((holding) => ({
        id: holding.id,
        symbol: holding.symbol,
        name: holding.name,
        shares: holding.shares,
        averageCost: holding.averageCost,
        totalCost: holding.cost,
        notes: undefined
      }))
    );
    const unified = await buildUnifiedProfileAnalysis(reportProfile, items, options);
    results.push(unifiedResultToEmailSummary(unified));
  }
  return results;
}

/** Deterministic, non-hallucinating summary used when AI is unavailable or invalid. */
export function fallbackDailySummary(profile: PortfolioReportProfile): DailyPortfolioSummary {
  const quoted = profile.holdings.filter((holding) => holding.currentPrice !== undefined);
  const sorted = [...quoted].sort((a, b) => b.dailyProfitLoss - a.dailyProfitLoss);
  const winner = sorted[0];
  const loser = sorted[sorted.length - 1];
  const currency = profile.currency;
  const dailyText = `${formatSignedMoney(profile.totals.dailyProfitLoss, currency)} (${formatPercent(profile.totals.dailyProfitLossPercent)})`;
  const totalText = `${formatSignedMoney(profile.totals.profitLoss, currency)} (${formatPercent(profile.totals.profitLossPercent)})`;

  const overviewParts = [
    `${profile.name} moved ${dailyText} today and stands at ${totalText} overall.`
  ];
  if (winner && winner.dailyProfitLoss > 0) {
    overviewParts.push(`Top mover up: ${winner.symbol} ${formatSignedMoney(winner.dailyProfitLoss, currency)}.`);
  }
  if (loser && loser.dailyProfitLoss < 0 && (!winner || loser.symbol !== winner.symbol)) {
    overviewParts.push(`Biggest drag: ${loser.symbol} ${formatSignedMoney(loser.dailyProfitLoss, currency)}.`);
  }
  overviewParts.push("AI commentary is unavailable, so this is a data-only recap with no news context.");

  return {
    overview: overviewParts.join(" "),
    marketContext: "",
    holdings: quoted.map((holding) => ({
      symbol: holding.symbol.trim().toUpperCase(),
      action: actionFromHolding(holding.action),
      note: `${formatSignedMoney(holding.dailyProfitLoss, currency)} today (${formatPercent(holding.dailyProfitLossPercent)}); position P/L ${formatSignedMoney(holding.profitLoss, currency)}.`
    })),
    watchItems: [],
    sources: []
  };
}

function actionFromHolding(action?: string): DailyPortfolioSummary["holdings"][number]["action"] {
  if (action === "Keep" || action === "Watch" || action === "Trim" || action === "Sell") return action;
  return "Watch";
}
