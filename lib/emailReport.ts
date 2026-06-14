import { formatSignedMoney, formatPercent, type PortfolioReport, type PortfolioReportHolding } from "./portfolioReport";
import { topHoldingMovers, type WeeklyChartSeries } from "./portfolioReportCharts";
import { formatMoney } from "./profileUtils";
import type { CurrencyCode } from "./types";

export type EmailDeliveryResult = {
  configured: boolean;
  sent: boolean;
  warning?: string;
};

type SendDailyReportEmailOptions = {
  to: string;
  report: PortfolioReport;
  series?: WeeklyChartSeries[];
  displayName?: string;
};

export function formatDailyReportEmailText(
  report: PortfolioReport,
  options: { series?: WeeklyChartSeries[]; displayName?: string } = {}
) {
  const lines = [report.textDigest, ""];
  if (options.displayName?.trim()) {
    lines.unshift(`Hi ${options.displayName.trim()},`, "");
  }

  const moversLines = formatMoversSectionText(report);
  if (moversLines.length) {
    lines.push("Daily top movers", ...moversLines, "");
  }

  const chartLines = formatChartsSectionText(options.series || []);
  if (chartLines.length) {
    lines.push("7-day daily P/L", ...chartLines);
  }

  lines.push("", "Educational summary only — not financial advice.");
  return lines.join("\n").trim();
}

