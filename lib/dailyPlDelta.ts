import { roundMoney } from "./calculations";
import type { HoldingSnapshotEntry } from "./holdingSnapshots";
import type { PortfolioReport, PortfolioReportHolding, PortfolioReportProfile } from "./portfolioReport";
import type { CurrencyCode } from "./types";

export type PriorProfileSnapshot = {
  snapshotDate: string;
  totalProfitLoss: number;
  portfolioValue: number;
  holdingsBySymbol: Map<string, HoldingSnapshotEntry>;
};

type DailyPlValues = {
  dailyProfitLoss: number;
  dailyProfitLossPercent: number;
};

type SessionDailyPl = {
  dailyProfitLoss: number;
  dailyProfitLossPercent: number;
};

export function profileDailyFromCostBasisDelta(
  current: { profitLoss: number } & SessionDailyPl,
  prior?: Pick<PriorProfileSnapshot, "totalProfitLoss" | "portfolioValue">
): DailyPlValues {
  if (!prior) {
    return {
      dailyProfitLoss: current.dailyProfitLoss,
      dailyProfitLossPercent: current.dailyProfitLossPercent
    };
  }

  const dailyProfitLoss = roundMoney(current.profitLoss - prior.totalProfitLoss);
  const dailyProfitLossPercent = prior.portfolioValue > 0
    ? roundMoney((dailyProfitLoss / prior.portfolioValue) * 100)
    : 0;

  return { dailyProfitLoss, dailyProfitLossPercent };
}

export function holdingDailyFromCostBasisDelta(
  current: { profitLoss: number; currentValue: number } & SessionDailyPl,
  prior?: Pick<HoldingSnapshotEntry, "profit_loss" | "current_value" | "cost_basis_tracked">
): DailyPlValues {
  if (!prior || prior.cost_basis_tracked === false) {
    return {
      dailyProfitLoss: current.dailyProfitLoss,
      dailyProfitLossPercent: current.dailyProfitLossPercent
    };
  }

  const dailyProfitLoss = roundMoney(current.profitLoss - prior.profit_loss);
  const priorValue = prior.current_value ?? 0;
  const dailyProfitLossPercent = priorValue > 0
    ? roundMoney((dailyProfitLoss / priorValue) * 100)
    : current.dailyProfitLossPercent;

  return { dailyProfitLoss, dailyProfitLossPercent };
}

function recalculateProfileTotals(profile: PortfolioReportProfile): PortfolioReportProfile["totals"] {
  const quotedRows = profile.holdings.filter((holding) => holding.currentPrice !== undefined);
  const totalCost = roundMoney(quotedRows.reduce((sum, row) => sum + row.cost, 0));
  const currentValue = roundMoney(quotedRows.reduce((sum, row) => sum + row.currentValue, 0));
  const netValue = roundMoney(quotedRows.reduce((sum, row) => sum + row.netValue, 0));
  const fees = roundMoney(quotedRows.reduce((sum, row) => sum + row.fees, 0));
  const profitLoss = roundMoney(quotedRows.reduce((sum, row) => sum + row.profitLoss, 0));
  const dailyProfitLoss = roundMoney(quotedRows.reduce((sum, row) => sum + row.dailyProfitLoss, 0));
  const dailyPriorValue = roundMoney(quotedRows.reduce((sum, row) => sum + row.dailyPriorValue, 0));
  const totalGains = roundMoney(quotedRows.reduce((sum, row) => sum + Math.max(0, row.profitLoss), 0));
  const totalLosses = roundMoney(quotedRows.reduce((sum, row) => sum + Math.min(0, row.profitLoss), 0));
  const stopProfitLoss = roundMoney(quotedRows.reduce((sum, row) => sum + (row.stopProfitLoss || 0), 0));
  const targetProfitLoss = roundMoney(quotedRows.reduce((sum, row) => sum + (row.targetProfitLoss || 0), 0));

  return {
    ...profile.totals,
    totalCost,
    currentValue,
    netValue,
    fees,
    profitLoss,
    profitLossPercent: totalCost > 0 ? roundMoney((profitLoss / totalCost) * 100) : 0,
    dailyProfitLoss,
    dailyProfitLossPercent: dailyPriorValue > 0 ? roundMoney((dailyProfitLoss / dailyPriorValue) * 100) : 0,
    dailyPriorValue,
    totalGains,
    totalLosses,
    stopProfitLoss,
    targetProfitLoss,
    holdingsCount: profile.holdings.length,
    quotedHoldingsCount: quotedRows.length
  };
}

