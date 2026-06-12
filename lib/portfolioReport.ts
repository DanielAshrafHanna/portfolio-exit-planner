import { calculateDailyProfitLoss, calculateProfitLoss, calculateStopLosses, defaultSellTargets, roundMoney } from "./calculations";
import { getQuote } from "./marketData";
import { displayMarketSymbol, formatMoney } from "./profileUtils";
import type { CurrencyCode, EnrichedHolding, MarketQuote, MarketRegion, PortfolioProfile } from "./types";

export type ReportTone = "gain" | "loss" | "neutral";

export type PortfolioReportHolding = {
  id: string;
  symbol: string;
  name: string;
  profileId: string;
  profileName: string;
  region: MarketRegion;
  currency: CurrencyCode;
  shares: number;
  averageCost: number;
  cost: number;
  currentPrice?: number;
  previousClose?: number;
  currentValue: number;
  netValue: number;
  fees: number;
  profitLoss: number;
  profitLossPercent: number;
  dailyProfitLoss: number;
  dailyProfitLossPercent: number;
  dailyPriorValue: number;
  stopPrice?: number;
  stopProfitLoss?: number;
  targetPrice?: number;
  targetProfitLoss?: number;
  action?: string;
  riskLevel?: string;
  provider?: string;
  stale?: boolean;
  warning?: string;
};

export type PortfolioReportTotals = {
  currency: CurrencyCode;
  totalCost: number;
  currentValue: number;
  netValue: number;
  fees: number;
  profitLoss: number;
  profitLossPercent: number;
  dailyProfitLoss: number;
  dailyProfitLossPercent: number;
  dailyPriorValue: number;
  totalGains: number;
  totalLosses: number;
  stopProfitLoss: number;
  targetProfitLoss: number;
  holdingsCount: number;
  quotedHoldingsCount: number;
};

export type PortfolioReportProfile = {
  id: string;
  name: string;
  region: MarketRegion;
  currency: CurrencyCode;
  totals: PortfolioReportTotals;
  holdings: PortfolioReportHolding[];
  biggestWinner?: PortfolioReportHolding;
  biggestLoser?: PortfolioReportHolding;
  warnings: string[];
};

export type PortfolioReport = {
  generatedAt: string;
  totalsByCurrency: PortfolioReportTotals[];
  profiles: PortfolioReportProfile[];
  holdings: PortfolioReportHolding[];
  biggestWinner?: PortfolioReportHolding;
  biggestLoser?: PortfolioReportHolding;
  warnings: string[];
  textDigest: string;
  htmlDigest: string;
};

export type PortfolioReportQuoteFetcher = (
  symbol: string,
  region: MarketRegion
) => Promise<{ data?: MarketQuote; warning?: string }>;

type BuildPortfolioReportOptions = {
  now?: Date;
  fetchQuote?: PortfolioReportQuoteFetcher;
};

export async function buildPortfolioReport(
  profiles: PortfolioProfile[],
  options: BuildPortfolioReportOptions = {}
): Promise<PortfolioReport> {
  const generatedAt = (options.now || new Date()).toISOString();
  const fetchQuote = options.fetchQuote || defaultFetchQuote;
  const reportProfiles = await Promise.all(profiles.map((profile) => buildProfileReport(profile, fetchQuote)));
  const holdings = reportProfiles.flatMap((profile) => profile.holdings);
  const quotedHoldings = holdings.filter((holding) => holding.currentPrice !== undefined);
  const totalsByCurrency = aggregateTotalsByCurrency(reportProfiles);
  const warnings = unique(reportProfiles.flatMap((profile) => profile.warnings));
  const biggestWinner = rankByPercent(quotedHoldings, "desc");
  const biggestLoser = rankByPercent(quotedHoldings, "asc");
  const report: Omit<PortfolioReport, "textDigest" | "htmlDigest"> = {
    generatedAt,
    totalsByCurrency,
    profiles: reportProfiles,
    holdings,
    biggestWinner,
    biggestLoser,
    warnings
  };

  return {
    ...report,
    textDigest: formatPortfolioReportText(report),
    htmlDigest: formatPortfolioReportHtml(report)
  };
}