export function formatDailyReportEmailHtml(
  report: PortfolioReport,
  options: { series?: WeeklyChartSeries[]; displayName?: string } = {}
) {
  const generated = new Date(report.generatedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
  const greeting = options.displayName?.trim()
    ? `<p style="margin:0 0 12px;color:#18312b;">Hi ${escapeHtml(options.displayName.trim())},</p>`
    : "";
  const moversSection = formatMoversSectionHtml(report);
  const chartsSection = formatChartsSectionHtml(options.series || []);

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
      ${greeting}
      ${moversSection}
      ${chartsSection}
      ${report.totalsByCurrency.map((totals) => `<section style="border:1px solid #b9d6c9;border-radius:8px;padding:16px;margin-top:12px;background:#edf6f1;"><h2 style="margin:0 0 10px;font-size:16px;">All ${totals.currency} portfolios</h2>${totalsTable(totals)}</section>`).join("")}
      ${profileCards}
      ${report.warnings.length ? `<section style="border:1px solid #e8cf8a;border-radius:8px;padding:16px;margin-top:16px;background:#fff8df;"><h2 style="margin:0 0 8px;font-size:16px;">Warnings</h2><ul>${report.warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join("")}</ul></section>` : ""}
      <p style="margin:24px 0 0;font-size:12px;color:#47645b;">Educational summary only — not financial advice. Charts and movers use your saved cloud portfolio.</p>
    </main>
  </body>
</html>`;
}

export async function sendDailyReportEmail(options: SendDailyReportEmailOptions): Promise<EmailDeliveryResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.REPORT_FROM_EMAIL;
  if (!apiKey || !from) {
    return {
      configured: false,
      sent: false,
      warning: "Email delivery is not configured. Add RESEND_API_KEY and REPORT_FROM_EMAIL."
    };
  }

  const subjectDate = new Date(options.report.generatedAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
      to: [options.to],
      subject: `Daily Portfolio Summary - ${subjectDate}`,
      text: formatDailyReportEmailText(options.report, {
        series: options.series,
        displayName: options.displayName
      }),
      html: formatDailyReportEmailHtml(options.report, {
        series: options.series,
        displayName: options.displayName
      })
    })
  });

  if (!response.ok) {
    const message = await response.text();
    return {
      configured: true,
      sent: false,
      warning: `Email delivery failed for ${options.to}: ${message || response.statusText}`
    };
  }

  return { configured: true, sent: true };
}

function formatMoversSectionText(report: PortfolioReport) {
  const grouped = groupHoldingsForMovers(report.holdings);
  return [...grouped.entries()].flatMap(([currency, holdings]) => {
    const movers = topHoldingMovers(holdings, { limit: 3 });
    if (!movers.length) return [];
    return [
      `${currency} movers:`,
      ...movers.map((holding) => (
        `- ${holding.symbol}: ${formatSignedMoney(holding.dailyProfitLoss, currency)} (${formatPercent(holding.dailyProfitLossPercent)})`
      ))
    ];
  });
}

function formatMoversSectionHtml(report: PortfolioReport) {
  const grouped = groupHoldingsForMovers(report.holdings);
  const blocks = [...grouped.entries()].map(([currency, holdings]) => {
    const movers = topHoldingMovers(holdings, { limit: 5 });
    if (!movers.length) return "";
    return `
      <section style="border:1px solid #d8e6df;border-radius:8px;padding:16px;margin-top:12px;background:#ffffff;">
        <h2 style="margin:0 0 10px;font-size:16px;color:#18312b;">Daily top movers (${currency})</h2>
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead>
            <tr>
              ${["Symbol", "Daily P/L", "Daily %"].map((label) => `<th style="text-align:left;border-bottom:1px solid #d8e6df;padding:8px 4px;color:#47645b;">${label}</th>`).join("")}
            </tr>
          </thead>
          <tbody>
            ${movers.map((holding) => `
              <tr>
                <td style="border-bottom:1px solid #eef3f0;padding:8px 4px;font-weight:700;">${escapeHtml(holding.symbol)}</td>
                <td style="border-bottom:1px solid #eef3f0;padding:8px 4px;color:${toneColor(holding.dailyProfitLoss)};">${formatSignedMoney(holding.dailyProfitLoss, currency)}</td>
                <td style="border-bottom:1px solid #eef3f0;padding:8px 4px;color:${toneColor(holding.dailyProfitLoss)};">${formatPercent(holding.dailyProfitLossPercent)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </section>`;
  }).filter(Boolean);

  return blocks.join("");
}

function formatChartsSectionText(series: WeeklyChartSeries[]) {
  return series.flatMap((item) => {
    const points = item.points.filter((point) => point.hasPlData);
    if (!points.length) return [];
    const label = item.profileName ? `${item.profileName} (${item.currency})` : item.currency;
    return [
      `${label}: ${points.map((point) => `${point.date} ${formatSignedMoney(point.dailyProfitLoss, item.currency)}`).join(", ")}`
    ];
  });
}

function formatChartsSectionHtml(series: WeeklyChartSeries[]) {
  const blocks = series.map((item) => {
    const svg = weeklyPlChartSvg(item);
    if (!svg) return "";
    const title = item.profileName ? `${item.profileName} (${item.currency})` : `${item.currency} portfolio`;
    return `
      <section style="border:1px solid #d8e6df;border-radius:8px;padding:16px;margin-top:12px;background:#ffffff;">
        <h2 style="margin:0 0 10px;font-size:16px;color:#18312b;">7-day daily P/L — ${escapeHtml(title)}</h2>
        ${svg}
      </section>`;
  }).filter(Boolean);

  return blocks.join("");
}

export function weeklyPlChartSvg(series: WeeklyChartSeries, width = 560, height = 180) {
  const points = series.points.filter((point) => point.hasPlData);
  if (!points.length) return "";

  const padding = { top: 16, right: 12, bottom: 28, left: 12 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const maxAbs = Math.max(...points.map((point) => Math.abs(point.dailyProfitLoss)), 1);
  const barGap = 8;
  const barWidth = Math.max(12, (chartWidth - barGap * (points.length - 1)) / points.length);
  const baselineY = padding.top + chartHeight / 2;

  const bars = points.map((point, index) => {
    const x = padding.left + index * (barWidth + barGap);
    const normalized = point.dailyProfitLoss / maxAbs;
    const barHeight = Math.max(2, Math.abs(normalized) * (chartHeight / 2 - 4));
    const y = point.dailyProfitLoss >= 0 ? baselineY - barHeight : baselineY;
    const fill = point.dailyProfitLoss >= 0 ? "#1f6f5f" : "#d96b5b";
    return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barWidth.toFixed(1)}" height="${barHeight.toFixed(1)}" rx="3" fill="${fill}" />`;
  }).join("");

  const labels = points.map((point, index) => {
    const x = padding.left + index * (barWidth + barGap) + barWidth / 2;
    return `<text x="${x.toFixed(1)}" y="${(height - 8).toFixed(1)}" text-anchor="middle" font-size="10" fill="#47645b">${escapeHtml(point.date)}</text>`;
  }).join("");

  return `<svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}" role="img" aria-label="7-day daily profit and loss chart"><line x1="${padding.left}" y1="${baselineY}" x2="${width - padding.right}" y2="${baselineY}" stroke="#d8e6df" stroke-width="1" />${bars}${labels}</svg>`;
}

function groupHoldingsForMovers(holdings: PortfolioReportHolding[]) {
  const grouped = new Map<CurrencyCode, Array<{
    symbol: string;
    name: string;
    dailyProfitLoss: number;
    dailyProfitLossPercent: number;
  }>>();

  holdings.forEach((holding) => {
    if (holding.currentPrice === undefined) return;
    const existing = grouped.get(holding.currency) || [];
    existing.push({
      symbol: holding.symbol,
      name: holding.name,
      dailyProfitLoss: holding.dailyProfitLoss,
      dailyProfitLossPercent: holding.dailyProfitLossPercent
    });
    grouped.set(holding.currency, existing);
  });

  return grouped;
}

function totalsTable(totals: PortfolioReport["totalsByCurrency"][number]) {
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

function toneColor(value: number) {
  if (value > 0) return "#1f6f5f";
  if (value < 0) return "#d96b5b";
  return "#18312b";
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