function aggregateTotalsByCurrency(profiles: PortfolioReportProfile[]) {
  const byCurrency = new Map<CurrencyCode, PortfolioReportHolding[]>();
  profiles.forEach((profile) => {
    byCurrency.set(profile.currency, [...(byCurrency.get(profile.currency) || []), ...profile.holdings]);
  });

  return [...byCurrency.entries()].map(([currency, holdings]) => {
    const quotedRows = holdings.filter((holding) => holding.currentPrice !== undefined);
    const totalCost = roundMoney(quotedRows.reduce((sum, row) => sum + row.cost, 0));
    const currentValue = roundMoney(quotedRows.reduce((sum, row) => sum + row.currentValue, 0));
    const netValue = roundMoney(quotedRows.reduce((sum, row) => sum + row.netValue, 0));
    const fees = roundMoney(quotedRows.reduce((sum, row) => sum + row.fees, 0));
    const profitLoss = roundMoney(quotedRows.reduce((sum, row) => sum + row.profitLoss, 0));
    const dailyProfitLoss = roundMoney(quotedRows.reduce((sum, row) => sum + row.dailyProfitLoss, 0));
    const dailyPriorValue = roundMoney(quotedRows.reduce((sum, row) => sum + row.dailyPriorValue, 0));
    const totalGains = roundMoney(quotedRows.reduce((sum, row) => sum + Math.max(0, row.profitLoss), 0));
    const totalLosses = roundMoney(quotedRows.reduce((sum, row) => sum + Math.min(0, row.profitLoss), 0));
    const stopProfitLoss = roundMoney(quotedRows.reduce((sum, row) => sum + (row.stopProfitLoss || 0), 0));
    const targetProfitLoss = roundMoney(quotedRows.reduce((sum, row) => sum + (row.targetProfitLoss || 0), 0));

    return {
      currency,
      totalCost,
      currentValue,
      netValue,
      fees,
      profitLoss,
      profitLossPercent: totalCost > 0 ? roundMoney((profitLoss / totalCost) * 100) : 0,
      dailyProfitLoss,
      dailyProfitLossPercent: dailyPriorValue > 0 ? roundMoney((dailyProfitLoss / dailyPriorValue) * 100) : 0,
      dailyPriorValue,
      totalGains,
      totalLosses,
      stopProfitLoss,
      targetProfitLoss,
      holdingsCount: holdings.length,
      quotedHoldingsCount: quotedRows.length
    };
  });
}

function applyDailyToHolding(
  holding: PortfolioReportHolding,
  prior?: HoldingSnapshotEntry
): PortfolioReportHolding {
  const daily = holdingDailyFromCostBasisDelta(holding, prior);
  return {
    ...holding,
    dailyProfitLoss: daily.dailyProfitLoss,
    dailyProfitLossPercent: daily.dailyProfitLossPercent
  };
}

function applyDailyToProfile(
  profile: PortfolioReportProfile,
  prior?: PriorProfileSnapshot
): PortfolioReportProfile {
  const holdings = profile.holdings.map((holding) => (
    applyDailyToHolding(holding, prior?.holdingsBySymbol.get(holding.symbol))
  ));
  const totals = recalculateProfileTotals({ ...profile, holdings });
  const profileDaily = profileDailyFromCostBasisDelta(
    {
      profitLoss: totals.profitLoss,
      dailyProfitLoss: totals.dailyProfitLoss,
      dailyProfitLossPercent: totals.dailyProfitLossPercent
    },
    prior
      ? { totalProfitLoss: prior.totalProfitLoss, portfolioValue: prior.portfolioValue }
      : undefined
  );

  return {
    ...profile,
    holdings,
    totals: {
      ...totals,
      dailyProfitLoss: profileDaily.dailyProfitLoss,
      dailyProfitLossPercent: profileDaily.dailyProfitLossPercent
    }
  };
}

export function applyCostBasisDailyPlToReport(
  report: PortfolioReport,
  priorByProfileId: Map<string, PriorProfileSnapshot>
): PortfolioReport {
  const profiles = report.profiles.map((profile) => (
    applyDailyToProfile(profile, priorByProfileId.get(profile.id))
  ));

  return {
    ...report,
    profiles,
    holdings: profiles.flatMap((profile) => profile.holdings),
    totalsByCurrency: aggregateTotalsByCurrency(profiles)
  };
}

export function pickPriorSnapshotsForProfiles(
  rows: Array<{
    snapshot_date: string;
    profile_id: string;
    total_profit_loss: number;
    portfolio_value: number;
    holdings_snapshot: unknown;
  }>,
  targets: Array<{ profileId: string; sessionDate: string }>,
  parseHoldings: (value: unknown) => HoldingSnapshotEntry[]
): Map<string, PriorProfileSnapshot> {
  const grouped = new Map<string, typeof rows>();
  rows.forEach((row) => {
    const existing = grouped.get(row.profile_id) || [];
    existing.push(row);
    grouped.set(row.profile_id, existing);
  });

  const result = new Map<string, PriorProfileSnapshot>();
  targets.forEach(({ profileId, sessionDate }) => {
    const profileRows = (grouped.get(profileId) || [])
      .filter((row) => row.snapshot_date < sessionDate)
      .sort((left, right) => right.snapshot_date.localeCompare(left.snapshot_date));
    const prior = profileRows[0];
    if (!prior) return;

    const holdings = parseHoldings(prior.holdings_snapshot);
    result.set(profileId, {
      snapshotDate: prior.snapshot_date,
      totalProfitLoss: Number(prior.total_profit_loss) || 0,
      portfolioValue: Number(prior.portfolio_value) || 0,
      holdingsBySymbol: new Map(holdings.map((holding) => [holding.symbol, holding]))
    });
  });

  return result;
}

export function lookbackSnapshotDate(sessionDate: string, days = 21) {
  const date = new Date(`${sessionDate}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}