async function buildProfileReport(
  profile: PortfolioProfile,
  fetchQuote: PortfolioReportQuoteFetcher
): Promise<PortfolioReportProfile> {
  const rows = await Promise.all(profile.holdings.map((holding) => buildHoldingReport(profile, holding, fetchQuote)));
  const warnings = unique(rows.map((row) => row.warning).filter((warning): warning is string => Boolean(warning)));
  const totals = calculateTotals(profile.currency, rows);
  const quotedRows = rows.filter((row) => row.currentPrice !== undefined);

  return {
    id: profile.id,
    name: profile.name,
    region: profile.region,
    currency: profile.currency,
    totals,
    holdings: rows,
    biggestWinner: rankByPercent(quotedRows, "desc"),
    biggestLoser: rankByPercent(quotedRows, "asc"),
    warnings: warnings.map((warning) => `${profile.name}: ${warning}`)
  };
}

async function buildHoldingReport(
  profile: PortfolioProfile,
  holding: EnrichedHolding,
  fetchQuote: PortfolioReportQuoteFetcher
): Promise<PortfolioReportHolding> {
  const marketSymbol = displayMarketSymbol(holding.symbol, profile.region);
  const base = {
    id: holding.id,
    symbol: holding.symbol,
    name: holding.name,
    profileId: profile.id,
    profileName: profile.name,
    region: profile.region,
    currency: profile.currency,
    shares: holding.shares,
    averageCost: holding.averageCost,
    cost: holding.totalCost
  };

  try {
    const quoteResult = await fetchQuote(marketSymbol, profile.region);
    const quote = quoteResult.data;
    if (!quote || quote.error || quote.currentPrice <= 0) {
      const message = quote?.error || `No live quote was available for ${holding.symbol}.`;
      return emptyHoldingReport(base, message);
    }

    const current = calculateProfitLoss(holding.shares, holding.averageCost, quote.currentPrice, profile.settings);
    const daily = calculateDailyProfitLoss(holding.shares, quote.currentPrice, quote.previousClose);
    const stops = calculateStopLosses(holding, quote);
    const stopPrice = stops[holding.selectedStopStyle || "balanced"].price;
    const stop = calculateProfitLoss(holding.shares, holding.averageCost, stopPrice, profile.settings);
    const targetPrice = holding.selectedTargetPrice
      || defaultSellTargets(quote.currentPrice, holding.analysis?.suggestedActionPlan.suggestedTakeProfit)[1].price;
    const target = calculateProfitLoss(holding.shares, holding.averageCost, targetPrice, profile.settings);

    return {
      ...base,
      currentPrice: quote.currentPrice,
      previousClose: quote.previousClose,
      currentValue: current.grossValue,
      netValue: current.netValue,
      fees: current.fees,
      profitLoss: current.profitLoss,
      profitLossPercent: current.profitLossPercent,
      dailyProfitLoss: daily.profitLoss,
      dailyProfitLossPercent: daily.profitLossPercent,
      dailyPriorValue: daily.priorValue,
      stopPrice,
      stopProfitLoss: stop.profitLoss,
      targetPrice,
      targetProfitLoss: target.profitLoss,
      action: holding.analysis?.action,
      riskLevel: holding.analysis?.riskLevel,
      provider: quote.provider,
      stale: quote.stale,
      warning: quoteResult.warning
    };
  } catch (error) {
    return emptyHoldingReport(base, error instanceof Error ? error.message : `Quote fetch failed for ${holding.symbol}.`);
  }
}

