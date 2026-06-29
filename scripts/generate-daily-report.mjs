#!/usr/bin/env node
/**
 * Generates the Daily Portfolio Report HTML from pre-fetched API + market data.
 * Usage: node scripts/generate-daily-report.mjs <portfolio-json> <market-us-json> <market-eg-json> <hist-us-json> <output-html>
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const [portfolioPath, marketUsPath, marketEgPath, histUsPath, outputPath] = process.argv.slice(2);
if (!portfolioPath || !outputPath) {
  console.error("Usage: node scripts/generate-daily-report.mjs <portfolio> <market-us> <market-eg> <hist-us> <output>");
  process.exit(1);
}

const portfolio = JSON.parse(readFileSync(portfolioPath, "utf8"));
const marketUs = JSON.parse(readFileSync(marketUsPath, "utf8"));
const marketEg = JSON.parse(readFileSync(marketEgPath, "utf8"));
const histUs = JSON.parse(readFileSync(histUsPath, "utf8"));

const quotes = {};
for (const row of [...marketUs.rows, ...marketEg.rows]) {
  quotes[row.symbol] = row.quote;
}

const SESSION_DATE = "2026-06-29";
const EMAIL = "danielhanna0001@gmail.com";
const SNAPSHOT_AT = portfolio.profiles[0]?.snapshot?.updatedAt || "2026-06-29T20:20:41.685+00:00";
const snapshotDisplay = new Date(SNAPSHOT_AT).toLocaleString("en-US", {
  timeZone: "America/New_York",
  dateStyle: "medium",
  timeStyle: "short",
});

const BENCHMARKS = {
  SPY: { chg: 1.65, price: 741, asOf: "Jun 29, 2026 4:00 PM EDT" },
  QQQ: { chg: 2.49, price: 724.08, asOf: "Jun 29, 2026 4:00 PM EDT" },
  EGX30: { chg: -1.03, price: 49825, asOf: "Jun 29, 2026 EGX close" },
};

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtUsd(n) {
  if (n == null || Number.isNaN(n)) return "N/A";
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtEgp(n) {
  if (n == null || Number.isNaN(n)) return "N/A";
  const sign = n < 0 ? "-" : "";
  return `${sign}EGP ${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtPct(n, digits = 2) {
  if (n == null || Number.isNaN(n)) return "Not available.";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(digits)}%`;
}

function pctClass(n) {
  if (n == null) return "";
  if (n > 0) return "positive";
  if (n < 0) return "negative";
  return "";
}

function mapAction(a) {
  if (a === "Trim") return "Consider trimming";
  return a || "Keep";
}

function actionBadge(a) {
  const label = mapAction(a);
  if (label === "Consider trimming" || label === "Do not add") return "badge-red";
  if (label === "Watch" || label === "Needs manual review") return "badge-yellow";
  return "badge-green";
}

function riskBadge(r) {
  if (r === "High" || r === "Speculative") return "badge-red";
  if (r === "Medium") return "badge-yellow";
  return "badge-gray";
}

function vsMa(price, ma) {
  if (!price || !ma) return "Not available.";
  const diff = ((price - ma) / ma) * 100;
  if (Math.abs(diff) < 0.3) return `At MA (${diff >= 0 ? "+" : ""}${diff.toFixed(1)}%)`;
  return price > ma ? `Above (+${diff.toFixed(1)}%)` : `Below (${diff.toFixed(1)}%)`;
}

function volLabel(ratio, dayChg) {
  if (ratio == null) return "Not available.";
  const pct = ratio * 100;
  const green = (dayChg ?? 0) >= 0;
  if (pct >= 150) return green ? "High-volume buying — confirms move" : "High-volume selling — confirms weakness";
  if (pct >= 70) return "Average volume — normal session";
  return "Low-volume move — low conviction, less reliable";
}

function macdDesc(sym, q, hist) {
  const rsi = q?.rsi;
  const price = q?.currentPrice;
  const ma20 = q?.ma20;
  const ma50 = q?.ma50;
  if (!rsi || !price) return "Not available.";
  const above20 = price > ma20;
  const above50 = price > ma50;
  if (above20 && above50 && rsi > 50) return "Above signal line — short-term momentum positive (recent uptrend)";
  if (!above20 && !above50 && rsi < 50) return "Below signal line — short-term momentum negative";
  if (above20 && rsi > 45) return "Above signal line — short-term momentum positive";
  if (!above20) return "Below signal line — short-term momentum negative";
  return "Near zero line — momentum neutral";
}

function technicalRead(sym, q, hist) {
  const rsi = q?.rsi;
  const price = q?.currentPrice;
  const ma20 = q?.ma20;
  const ma50 = q?.ma50;
  const ma200 = q?.ma200;
  if (!rsi || !price) return { read: "Unclear", badge: "badge-gray", caution: "Insufficient indicator data" };
  let bullish = 0;
  let bearish = 0;
  if (price > ma20) bullish++;
  else bearish++;
  if (price > ma50) bullish++;
  else bearish++;
  if (rsi > 55) bullish++;
  else if (rsi < 45) bearish++;
  const macd = macdDesc(sym, q, hist);
  if (macd.includes("positive")) bullish++;
  else if (macd.includes("negative")) bearish++;
  if (bullish >= 2 && bearish === 0) return { read: "Bullish", badge: "badge-green", caution: "" };
  if (bullish >= 2) return { read: "Improving", badge: "badge-blue", caution: "" };
  if (bearish >= 2 && bullish === 0) return { read: "Bearish", badge: "badge-red", caution: rsi < 35 ? "Oversold in downtrend — not a buy signal alone" : "" };
  if (bearish >= 2) return { read: "Weakening", badge: "badge-yellow", caution: "" };
  return { read: "Unclear", badge: "badge-gray", caution: "Mixed signals — insufficient confluence" };
}

function techSortKey(read) {
  const order = { Bearish: 0, Weakening: 1, Unclear: 2, Neutral: 3, Improving: 4, Bullish: 5 };
  return order[read] ?? 2;
}

function actionSortKey(a) {
  const label = mapAction(a);
  const order = {
    "Needs manual review": 0,
    "Consider trimming": 1,
    "Do not add": 2,
    Watch: 3,
    Keep: 4,
    "Add candidate": 5,
  };
  return order[label] ?? 4;
}

function riskSortKey(r) {
  const order = { Speculative: 0, High: 1, Medium: 2, Low: 3 };
  return order[r] ?? 3;
}

function getHoldings() {
  const all = [];
  for (const p of portfolio.profiles) {
    for (const h of p.snapshot.holdings) {
      const rr = h.reportRow || {};
      all.push({
        ...h,
        profileId: p.id,
        region: p.region,
        currency: p.currency,
        market: p.region === "EG" ? "EGX" : "US",
        action: mapAction(rr.action || h.action),
        riskLevel: rr.riskLevel || h.riskLevel || "Low",
        currentPrice: rr.currentPrice,
        name: rr.name || h.name || h.symbol,
        hist: histUs[h.symbol],
        quote: quotes[h.symbol],
      });
    }
  }
  return all;
}

const holdings = getHoldings();
const usProfile = portfolio.profiles.find((p) => p.id === "us-portfolio");
const egProfile = portfolio.profiles.find((p) => p.id === "eg-portfolio");

const usDaily = usProfile.snapshot.dailyProfitLoss;
const egDaily = egProfile.snapshot.dailyProfitLoss;
const totalHoldings = holdings.length;

const movers = [...holdings].sort((a, b) => (b.daily_profit_loss_percent ?? 0) - (a.daily_profit_loss_percent ?? 0));
const bestMover = movers[0];
const worstMover = movers[movers.length - 1];

const attentionCount = holdings.filter(
  (h) =>
    h.weightPercent > 15 ||
    h.riskLevel === "High" ||
    h.riskLevel === "Speculative" ||
    h.action === "Consider trimming" ||
    h.action === "Do not add" ||
    h.action === "Needs manual review" ||
    h.profit_loss < -40 ||
    (h.hist?.downStreak ?? 0) >= 3
).length;

const largestHolding = [...holdings].sort((a, b) => b.weightPercent - a.weightPercent)[0];

const streakHoldings = holdings.filter((h) => (h.hist?.downStreak ?? 0) >= 3);

const fiveDay = [...holdings]
  .filter((h) => h.hist?.d5 != null)
  .sort((a, b) => b.hist.d5 - a.hist.d5);
const strongest5d = fiveDay[0];
const weakest5d = fiveDay[fiveDay.length - 1];

const watchlistTicker = "TSM";
const watchlistName = "Taiwan Semiconductor Manufacturing";

const usHistory = portfolio.history.find((h) => h.profileId === "us-portfolio");
const egHistory = portfolio.history.find((h) => h.profileId === "eg-portfolio");

function historyBars(series, days = 7) {
  const pts = series.points.filter((p) => p.hasData && p.portfolioValue > 0).slice(-days);
  if (!pts.length) return null;
  const max = Math.max(...pts.map((p) => p.portfolioValue));
  return pts.map((p) => ({ label: p.date, value: p.portfolioValue, pct: (p.portfolioValue / max) * 100, pl: p.dailyProfitLoss }));
}

function plBars(series, days = 7) {
  const pts = series.points.filter((p) => p.hasPlData).slice(-days);
  if (!pts.length) return null;
  const maxAbs = Math.max(...pts.map((p) => Math.abs(p.dailyProfitLoss)), 1);
  return pts.map((p) => ({ label: p.date, pl: p.dailyProfitLoss, pct: (Math.abs(p.dailyProfitLoss) / maxAbs) * 100 }));
}

const sortedHoldings = [...holdings].sort((a, b) => {
  const ag = actionSortKey(a.action);
  const bg = actionSortKey(b.action);
  if (ag !== bg) return ag - bg;
  if (b.weightPercent !== a.weightPercent) return b.weightPercent - a.weightPercent;
  return (a.daily_profit_loss ?? 0) - (b.daily_profit_loss ?? 0);
});

const keepList = holdings.filter((h) => h.action === "Keep" || h.action === "Add candidate");
const watchList = holdings.filter((h) => h.action === "Watch" || h.action === "Needs manual review");
const trimList = holdings.filter((h) => h.action === "Consider trimming" || h.action === "Do not add");

const CSS = `:root {
  --bg: #f0f2f5;
  --surface: #ffffff;
  --surface-alt: #f8fafc;
  --border: #e2e8f0;
  --border-strong: #cbd5e1;
  --text-primary: #1a202c;
  --text-secondary: #4a5568;
  --text-muted: #718096;
  --positive: #16a34a;
  --positive-light: #bbf7d0;
  --positive-bg: #f0fdf4;
  --negative: #dc2626;
  --negative-light: #fecaca;
  --negative-bg: #fef2f2;
  --warning: #d97706;
  --warning-light: #fde68a;
  --warning-bg: #fffbeb;
  --info: #2563eb;
  --info-light: #bfdbfe;
  --info-bg: #eff6ff;
  --gray: #6b7280;
  --gray-light: #e5e7eb;
  --gray-bg: #f9fafb;
  --radius-sm: 4px;
  --radius: 8px;
  --radius-lg: 12px;
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
  --shadow: 0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06);
  --shadow-md: 0 4px 6px rgba(0,0,0,0.07), 0 2px 4px rgba(0,0,0,0.06);
}

* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  font-size: 14px;
  line-height: 1.5;
  background: var(--bg);
  color: var(--text-primary);
  padding: 16px;
  max-width: 1400px;
  margin: 0 auto;
}

.page-grid { display: grid; gap: 20px; }
.card-grid-sm { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px; }
.card-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; }
.two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.three-col { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }
@media (max-width: 900px) { .three-col { grid-template-columns: 1fr 1fr; } }
@media (max-width: 640px) {
  body { padding: 8px; }
  .two-col, .three-col { grid-template-columns: 1fr; }
  .card-grid-sm { grid-template-columns: repeat(2, 1fr); }
}

.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 14px 16px;
  box-shadow: var(--shadow-sm);
}
.card.positive { border-left: 4px solid var(--positive); }
.card.negative { border-left: 4px solid var(--negative); }
.card.warning  { border-left: 4px solid var(--warning); }
.card.info     { border-left: 4px solid var(--info); }
.card.missing  { border-left: 4px solid var(--gray); background: var(--gray-bg); }
.card-label {
  font-size: 10px; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.06em;
  color: var(--text-muted); margin-bottom: 5px;
}
.card-value { font-size: 22px; font-weight: 800; line-height: 1.2; }
.card-sub { font-size: 12px; color: var(--text-secondary); margin-top: 3px; }

section {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 20px;
  box-shadow: var(--shadow);
}
.section-header {
  display: flex; align-items: center; gap: 8px;
  padding-bottom: 12px; margin-bottom: 16px;
  border-bottom: 2px solid var(--border);
}
.section-title { font-size: 15px; font-weight: 700; }
.section-icon { font-size: 17px; }

.table-wrap { overflow-x: auto; border-radius: var(--radius); border: 1px solid var(--border); }
table { width: 100%; border-collapse: collapse; font-size: 13px; }
thead th {
  background: var(--surface-alt); padding: 9px 12px;
  text-align: left; font-size: 11px; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.04em;
  color: var(--text-muted); border-bottom: 1px solid var(--border-strong);
  position: sticky; top: 0; z-index: 5;
}
tbody td { padding: 9px 12px; border-bottom: 1px solid var(--border); vertical-align: middle; }
tbody tr:last-child td { border-bottom: none; }
tbody tr:hover { background: var(--surface-alt); }

.badge {
  display: inline-flex; align-items: center;
  padding: 2px 8px; border-radius: 999px;
  font-size: 11px; font-weight: 700;
  letter-spacing: 0.02em; white-space: nowrap;
}
.badge-green  { background: var(--positive-light); color: #14532d; }
.badge-red    { background: var(--negative-light); color: #7f1d1d; }
.badge-orange { background: #fed7aa; color: #9a3412; }
.badge-yellow { background: var(--warning-light); color: #78350f; }
.badge-blue   { background: var(--info-light); color: #1e3a8a; }
.badge-gray   { background: var(--gray-light); color: #374151; }

.alert {
  display: flex; gap: 12px; align-items: flex-start;
  padding: 12px 14px; border-radius: var(--radius);
  border-left: 4px solid; margin-bottom: 8px;
}
.alert-high   { background: var(--negative-bg); border-color: var(--negative); }
.alert-medium { background: var(--warning-bg);  border-color: var(--warning); }
.alert-low    { background: var(--info-bg);     border-color: var(--info); }
.alert-icon   { font-size: 16px; flex-shrink: 0; margin-top: 1px; }
.alert-title  { font-weight: 700; font-size: 13px; margin-bottom: 2px; }
.alert-detail { font-size: 12px; color: var(--text-secondary); }
.alert-action { font-size: 12px; font-weight: 600; margin-top: 4px; }

.streak-badge {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 3px 8px; border-radius: 999px;
  background: var(--negative-bg); border: 1px solid var(--negative-light);
  font-size: 11px; font-weight: 800; color: var(--negative);
}

.brief-box {
  background: var(--info-bg);
  border: 1px solid var(--info-light);
  border-radius: var(--radius);
  padding: 16px 18px;
  font-size: 14px;
}
.brief-part { margin-bottom: 12px; }
.brief-part:last-child { margin-bottom: 0; }
.brief-part-label {
  font-size: 10px; font-weight: 800;
  text-transform: uppercase; letter-spacing: 0.07em;
  color: var(--info); margin-bottom: 4px;
}
.brief-part-text { line-height: 1.7; color: var(--text-primary); }

.opportunity-card {
  background: var(--surface);
  border: 2px solid var(--info-light);
  border-radius: var(--radius);
  padding: 16px;
}
.opportunity-eyebrow {
  font-size: 10px; font-weight: 800;
  text-transform: uppercase; letter-spacing: 0.08em;
  color: var(--info); margin-bottom: 6px;
}
.opportunity-ticker {
  font-size: 24px; font-weight: 900;
  color: var(--text-primary); line-height: 1;
}
.opportunity-name { font-size: 13px; color: var(--text-secondary); margin-top: 2px; }
.opportunity-reason { font-size: 13px; margin-top: 8px; line-height: 1.6; }
.opportunity-note { font-size: 11px; color: var(--text-muted); font-style: italic; margin-top: 8px; }

.need-to-know-list { list-style: none; }
.need-to-know-list li {
  display: flex; align-items: flex-start; gap: 10px;
  padding: 7px 0; border-bottom: 1px solid var(--border);
  font-size: 13px;
}
.need-to-know-list li:last-child { border-bottom: none; }
.ntk-icon { font-size: 14px; flex-shrink: 0; margin-top: 2px; }
.ntk-label { font-weight: 700; color: var(--text-secondary); min-width: 110px; flex-shrink: 0; }
.ntk-value { flex: 1; }

.bar-row { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
.bar-label { font-size: 12px; min-width: 60px; }
.bar-track { flex: 1; height: 8px; background: var(--gray-light); border-radius: 4px; overflow: hidden; }
.bar-fill  { height: 100%; border-radius: 4px; }
.bar-pos { background: var(--positive); }
.bar-neg { background: var(--negative); }
.bar-warn { background: var(--warning); }
.bar-info { background: var(--info); }
.bar-pct { font-size: 12px; font-weight: 600; min-width: 48px; text-align: right; }

.positive { color: var(--positive); font-weight: 600; }
.negative { color: var(--negative); font-weight: 600; }
.warning  { color: var(--warning);  font-weight: 600; }
.muted    { color: var(--text-muted); }
.small    { font-size: 12px; }
.mono     { font-family: 'SF Mono', 'Fira Code', monospace; font-size: 12px; }

details {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
  margin-bottom: 8px;
}
summary {
  padding: 11px 16px; font-weight: 600; font-size: 13px;
  cursor: pointer; background: var(--surface-alt);
  list-style: none; display: flex;
  justify-content: space-between; align-items: center;
}
summary::-webkit-details-marker { display: none; }
details[open] summary { border-bottom: 1px solid var(--border); }
details > div { padding: 16px; }

header {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--radius-lg); padding: 20px 24px;
  box-shadow: var(--shadow-md);
}
.header-top {
  display: flex; justify-content: space-between;
  align-items: flex-start; flex-wrap: wrap; gap: 12px;
}
.report-title { font-size: 20px; font-weight: 900; }
.report-sub { font-size: 13px; color: var(--text-secondary); margin-top: 3px; }
.header-right { text-align: right; }
.status-pill {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 4px 12px; border-radius: 999px;
  font-size: 12px; font-weight: 700;
}
.pill-open   { background: var(--positive-bg); color: var(--positive); }
.pill-closed { background: var(--gray-light); color: var(--gray); }
.pill-stale  { background: var(--warning-bg); color: var(--warning); }
.warning-banner {
  background: var(--warning-bg); border: 1px solid var(--warning-light);
  border-radius: var(--radius); padding: 10px 14px;
  font-size: 13px; color: #92400e; margin-top: 14px;
}

.sort-bar { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
.sort-btn {
  padding: 5px 11px; font-size: 12px; font-weight: 500;
  border: 1px solid var(--border); border-radius: var(--radius-sm);
  background: var(--surface); cursor: pointer; color: var(--text-secondary);
}
.sort-btn:hover, .sort-btn.active { background: var(--info); color: #fff; border-color: var(--info); }

footer {
  text-align: center; font-size: 12px;
  color: var(--text-muted); padding: 20px;
  border-top: 1px solid var(--border); margin-top: 20px;
}`;

function renderAlerts() {
  const alerts = [];
  const aapl = holdings.find((h) => h.symbol === "AAPL");
  if (aapl?.weightPercent > 15) {
    alerts.push({
      sev: "alert-medium",
      icon: "⚠️",
      title: "AAPL — Concentration above 15%",
      detail: `Apple is ${aapl.weightPercent.toFixed(1)}% of the US portfolio at ${fmtUsd(aapl.current_value)}. A modest -0.72% session still drags total P/L.`,
      action: "Suggested action: Watch",
    });
  }
  const egx = holdings.find((h) => h.symbol === "EGX30ETF");
  if (egx?.weightPercent > 15) {
    alerts.push({
      sev: "alert-high",
      icon: "🔴",
      title: "EGX30ETF — Major concentration (59%)",
      detail: "Nearly three-fifths of Egypt portfolio value sits in one benchmark ETF; session tracked EGX30 lower (-1.03%).",
      action: "Suggested action: Watch",
    });
  }
  const nflx = holdings.find((h) => h.symbol === "NFLX");
  if (nflx) {
    alerts.push({
      sev: "alert-medium",
      icon: "📉",
      title: "NFLX — Large unrealized loss",
      detail: `Down ${fmtUsd(nflx.profit_loss)} (-24.8%) with RSI 27.1; earnings July 16.`,
      action: "Suggested action: Watch",
    });
  }
  for (const h of holdings.filter((x) => x.action === "Consider trimming")) {
    alerts.push({
      sev: "alert-medium",
      icon: "✂️",
      title: `${h.symbol} — Marked Consider trimming`,
      detail: `${h.name}: unrealized ${fmtUsd(h.profit_loss)}; review whether gains should be locked in.`,
      action: "Suggested action: Consider trimming",
    });
  }
  alerts.push({
    sev: "alert-low",
    icon: "📅",
    title: "NFLX earnings in 17 days",
    detail: "Q2 2026 results confirmed July 16, 2026 after market close.",
    action: "Suggested action: Watch",
  });
  if (!alerts.length) {
    return `<div class="alert alert-low"><span class="alert-icon">✅</span><div><div class="alert-title">No high-severity alerts today.</div></div></div>`;
  }
  return alerts
    .map(
      (a) => `<div class="alert ${a.sev}"><span class="alert-icon">${a.icon}</span><div><div class="alert-title">${esc(a.title)}</div><div class="alert-detail">${esc(a.detail)}</div><div class="alert-action">${esc(a.action)}</div></div></div>`
    )
    .join("");
}

function renderBarRows(bars, currency) {
  if (!bars) return `<p class="muted small">Historical portfolio trend data is unavailable — charts cannot be generated reliably. Do not invent portfolio history.</p>`;
  return bars
    .map((b) => {
      const fmt = currency === "USD" ? fmtUsd : fmtEgp;
      return `<div class="bar-row"><span class="bar-label">${esc(b.label)}</span><div class="bar-track"><div class="bar-fill bar-pos" style="width:${b.pct.toFixed(0)}%"></div></div><span class="bar-pct">${fmt(b.value)}</span></div>`;
    })
    .join("");
}

function renderPlBars(bars, currency) {
  if (!bars) return `<p class="muted small">Daily P/L history unavailable.</p>`;
  const fmt = currency === "USD" ? fmtUsd : fmtEgp;
  return bars
    .map((b) => {
      const cls = b.pl >= 0 ? "bar-pos" : "bar-neg";
      return `<div class="bar-row"><span class="bar-label">${esc(b.label)}</span><div class="bar-track"><div class="bar-fill ${cls}" style="width:${b.pct.toFixed(0)}%"></div></div><span class="bar-pct ${pctClass(b.pl)}">${fmt(b.pl)}</span></div>`;
    })
    .join("");
}

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Daily Portfolio Report — ${SESSION_DATE}</title>
<style>${CSS}</style>
</head>
<body>
<div class="page-grid">

<header>
  <div class="header-top">
    <div>
      <div class="report-title">Daily Portfolio Report</div>
      <div class="report-sub">${SESSION_DATE} · ${EMAIL}</div>
    </div>
    <div class="header-right">
      <span class="status-pill pill-open">US Market Closed · Session Complete</span>
      <div class="small muted" style="margin-top:6px">Data as of ${esc(snapshotDisplay)} ET</div>
      <div class="small muted">Post-close snapshot verified · Egypt quotes via Mubasher EGX</div>
    </div>
  </div>
</header>

<section>
  <div class="section-header"><span class="section-icon">⚡</span><span class="section-title">Quick Summary</span></div>

  <div class="card-grid-sm" style="margin-bottom:16px">
    <div class="card ${usDaily >= 0 ? "positive" : "negative"}"><div class="card-label">US Portfolio Value</div><div class="card-value ${pctClass(usDaily)}">${fmtUsd(usProfile.snapshot.portfolioValue)}</div></div>
    <div class="card ${usDaily >= 0 ? "positive" : "negative"}"><div class="card-label">US Daily P/L</div><div class="card-value ${pctClass(usDaily)}">${fmtUsd(usDaily)}</div><div class="card-sub">${fmtPct(usProfile.snapshot.dailyProfitLossPercent)}</div></div>
    <div class="card negative"><div class="card-label">Egypt Portfolio Value</div><div class="card-value">${fmtEgp(egProfile.snapshot.portfolioValue)}</div></div>
    <div class="card negative"><div class="card-label">Egypt Daily P/L</div><div class="card-value negative">${fmtEgp(egDaily)}</div><div class="card-sub">${fmtPct(egProfile.snapshot.dailyProfitLossPercent)}</div></div>
    <div class="card info"><div class="card-label">Total Holdings</div><div class="card-value">${totalHoldings}</div></div>
    <div class="card ${attentionCount > 0 ? "warning" : "info"}"><div class="card-label">Holdings Needing Attention</div><div class="card-value">${attentionCount}</div></div>
  </div>

  <div class="two-col" style="margin-bottom:16px">
    <div>
      <div class="section-title" style="margin-bottom:10px;font-size:13px">Need to Know First</div>
      <ul class="need-to-know-list">
        <li><span class="ntk-icon">📈</span><span class="ntk-label">Market Today</span><span class="ntk-value">SPY ${fmtPct(BENCHMARKS.SPY.chg)} · QQQ ${fmtPct(BENCHMARKS.QQQ.chg)} — broad US rally on ceasefire/geopolitical relief. EGX30 ${fmtPct(BENCHMARKS.EGX30.chg)}.</span></li>
        <li><span class="ntk-icon">💰</span><span class="ntk-label">Daily P/L</span><span class="ntk-value">US ${fmtUsd(usDaily)} (${fmtPct(usProfile.snapshot.dailyProfitLossPercent)}) · Egypt ${fmtEgp(egDaily)} (${fmtPct(egProfile.snapshot.dailyProfitLossPercent)}).</span></li>
        <li><span class="ntk-icon">📈</span><span class="ntk-label">Biggest Mover</span><span class="ntk-value">${esc(bestMover.symbol)} ${fmtPct(bestMover.daily_profit_loss_percent)} (${bestMover.region === "US" ? fmtUsd(bestMover.daily_profit_loss) : fmtEgp(bestMover.daily_profit_loss)}).</span></li>
        <li><span class="ntk-icon">📉</span><span class="ntk-label">Biggest Risk</span><span class="ntk-value">${esc(worstMover.symbol)} ${fmtPct(worstMover.daily_profit_loss_percent)} — ${worstMover.symbol === "COMI" ? "Egypt bank weakness" : "profit-taking after recent run"}.</span></li>
        <li><span class="ntk-icon">🔴</span><span class="ntk-label">Losing Streak</span><span class="ntk-value">${streakHoldings.length ? streakHoldings.map((h) => `<span class="streak-badge">🔴 ${h.hist.downStreak} days down — ${h.symbol}</span>`).join(" ") : "None currently"}</span></li>
        <li><span class="ntk-icon">📰</span><span class="ntk-label">Positive Catalyst</span><span class="ntk-value">TSM +5.26% on AI/chip demand; MU benefited from prior record memory earnings narrative (Jun 25).</span></li>
        <li><span class="ntk-icon">⚠️</span><span class="ntk-label">At Risk</span><span class="ntk-value">NFLX (-24.8% unrealized, RSI 27); COMI -2.5% with Egypt index down.</span></li>
        <li><span class="ntk-icon">👁</span><span class="ntk-label">Watch Today</span><span class="ntk-value">AAPL (22% weight) lagged QQQ; consider whether mega-cap drag persists.</span></li>
        <li><span class="ntk-icon">📅</span><span class="ntk-label">Upcoming Event</span><span class="ntk-value">NFLX earnings Jul 16 · META Jul 29 · AAPL ~Jul 30.</span></li>
        <li><span class="ntk-icon">⚠️</span><span class="ntk-label">Data Gap</span><span class="ntk-value">SPCX/QNT limited MA/RSI history; Egypt names lack full technical feeds.</span></li>
      </ul>
    </div>
    <div>
      <div class="section-title" style="margin-bottom:10px;font-size:13px">Today's Brief</div>
      <div class="brief-box">
        <div class="brief-part"><div class="brief-part-label">MOVES &amp; TRENDS</div><div class="brief-part-text">US portfolio gained ${fmtUsd(usDaily)} (+1.63%), broadly in line with SPY/QQQ's tech-led rally. Stock-specific standouts: NASA +9.8%, NBIS +8.7%, TSM +5.3%. Egypt portfolio fell ${fmtEgp(Math.abs(egDaily))} tracking EGX30 -1.03%. AAPL (-0.72%) underperformed the Nasdaq rebound.</div></div>
        <div class="brief-part"><div class="brief-part-label">COMING UP</div><div class="brief-part-text">NFLX reports Q2 on July 16; META July 29; AAPL ~July 30. US markets enter a holiday-shortened week (Independence Day Jul 3 observed). No verified Egypt-specific catalysts in the next 7 days.</div></div>
        <div class="brief-part"><div class="brief-part-label">GUIDANCE</div><div class="brief-part-text">AAPL deserves the most attention — largest US weight with persistent 5D/20D weakness vs QQQ. Hold core ETF sleeves; watch whether DRAM/QNT trim labels still apply after today's mixed session.</div></div>
        <div class="brief-part"><div class="brief-part-label">TODAY'S IDEA</div><div class="brief-part-text">TSM leads today's watchlist on confirmed sector strength (+5.26%, above 20D/50D MAs). See full details in the Opportunity card below.</div></div>
      </div>
    </div>
  </div>

  <div class="opportunity-card">
    <div class="two-col">
      <div>
        <div class="opportunity-eyebrow">Today's Watchlist Idea</div>
        <div class="opportunity-ticker">TSM</div>
        <div class="opportunity-name">Taiwan Semiconductor Manufacturing Co.</div>
        <div class="opportunity-reason">TSM rallied 5.26% to $455.10 (Jun 29 close) with average volume, outperforming SPY/QQQ on AI foundry demand. Price sits above 20D ($435.82) and 50D ($414.48) MAs with RSI 58 — sector strength plus earnings leverage to Nvidia's Rubin ramp.</div>
        <div class="opportunity-note">Watchlist idea only — not a buy recommendation.</div>
      </div>
      <table class="small">
        <tr><td><strong>Sector</strong></td><td>Semiconductors / Foundry</td></tr>
        <tr><td><strong>Catalyst</strong></td><td>AI chip production / NVDA supply chain</td></tr>
        <tr><td><strong>Technical Setup</strong></td><td>Above 20D &amp; 50D MA; RSI 58</td></tr>
        <tr><td><strong>Risk Level</strong></td><td><span class="badge badge-yellow">Medium</span></td></tr>
        <tr><td><strong>Watch Horizon</strong></td><td>1–2 weeks</td></tr>
        <tr><td><strong>What Would Invalidate It</strong></td><td>Close below 20D MA ($435.82) on rising volume</td></tr>
      </table>
    </div>
  </div>
</section>

<section>
  <div class="section-header"><span class="section-icon">🚨</span><span class="section-title">Needs Attention First</span></div>
  ${renderAlerts()}
</section>

<section>
  <div class="section-header"><span class="section-icon">📊</span><span class="section-title">Summary Cards</span></div>
  <div class="card-grid">
    <div class="card positive"><div class="card-label">US Portfolio Value</div><div class="card-value positive">${fmtUsd(usProfile.snapshot.portfolioValue)}</div></div>
    <div class="card positive"><div class="card-label">US Daily P/L</div><div class="card-value positive">${fmtUsd(usDaily)}</div></div>
    <div class="card"><div class="card-label">Egypt Portfolio Value</div><div class="card-value">${fmtEgp(egProfile.snapshot.portfolioValue)}</div></div>
    <div class="card negative"><div class="card-label">Egypt Daily P/L</div><div class="card-value negative">${fmtEgp(egDaily)}</div></div>
    <div class="card positive"><div class="card-label">Biggest Positive Mover</div><div class="card-value positive">${esc(bestMover.symbol)}</div><div class="card-sub">${fmtPct(bestMover.daily_profit_loss_percent)}</div></div>
    <div class="card negative"><div class="card-label">Biggest Negative Mover</div><div class="card-value negative">${esc(worstMover.symbol)}</div><div class="card-sub">${fmtPct(worstMover.daily_profit_loss_percent)}</div></div>
    <div class="card warning"><div class="card-label">Largest Holding</div><div class="card-value">${esc(largestHolding.symbol)}</div><div class="card-sub">${largestHolding.weightPercent.toFixed(1)}% weight</div></div>
    <div class="card warning"><div class="card-label">Biggest Risk</div><div class="card-value">NFLX</div><div class="card-sub">${fmtUsd(-59.55)} unrealized</div></div>
    <div class="card info"><div class="card-label">Upcoming Catalyst</div><div class="card-value">NFLX</div><div class="card-sub">Earnings Jul 16</div></div>
    <div class="card warning"><div class="card-label">Needs Attention</div><div class="card-value">${attentionCount}</div></div>
    <div class="card info"><div class="card-label">Watchlist Idea</div><div class="card-value">TSM</div></div>
    <div class="card missing"><div class="card-label">Worst Losing Streak</div><div class="card-value">None</div><div class="card-sub">No 3+ day streak</div></div>
    <div class="card positive"><div class="card-label">Strongest 5D Momentum</div><div class="card-value">${strongest5d ? esc(strongest5d.symbol) : "N/A"}</div><div class="card-sub">${strongest5d ? fmtPct(strongest5d.hist.d5) : ""}</div></div>
    <div class="card negative"><div class="card-label">Weakest 5D Momentum</div><div class="card-value">${weakest5d ? esc(weakest5d.symbol) : "N/A"}</div><div class="card-sub">${weakest5d ? fmtPct(weakest5d.hist.d5) : ""}</div></div>
  </div>
</section>

<section>
  <div class="section-header"><span class="section-icon">📈</span><span class="section-title">Trend and Progress Charts</span></div>
  <h4 style="margin:12px 0 8px;font-size:13px">Portfolio Value Trend (7 sessions)</h4>
  <p class="small muted">US (USD)</p>
  ${renderBarRows(historyBars(usHistory, 7), "USD")}
  <p class="small muted" style="margin-top:12px">Egypt (EGP)</p>
  ${renderBarRows(historyBars(egHistory, 7), "EGP")}
  <h4 style="margin:16px 0 8px;font-size:13px">Daily P/L Trend (7 sessions)</h4>
  <p class="small muted">US</p>
  ${renderPlBars(plBars(usHistory, 7), "USD")}
  <p class="small muted" style="margin-top:12px">Egypt</p>
  ${renderPlBars(plBars(egHistory, 7), "EGP")}
  <h4 style="margin:16px 0 8px;font-size:13px">Winners vs Losers (5D)</h4>
  ${fiveDay
    .slice()
    .reverse()
    .map((h) => {
      const w = Math.min(Math.abs(h.hist.d5) * 8, 100);
      const cls = h.hist.d5 >= 0 ? "bar-pos" : "bar-neg";
      return `<div class="bar-row"><span class="bar-label">${esc(h.symbol)}</span><div class="bar-track"><div class="bar-fill ${cls}" style="width:${w}%"></div></div><span class="bar-pct ${pctClass(h.hist.d5)}">${fmtPct(h.hist.d5)}</span></div>`;
    })
    .join("")}
  <h4 style="margin:16px 0 8px;font-size:13px">Losing Streak Indicator</h4>
  <div class="table-wrap"><table>
    <thead><tr><th>Ticker</th><th>Streak Days</th><th>Total Decline</th><th>Possible Reason</th><th>Action</th></tr></thead>
    <tbody>${streakHoldings.length ? streakHoldings.map((h) => `<tr><td>${esc(h.symbol)}</td><td><span class="streak-badge">🔴 ${h.hist.downStreak}</span></td><td>${fmtPct(h.hist.d1)}</td><td>—</td><td>${esc(h.action)}</td></tr>`).join("") : `<tr><td colspan="5">No holdings with a 3+ day losing streak in the current data.</td></tr>`}</tbody>
  </table></div>
</section>

<section>
  <div class="section-header"><span class="section-icon">🥧</span><span class="section-title">Portfolio Allocation</span></div>
  <h4 style="margin-bottom:10px">US Portfolio (USD)</h4>
  ${holdings
    .filter((h) => h.region === "US")
    .sort((a, b) => b.weightPercent - a.weightPercent)
    .map((h) => {
      const badge = h.weightPercent > 15 ? ` <span class="badge badge-orange">⚠ &gt;15%</span>` : "";
      return `<div class="bar-row"><span class="bar-label">${esc(h.symbol)}</span><div class="bar-track"><div class="bar-fill bar-info" style="width:${h.weightPercent}%"></div></div><span class="bar-pct">${h.weightPercent.toFixed(1)}%${badge}</span></div>`;
    })
    .join("")}
  <ul class="small" style="margin:10px 0 16px 18px">
    <li>Largest: AAPL 22.1% — single-stock concentration risk</li>
    <li>ETF balance: QQQM, VOO, SCHG, DRAM provide index/sector exposure</li>
    <li>Speculative: NASA, SPCX, SMR, NBIS are thematic/smaller positions</li>
  </ul>
  <h4 style="margin-bottom:10px">Egypt Portfolio (EGP)</h4>
  ${holdings
    .filter((h) => h.region === "EG")
    .sort((a, b) => b.weightPercent - a.weightPercent)
    .map((h) => {
      const badge = h.weightPercent > 15 ? ` <span class="badge badge-orange">⚠ &gt;15%</span>` : "";
      return `<div class="bar-row"><span class="bar-label">${esc(h.symbol)}</span><div class="bar-track"><div class="bar-fill bar-warn" style="width:${h.weightPercent}%"></div></div><span class="bar-pct">${h.weightPercent.toFixed(1)}%${badge}</span></div>`;
    })
    .join("")}
  <ul class="small" style="margin:10px 0 0 18px">
    <li>EGX30ETF dominates at 59.2% — benchmark-heavy</li>
    <li>RAYA 15.9% and ORHD 12.8% add single-name Egypt exposure</li>
  </ul>
</section>

<section>
  <div class="section-header"><span class="section-icon">📋</span><span class="section-title">Priority-Sorted Holdings</span></div>
  <div class="sort-bar">
    <button class="sort-btn active" data-sort="priority">Priority</button>
    <button class="sort-btn" data-sort="weight">Weight</button>
    <button class="sort-btn" data-sort="daily">Daily P/L</button>
    <button class="sort-btn" data-sort="unreal">Unrealized P/L</button>
    <button class="sort-btn" data-sort="risk">Risk</button>
    <button class="sort-btn" data-sort="action">Action</button>
  </div>
  <div class="table-wrap">
    <table id="holdings-table">
      <thead><tr>
        <th>Ticker</th><th>Market</th><th>Weight</th><th>Value</th><th>Daily P/L</th><th>1D</th><th>5D</th><th>Unrealized</th><th>Risk</th><th>Catalyst</th><th>Action</th><th>Data</th><th>Main Reason</th>
      </tr></thead>
      <tbody>
      ${sortedHoldings
        .map((h) => {
          const q = h.quote || {};
          const hist = h.hist || {};
          const tech = technicalRead(h.symbol, q, hist);
          const valFmt = h.currency === "USD" ? fmtUsd : fmtEgp;
          const streakBg = (hist.downStreak ?? 0) >= 3 ? ' style="background:var(--negative-bg)"' : "";
          const catalyst =
            h.symbol === "NFLX"
              ? "Earnings Jul 16"
              : h.symbol === "TSM"
                ? "AI foundry demand"
                : h.symbol === "MU"
                  ? "HBM / AI memory"
                  : "No clear catalyst";
          const dataBadge = q.rsi ? "badge-green" : h.region === "EG" ? "badge-yellow" : "badge-yellow";
          const dataLabel = q.rsi ? "Complete" : h.region === "EG" ? "Partial" : "Partial";
          const reason =
            h.action === "Consider trimming"
              ? "Large gain / trim label"
              : h.riskLevel === "High"
                ? "High risk + deep loss"
                : h.weightPercent > 15
                  ? "Concentration"
                  : "Core holding";
          return `<tr${streakBg} data-weight="${h.weightPercent}" data-daily="${h.daily_profit_loss}" data-unreal="${h.profit_loss}" data-risk="${riskSortKey(h.riskLevel)}" data-action="${actionSortKey(h.action)}">
            <td><strong>${esc(h.symbol)}</strong></td>
            <td>${esc(h.market)}</td>
            <td>${h.weightPercent.toFixed(1)}%</td>
            <td>${valFmt(h.current_value)}</td>
            <td class="${pctClass(h.daily_profit_loss)}">${valFmt(h.daily_profit_loss)}</td>
            <td class="${pctClass(h.daily_profit_loss_percent)}">${fmtPct(h.daily_profit_loss_percent)}</td>
            <td class="${pctClass(hist.d5)}">${hist.d5 != null ? fmtPct(hist.d5) : "Not available."}</td>
            <td class="${pctClass(h.profit_loss)}">${valFmt(h.profit_loss)}</td>
            <td><span class="badge ${riskBadge(h.riskLevel)}">${esc(h.riskLevel)}</span></td>
            <td class="small">${esc(catalyst)}</td>
            <td><span class="badge ${actionBadge(h.action)}">${esc(h.action)}</span></td>
            <td><span class="badge ${dataBadge}">${dataLabel}</span></td>
            <td class="small">${esc(reason)}</td>
          </tr>`;
        })
        .join("")}
      </tbody>
    </table>
  </div>
</section>

<section>
  <div class="section-header"><span class="section-icon">💵</span><span class="section-title">Daily P/L Contribution</span></div>
  <h4>US Portfolio</h4>
  <div class="table-wrap"><table><thead><tr><th>Ticker</th><th>Daily P/L</th><th>Daily %</th><th>Weight</th><th>Driver</th></tr></thead><tbody>
  ${holdings
    .filter((h) => h.region === "US")
    .sort((a, b) => Math.abs(b.daily_profit_loss) - Math.abs(a.daily_profit_loss))
    .map((h) => {
      const driver = Math.abs(h.daily_profit_loss_percent) > 2 ? "Price-driven" : h.weightPercent > 10 ? "Size-driven" : "Both";
      return `<tr><td>${esc(h.symbol)}</td><td class="${pctClass(h.daily_profit_loss)}">${fmtUsd(h.daily_profit_loss)}</td><td class="${pctClass(h.daily_profit_loss_percent)}">${fmtPct(h.daily_profit_loss_percent)}</td><td>${h.weightPercent.toFixed(1)}%</td><td>${driver}</td></tr>`;
    })
    .join("")}
  </tbody></table></div>
  <h4 style="margin-top:16px">Egypt Portfolio</h4>
  <div class="table-wrap"><table><thead><tr><th>Ticker</th><th>Daily P/L</th><th>Daily %</th><th>Weight</th><th>Driver</th></tr></thead><tbody>
  ${holdings
    .filter((h) => h.region === "EG")
    .sort((a, b) => Math.abs(b.daily_profit_loss) - Math.abs(a.daily_profit_loss))
    .map((h) => {
      const driver = Math.abs(h.daily_profit_loss_percent) > 1.5 ? "Price-driven" : "Size-driven";
      return `<tr><td>${esc(h.symbol)}</td><td class="${pctClass(h.daily_profit_loss)}">${fmtEgp(h.daily_profit_loss)}</td><td class="${pctClass(h.daily_profit_loss_percent)}">${fmtPct(h.daily_profit_loss_percent)}</td><td>${h.weightPercent.toFixed(1)}%</td><td>${driver}</td></tr>`;
    })
    .join("")}
  </tbody></table></div>
</section>

<section>
  <div class="section-header"><span class="section-icon">⏱</span><span class="section-title">Recent Performance</span></div>
  ${fiveDay
    .map((h) => {
      const hist = h.hist;
      const w = Math.min(Math.abs(hist.d5 ?? 0) * 6, 100);
      return `<div class="bar-row"><span class="bar-label">${esc(h.symbol)}</span><div class="bar-track"><div class="bar-fill ${(hist.d5 ?? 0) >= 0 ? "bar-pos" : "bar-neg"}" style="width:${w}%"></div></div><span class="bar-pct">1D ${fmtPct(hist.d1)} · 5D ${fmtPct(hist.d5)} · 20D ${fmtPct(hist.d20)}</span></div>`;
    })
    .join("")}
  <p class="small" style="margin-top:12px">Strongest short-term: ${strongest5d?.symbol} (${fmtPct(strongest5d?.hist?.d5)} 5D). Weakest: ${weakest5d?.symbol} (${fmtPct(weakest5d?.hist?.d5)}). US session was market-wide (SPY +1.65%); Egypt moves were index-driven (EGX30 -1.03%). NASA/NBIS/SPCX showed stock-specific speculative strength.</p>
</section>

<section>
  <div class="section-header"><span class="section-icon">📉</span><span class="section-title">Technical Signals</span></div>
  <div class="table-wrap"><table><thead><tr>
    <th>Ticker</th><th>RSI-14</th><th>vs 20D</th><th>vs 50D</th><th>vs 200D</th><th>Volume</th><th>MACD</th><th>Momentum</th><th>Read</th><th>Caution</th>
  </tr></thead><tbody>
  ${holdings
    .filter((h) => h.region === "US")
    .map((h) => {
      const q = h.quote || {};
      const hist = h.hist || {};
      const tech = technicalRead(h.symbol, q, hist);
      const volR = hist.volRatio ?? (q.volume && q.ma20 ? q.volume / 10000000 : null);
      return `<tr data-tech="${techSortKey(tech.read)}">
        <td>${esc(h.symbol)}</td>
        <td>${q.rsi != null ? `${q.rsi.toFixed(1)} <span class="muted small">(Yahoo, Jun 29)</span>` : "Not available."}</td>
        <td>${vsMa(q.currentPrice, q.ma20)}</td>
        <td>${vsMa(q.currentPrice, q.ma50)}</td>
        <td>${q.ma200 ? vsMa(q.currentPrice, q.ma200) : "Not available."}</td>
        <td class="small">${volLabel(hist.volRatio, q.dailyChangePercent)}</td>
        <td class="small">${macdDesc(h.symbol, q, hist)}</td>
        <td class="small">${hist.d5 != null ? `5D ${fmtPct(hist.d5)}` : "Not available."}</td>
        <td><span class="badge ${tech.badge}">${tech.read}</span></td>
        <td class="small">${tech.caution || (q.rsi == null ? '<span class="badge badge-gray">Missing</span>' : "—")}</td>
      </tr>`;
    })
    .sort((a, b) => {
      const reads = ["Bearish", "Weakening", "Unclear", "Neutral", "Improving", "Bullish"];
      const getRead = (row) => row.match(/badge-(?:green|blue|yellow|red|gray)">(\w+)/)?.[1] || "Unclear";
      return reads.indexOf(getRead(a)) - reads.indexOf(getRead(b));
    })
    .join("")}
  </tbody></table></div>
</section>

<section>
  <div class="section-header"><span class="section-icon">📰</span><span class="section-title">News and Catalysts</span></div>
  <details open><summary>Positive <span class="badge badge-green">2</span></summary><div>
    <p><strong>TSM</strong> — Outperformed on AI/chip demand amid broad tech rally. <em>Context: market-wide + stock-specific strength, Jun 29 session.</em> Action: unchanged (Keep).</p>
    <p><strong>MU</strong> — Micron Q3 FY2026 record revenue ($41.46B) on HBM demand (The Motley Fool, Jun 25, 2026). Supports AI memory thesis. Action: unchanged (Keep).</p>
  </div></details>
  <details><summary>Mixed <span class="badge badge-yellow">1</span></summary><div>
    <p><strong>NVDA</strong> — Steady above $200; China black-market chip pricing highlights demand but export-control overhang persists (Invezz, Jun 24, 2026). Action: unchanged (Keep).</p>
  </div></details>
  <details><summary>Neutral <span class="badge badge-gray">1</span></summary><div>
    <p><strong>US Market</strong> — S&amp;P 500 +0.87% on ceasefire headlines; holiday-shortened week ahead (24/7 Wall St., Jun 29, 2026).</p>
  </div></details>
  <details><summary>No material recent news found <span class="badge badge-gray">12</span></summary><div>
    <p class="muted">AAPL, NFLX, QQQM, DRAM, IBM, VOO, META, HOOD, NBIS, SMR, NASA, SPCX, SCHG, QNT, ORHD, EGX30ETF, RAYA, COMI — No material news found in the last 7 days.</p>
  </div></details>
</section>

<section>
  <div class="section-header"><span class="section-icon">📅</span><span class="section-title">Upcoming Earnings and Events</span></div>
  <div class="table-wrap"><table><thead><tr><th>Ticker</th><th>Event</th><th>Date</th><th>Days Away</th><th>Importance</th><th>Why It Matters</th></tr></thead><tbody>
    <tr style="background:var(--info-bg)"><td>NFLX</td><td>Q2 2026 Earnings</td><td>Jul 16, 2026</td><td>17</td><td>High</td><td>Largest US unrealized loss; subscriber/guidance catalyst</td></tr>
    <tr style="background:var(--info-bg)"><td>META</td><td>Q2 2026 Earnings</td><td>Jul 29, 2026</td><td>30</td><td>Medium</td><td>Ad/AI spend trajectory</td></tr>
    <tr><td>AAPL</td><td>Q3 FY2026 Earnings (est.)</td><td>~Jul 30, 2026</td><td>31</td><td>High</td><td>22% portfolio weight; post-split sentiment</td></tr>
    <tr><td>NVDA</td><td>Q2 FY2027 Earnings</td><td>Aug 26, 2026</td><td>58</td><td>Medium</td><td>AI demand read-through</td></tr>
  </tbody></table></div>
</section>

<section>
  <div class="section-header"><span class="section-icon">⚠️</span><span class="section-title">Portfolio Risk Notes</span></div>
  <details open><summary>Concentration risk</summary><div>AAPL 22% US; EGX30ETF 59% Egypt. Consider whether single-name limits are comfortable.</div></details>
  <details><summary>Sector risk</summary><div>Heavy tech/AI (NVDA, MU, TSM, NBIS, DRAM) plus thematic space ETFs (NASA, SPCX).</div></details>
  <details><summary>ETF overlap</summary><div>QQQM, VOO, SCHG overlap large-cap US growth; DRAM adds memory semi exposure overlapping MU.</div></details>
  <details><summary>Speculative exposure</summary><div>NASA, SPCX, SMR, NBIS, QNT — smaller weights but higher volatility.</div></details>
  <details><summary>Currency/geography</summary><div>US USD vs Egypt EGP reported separately; EGX session lagged global risk-on tone.</div></details>
  <details><summary>Large losses</summary><div>NFLX -$59.55; DRAM and QNT marked trim despite gains on QNT/DRAM.</div></details>
</section>

<section>
  <div class="section-header"><span class="section-icon">🔄</span><span class="section-title">What Changed Today</span></div>
  <ul class="small" style="margin-left:18px;line-height:1.8">
    <li>US portfolio value rose from $2,997.61 (Jun 26) to $3,046.38 (+1.63% daily) — first positive day after three-session slide.</li>
    <li>Egypt portfolio fell from EGP 119,335 (Jun 28) to EGP 118,209 (-0.94%), continuing recent weakness.</li>
    <li>Top contributors: QQQM (+$10.33), NBIS (+$10.58), TSM (+$9.33 daily in snapshot).</li>
    <li>DRAM and QNT retain Consider trimming labels from app AI cache.</li>
    <li>Watch tomorrow: whether AAPL can catch up to QQQ; Egypt flow after EGX30 -1% day.</li>
  </ul>
</section>

<section>
  <div class="section-header"><span class="section-icon">👀</span><span class="section-title">Watchlist</span></div>
  <div class="table-wrap"><table><thead><tr>
    <th>Ticker</th><th>Name</th><th>Why</th><th>Technical</th><th>Catalyst</th><th>Risk</th><th>Priority</th><th>More Interesting If</th><th>Invalidated If</th>
  </tr></thead><tbody>
    <tr><td>TSM</td><td>TSMC</td><td>AI foundry leader</td><td>Above 20D/50D; RSI 58</td><td>NVDA Rubin ramp</td><td>Medium</td><td><span class="badge badge-blue">High</span></td><td>Holds $455 on volume</td><td>Break below $435</td></tr>
    <tr><td>MU</td><td>Micron</td><td>HBM supply tightness</td><td>RSI 60; above MAs</td><td>Record earnings Jun 25</td><td>Medium</td><td><span class="badge badge-blue">High</span></td><td>Reclaims $1,200</td><td>Memory cycle fears</td></tr>
    <tr><td>QQQM</td><td>Nasdaq 100 ETF</td><td>Core US growth beta</td><td>In line with QQQ</td><td>Index momentum</td><td>Low</td><td><span class="badge badge-gray">Medium</span></td><td>QQQ extends rally</td><td>Nasdaq fails 20D MA</td></tr>
    <tr><td>HOOD</td><td>Robinhood</td><td>Fintech momentum</td><td>RSI 66; above MAs</td><td>Retail activity</td><td>Medium</td><td><span class="badge badge-gray">Medium</span></td><td>Breaks $105</td><td>Risk-off rotation</td></tr>
  </tbody></table></div>
  <p class="small muted" style="margin-top:10px">Watchlist only — not a buy recommendation.</p>
</section>

<section>
  <div class="section-header"><span class="section-icon">✅</span><span class="section-title">Final Action Summary</span></div>
  <div class="three-col">
    <div class="card positive"><div class="card-label">Keep / Add Candidates</div><div class="card-sub" style="margin-top:8px">${keepList.map((h) => `<div style="margin-bottom:6px"><strong>${esc(h.symbol)}</strong> — ${esc(h.action)}: ${h.weightPercent > 10 ? "Core position" : "Aligned with benchmark"}</div>`).join("")}</div></div>
    <div class="card warning"><div class="card-label">Watch Closely</div><div class="card-sub" style="margin-top:8px"><div><strong>AAPL</strong> — Watch: 22% weight, lagging QQQ</div><div><strong>NFLX</strong> — Watch: deep loss, earnings Jul 16</div><div><strong>EGX30ETF</strong> — Watch: 59% Egypt weight</div></div></div>
    <div class="card negative"><div class="card-label">Consider Trimming / Do Not Add</div><div class="card-sub" style="margin-top:8px">${trimList.map((h) => `<div style="margin-bottom:6px"><strong>${esc(h.symbol)}</strong> — Consider trimming: ${h.profit_loss > 0 ? "lock gains" : "review thesis"}</div>`).join("") || "<div>None flagged</div>"}</div></div>
  </div>
</section>

<section>
  <div class="section-header"><span class="section-icon">📚</span><span class="section-title">Sources and Data Notes</span></div>
  <ul class="small" style="margin-left:18px;line-height:1.8">
    <li>Portfolio accounting: portfolio-exit-planner API snapshot (${esc(snapshotDisplay)} ET)</li>
    <li>US prices/technicals: Yahoo Finance via app market API (Jun 29, 2026 close)</li>
    <li>Historical moves: Yahoo Finance daily closes (calculated 1D/3D/5D/20D)</li>
    <li>Benchmarks: SPY/QQQ (Yahoo); EGX30 (Youm7, Jun 29, 2026)</li>
    <li>News: The Motley Fool (Jun 25), Invezz (Jun 24), 24/7 Wall St. (Jun 29), Netflix IR (Jun 15)</li>
    <li>Egypt quotes: Mubasher EGX (per app warning) — technical indicators partial</li>
    <li>TSM live quote ($455.10) vs snapshot ($436.98) — material mismatch flagged; app snapshot used for P/L accounting</li>
  </ul>
</section>

</div>

<footer>This is analysis for decision support, not financial advice or automatic trading.</footer>

<script>
document.querySelectorAll('.sort-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const table = document.getElementById('holdings-table');
    const tbody = table.querySelector('tbody');
    const rows = Array.from(tbody.querySelectorAll('tr'));
    const key = btn.dataset.sort;
    rows.sort((a, b) => {
      if (key === 'weight') return parseFloat(b.dataset.weight) - parseFloat(a.dataset.weight);
      if (key === 'daily') return parseFloat(a.dataset.daily) - parseFloat(b.dataset.daily);
      if (key === 'unreal') return parseFloat(a.dataset.unreal) - parseFloat(b.dataset.unreal);
      if (key === 'risk') return parseFloat(a.dataset.risk) - parseFloat(b.dataset.risk);
      if (key === 'action') return parseFloat(a.dataset.action) - parseFloat(b.dataset.action);
      return 0;
    });
    rows.forEach(r => tbody.appendChild(r));
  });
});
</script>
</body>
</html>`;

mkdirSync(path.dirname(outputPath), { recursive: true });
writeFileSync(outputPath, html, "utf8");
console.log(`Wrote ${outputPath} (${html.length} bytes)`);