function emptyHoldingReport(
  base: Omit<PortfolioReportHolding, "currentValue" | "netValue" | "fees" | "profitLoss" | "profitLossPercent" | "dailyProfitLoss" | "dailyProfitLossPercent" | "dailyPriorValue">,
  warning: string
): PortfolioReportHolding {
  return {
    ...base,
    currentValue: 0,
    netValue: 0,
    fees: 0,
    profitLoss: 0,
    profitLossPercent: 0,
    dailyProfitLoss: 0,
    dailyProfitLossPercent: 0,
    dailyPriorValue: 0,
    warning
  };
}

function calculateTotals(currency: CurrencyCode, rows: PortfolioReportHolding[]): PortfolioReportTotals {
  const quotedRows = rows.filter((row) => row.currentPrice !== undefined);
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
    holdingsCount: rows.length,
    quotedHoldingsCount: quotedRows.length
  };
}

function aggregateTotalsByCurrency(profiles: PortfolioReportProfile[]) {
  const byCurrency = new Map<CurrencyCode, PortfolioReportHolding[]>();
  profiles.forEach((profile) => {
    byCurrency.set(profile.currency, [...(byCurrency.get(profile.currency) || []), ...profile.holdings]);
  });
  return [...byCurrency.entries()].map(([currency, holdings]) => calculateTotals(currency, holdings));
}

function rankByPercent(rows: PortfolioReportHolding[], direction: "asc" | "desc") {
  const sorted = [...rows].sort((a, b) => direction === "asc"
    ? a.profitLossPercent - b.profitLossPercent
    : b.profitLossPercent - a.profitLossPercent);
  return sorted[0];
}

async function defaultFetchQuote(symbol: string, region: MarketRegion) {
  return getQuote(symbol, region, { fresh: true });
}

export function reportTone(value: number): ReportTone {
  if (value > 0) return "gain";
  if (value < 0) return "loss";
  return "neutral";
}

export function formatPercent(value: number) {
  return `${value > 0 ? "+" : ""}${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}%`;
}

export function formatSignedMoney(value: number, currency: CurrencyCode) {
  const prefix = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${prefix}${formatMoney(Math.abs(value), currency)}`;
}

function formatTotalsLine(label: string, totals: PortfolioReportTotals) {
  return `${label}: value ${formatMoney(totals.currentValue, totals.currency)}, P/L ${formatSignedMoney(totals.profitLoss, totals.currency)} (${formatPercent(totals.profitLossPercent)}), today ${formatSignedMoney(totals.dailyProfitLoss, totals.currency)} (${formatPercent(totals.dailyProfitLossPercent)})`;
}

function formatPortfolioReportText(report: Omit<PortfolioReport, "textDigest" | "htmlDigest">) {
  const generated = new Date(report.generatedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
  const lines = [
    `Daily Portfolio Summary - ${generated}`,
    "",
    ...report.totalsByCurrency.map((totals) => formatTotalsLine(`All ${totals.currency} portfolios`, totals)),
    "",
    ...report.profiles.flatMap((profile) => [
      formatTotalsLine(profile.name, profile.totals),
      `Total gains: ${formatSignedMoney(profile.totals.totalGains, profile.currency)}`,
      `Total losses: ${formatSignedMoney(profile.totals.totalLosses, profile.currency)}`,
      `Biggest winner: ${formatHoldingRank(profile.biggestWinner)}`,
      `Biggest loser: ${formatHoldingRank(profile.biggestLoser)}`,
      ""
    ])
  ];

  if (report.warnings.length) {
    lines.push("Warnings:", ...report.warnings.map((warning) => `- ${warning}`));
  }

  return lines.join("\n").trim();
}

function formatPortfolioReportHtml(report: Omit<PortfolioReport, "textDigest" | "htmlDigest">) {
  const generated = new Date(report.generatedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
  const profileCards = report.profiles.map((profile) => `
    <section style="border:1px solid #d8e6df;border-radius:8px;padding:16px;margin-top:16px;background:#ffffff;">
      <h2 style="margin:0 0 10px;font-size:18px;color:#18312b;">${escapeHtml(profile.name)}</h2>
      ${totalsTable(profile.totals)}
      <h3 style="margin:16px 0 8px;font-size:14px;color:#47645b;">Holdings</h3>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead><tr>${["Symbol", "Value", "P/L", "Today", "Action", "Risk"].map((item) => `<th style="text-align:left;border-bottom:1px solid #d8e6df;padding:8px 4px;color:#47645b;">${item}</th>`).join("")}</tr></thead>
        <tbody>
          ${profile.holdings.map((holding) => holdingRowHtml(holding)).join("")}
        </tbody>
      </table>
    </section>`).join("");

  return `<!doctype html>
<html>
  <body style="margin:0;background:#f4f7f2;font-family:Inter,Arial,sans-serif;color:#18312b;">
    <main style="max-width:760px;margin:0 auto;padding:24px;">
      <h1 style="margin:0;font-size:24px;">Daily Portfolio Summary</h1>
      <p style="margin:6px 0 18px;color:#47645b;">${escapeHtml(generated)}</p>
      ${report.totalsByCurrency.map((totals) => `<section style="border:1px solid #b9d6c9;border-radius:8px;padding:16px;margin-top:12px;background:#edf6f1;"><h2 style="margin:0 0 10px;font-size:16px;">All ${totals.currency} portfolios</h2>${totalsTable(totals)}</section>`).join("")}
      ${profileCards}
      ${report.warnings.length ? `<section style="border:1px solid #e8cf8a;border-radius:8px;padding:16px;margin-top:16px;background:#fff8df;"><h2 style="margin:0 0 8px;font-size:16px;">Warnings</h2><ul>${report.warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join("")}</ul></section>` : ""}
    </main>
  </body>
</html>`;
}

function totalsTable(totals: PortfolioReportTotals) {
  const rows = [
    ["Total value", formatMoney(totals.currentValue, totals.currency)],
    ["Current P/L", `${formatSignedMoney(totals.profitLoss, totals.currency)} (${formatPercent(totals.profitLossPercent)})`],
    ["Daily P/L", `${formatSignedMoney(totals.dailyProfitLoss, totals.currency)} (${formatPercent(totals.dailyProfitLossPercent)})`],
    ["Total gains", formatSignedMoney(totals.totalGains, totals.currency)],
    ["Total losses", formatSignedMoney(totals.totalLosses, totals.currency)]
  ];

  return `<table style="width:100%;border-collapse:collapse;font-size:13px;">${rows.map(([label, value]) => `<tr><td style="padding:5px 0;color:#47645b;">${label}</td><td style="padding:5px 0;text-align:right;font-weight:700;">${value}</td></tr>`).join("")}</table>`;
}

function holdingRowHtml(holding: PortfolioReportHolding) {
  const currency = holding.currency;
  return `<tr>
    <td style="border-bottom:1px solid #eef3f0;padding:8px 4px;font-weight:700;">${escapeHtml(holding.symbol)}</td>
    <td style="border-bottom:1px solid #eef3f0;padding:8px 4px;">${formatMoney(holding.currentValue, currency)}</td>
    <td style="border-bottom:1px solid #eef3f0;padding:8px 4px;">${formatSignedMoney(holding.profitLoss, currency)} (${formatPercent(holding.profitLossPercent)})</td>
    <td style="border-bottom:1px solid #eef3f0;padding:8px 4px;">${formatSignedMoney(holding.dailyProfitLoss, currency)} (${formatPercent(holding.dailyProfitLossPercent)})</td>
    <td style="border-bottom:1px solid #eef3f0;padding:8px 4px;">${escapeHtml(holding.action || "-")}</td>
    <td style="border-bottom:1px solid #eef3f0;padding:8px 4px;">${escapeHtml(holding.riskLevel || "-")}</td>
  </tr>`;
}

function formatHoldingRank(holding?: PortfolioReportHolding) {
  if (!holding) return "N/A";
  return `${holding.symbol} ${formatSignedMoney(holding.profitLoss, holding.currency)} (${formatPercent(holding.profitLossPercent)})`;
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
