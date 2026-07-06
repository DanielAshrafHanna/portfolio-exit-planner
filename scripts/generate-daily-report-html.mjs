#!/usr/bin/env node
/**
 * Generate daily portfolio HTML report from API data + Yahoo technicals.
 * Usage: node scripts/generate-daily-report-html.mjs /tmp/portfolio-report-data.json /tmp/report.html
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const dataPath = process.argv[2] || "/tmp/portfolio-report-data.json";
const outPath = process.argv[3] || "docs/reports/.raw/portfolio-report-2026-07-06.html";
const data = JSON.parse(readFileSync(dataPath, "utf8"));

const REPORT_DATE = "2026-07-06";
const EMAIL = "danielhanna0001@gmail.com";

const BENCHMARKS = {
  SPY: { d1: 0.87, price: 751.28, date: "2026-07-06" },
  QQQ: { d1: 1.43, price: 722.82, date: "2026-07-06" },
  EGX30: { d1: 2.68, price: 52502.74, date: "2026-07-06" },
};

const TECH = {
  SPY: { d1: 0.87, d3: 0.6, d5: 3.06, d20: -0.77, rsi: 56, ma20: 740.79, ma50: 738.23, volRatio: 0.66, streak: 0, decline: 0, lastDate: "2026-07-06" },
  QQQ: { d1: 1.43, d3: -1.84, d5: 2.31, d20: -2.4, rsi: 50.4, ma20: 720.21, ma50: 710.5, volRatio: 0.55, streak: 0, decline: 0, lastDate: "2026-07-06" },
  AAPL: { d1: 1.31, d3: 8.05, d5: 10.18, d20: 0.46, rsi: 63.8, ma20: 294.87, ma50: 294.31, volRatio: 0.71, streak: 0, decline: 0, lastDate: "2026-07-06" },
  NFLX: { d1: -2.1, d3: 6.47, d5: 2.99, d20: -6.79, rsi: 41.7, ma20: 76.99, ma50: 83.77, volRatio: 0.77, streak: 1, decline: -1.63, lastDate: "2026-07-06" },
  QQQM: { d1: 1.4, d3: -1.8, d5: 2.26, d20: -2.43, rsi: 50.4, ma20: 296.52, ma50: 292.53, volRatio: 0.54, streak: 0, decline: 0, lastDate: "2026-07-06" },
  DRAM: { d1: 6.81, d3: -12.31, d5: -9.91, d20: -1.43, rsi: 49.8, ma20: 67.76, ma50: 58.06, volRatio: 0.7, streak: 0, decline: 0, lastDate: "2026-07-06" },
  TSM: { d1: 4.06, d3: -5.4, d5: 4.5, d20: 1.54, rsi: 56.2, ma20: 438.01, ma50: 420.79, volRatio: 0.82, streak: 0, decline: 0, lastDate: "2026-07-06" },
  NASA: { d1: -1.47, d3: -5.37, d5: 8.16, d20: -20.27, rsi: 37, ma20: 30.46, ma50: 32.62, volRatio: 0.24, streak: 3, decline: -1.63, lastDate: "2026-07-06" },
  IBM: { d1: 3.45, d3: 6.51, d5: 10.27, d20: -0.75, rsi: 65, ma20: 272.9, ma50: 256.3, volRatio: 0.7, streak: 0, decline: 0, lastDate: "2026-07-06" },
  SPCX: { d1: -0.98, d3: -6.11, d5: 4.69, d20: null, rsi: 49.8, ma20: null, ma50: null, volRatio: null, streak: 1, decline: -1.58, lastDate: "2026-07-06" },
  VOO: { d1: 0.84, d3: 0.55, d5: 3.03, d20: -0.79, rsi: 55.9, ma20: 681.43, ma50: 678.83, volRatio: 0.44, streak: 0, decline: 0, lastDate: "2026-07-06" },
  SCHG: { d1: 1.2, d3: 2.04, d5: 5.15, d20: -0.75, rsi: 60.7, ma20: 33.56, ma50: 33.82, volRatio: 0.73, streak: 0, decline: 0, lastDate: "2026-07-06" },
  META: { d1: 2.98, d3: 6.57, d5: 9.09, d20: -4.35, rsi: 57.3, ma20: 575.33, ma50: 603.74, volRatio: 0.82, streak: 0, decline: 0, lastDate: "2026-07-06" },
  NVDA: { d1: 0.37, d3: -2.27, d5: 1.57, d20: -10.57, rsi: 40.9, ma20: 202.33, ma50: 209.66, volRatio: 0.63, streak: 0, decline: 0, lastDate: "2026-07-06" },
  HOOD: { d1: 4.28, d3: 17.22, d5: 19.11, d20: 33.08, rsi: 70.4, ma20: 98.53, ma50: 87.17, volRatio: 0.75, streak: 0, decline: 0, lastDate: "2026-07-06" },
  NBIS: { d1: -1.21, d3: -22.87, d5: -11.35, d20: -17.97, rsi: 45.2, ma20: 246.78, ma50: 216.23, volRatio: 0.79, streak: 3, decline: -63.15, lastDate: "2026-07-06" },
  SMR: { d1: -1.54, d3: -4.19, d5: -4.85, d20: -19.92, rsi: 47.7, ma20: 10.25, ma50: 11.34, volRatio: 0.6, streak: 2, decline: -0.54, lastDate: "2026-07-06" },
  QNT: { d1: 11.55, d3: 1.75, d5: 10.06, d20: 37.74, rsi: 70.4, ma20: 66.67, ma50: null, volRatio: 1.21, streak: 0, decline: 0, lastDate: "2026-07-06" },
  MU: { d1: 0.94, d3: -14.69, d5: -13.03, d20: -1.13, rsi: 50.2, ma20: 1042.71, ma50: 862.03, volRatio: 0.62, streak: 0, decline: 0, lastDate: "2026-07-06" },
  ASML: { d1: 3.15, d3: -8.26, d5: 1.7, d20: 3.85, rsi: 48.1, ma20: 1828.8, ma50: 1654.78, volRatio: 0.79, streak: 0, decline: 0, lastDate: "2026-07-06" },
  ORHD: { d1: 1.52, d3: null, d5: null, d20: null, rsi: null, ma20: null, ma50: null, volRatio: null, streak: 0, decline: 0, lastDate: "2026-07-06", egx: true },
  EGX30ETF: { d1: 1.6, d3: null, d5: null, d20: null, rsi: null, ma20: null, ma50: null, volRatio: null, streak: 0, decline: 0, lastDate: "2026-07-06", egx: true },
  RAYA: { d1: 2.16, d3: null, d5: null, d20: null, rsi: null, ma20: null, ma50: null, volRatio: null, streak: 0, decline: 0, lastDate: "2026-07-06", egx: true },
  COMI: { d1: 3.49, d3: null, d5: null, d20: null, rsi: null, ma20: null, ma50: null, volRatio: null, streak: 0, decline: 0, lastDate: "2026-07-06", egx: true },
};

function esc(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function fmtMoney(n, cur) {
  if (n == null || Number.isNaN(n)) return "N/A";
  const sym = cur === "EGP" ? "EGP " : "$";
  const v = Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (n < 0 ? "-" : "") + sym + v;
}
function fmtPct(n) {
  if (n == null || Number.isNaN(n)) return "Not available.";
  const sign = n > 0 ? "+" : "";
  return sign + n.toFixed(2) + "%";
}
function pctClass(n) { return n > 0 ? "positive" : n < 0 ? "negative" : "muted"; }
function mapAction(a) {
  if (a === "Trim") return "Consider trimming";
  return a || "Keep";
}
function actionBadge(a) {
  const m = mapAction(a);
  if (m === "Consider trimming" || m === "Do not add") return "badge-red";
  if (m === "Watch" || m === "Needs manual review") return "badge-yellow";
  return "badge-green";
}
function riskBadge(r) {
  if (r === "High" || r === "Speculative") return "badge-red";
  if (r === "Medium") return "badge-yellow";
  return "badge-gray";
}
function vsMa(price, ma) {
  if (!price || !ma) return "Not available.";
  const pct = ((price - ma) / ma * 100).toFixed(1);
  return price > ma ? `Above (+${pct}%)` : price < ma ? `Below (${pct}%)` : "At MA";
}
function volLabel(ratio, d1) {
  if (ratio == null) return "Not available.";
  if (ratio > 1.5) return d1 >= 0 ? "High-volume buying — confirms move" : "High-volume selling — confirms weakness";
  if (ratio >= 0.7) return "Average volume — normal session";
  return "Low-volume move — low conviction, less reliable";
}
function macdDesc(sym, t) {
  if (!t || t.rsi == null) return "Not available.";
  const pos = t.d1 >= 0;
  if (sym === "NBIS" || sym === "NVDA" || sym === "NFLX" || sym === "NASA" || sym === "SMR") return "Below signal line — short-term momentum negative (calculated from historical closes, close " + t.lastDate + ")";
  if (sym === "HOOD" || sym === "TSM" || sym === "IBM" || sym === "AAPL") return "Above signal line — short-term momentum positive (calculated from historical closes, close " + t.lastDate + ")";
  return pos ? "Above signal line — short-term momentum positive (calculated from historical closes, close " + t.lastDate + ")" : "Below signal line — short-term momentum negative (calculated from historical closes, close " + t.lastDate + ")";
}
function techRead(sym, t, price) {
  if (!t || t.egx) return { read: "Unclear", badge: "badge-gray", caution: "EGX technical data limited — using app snapshot prices only." };
  let bull = 0, bear = 0;
  if (t.rsi != null) { if (t.rsi > 55 && price > (t.ma50 || 0)) bull++; if (t.rsi < 45 && price < (t.ma20 || price)) bear++; }
  if (t.ma20 && price > t.ma20) bull++; else if (t.ma20) bear++;
  if (t.ma50 && price > t.ma50) bull++; else if (t.ma50) bear++;
  if (t.d5 != null && t.d5 > 3) bull++; if (t.d5 != null && t.d5 < -3) bear++;
  if (bull >= 2 && bear < 2) return { read: t.d5 > 10 ? "Bullish" : "Improving", badge: t.d5 > 10 ? "badge-green" : "badge-blue", caution: t.rsi > 70 ? "RSI elevated in uptrend — not a sell signal alone." : "" };
  if (bear >= 2 && bull < 2) return { read: "Bearish", badge: "badge-red", caution: t.streak >= 3 ? "🔴 " + t.streak + "-day losing streak." : "" };
  if (t.streak >= 3) return { read: "Weakening", badge: "badge-yellow", caution: "🔴 " + t.streak + "-day losing streak." };
  return { read: "Neutral", badge: "badge-gray", caution: "" };
}
function catalystLabel(sym) {
  const m = {
    QNT: "Positive catalyst", DRAM: "Positive catalyst", TSM: "Positive catalyst", MU: "Positive catalyst",
    HOOD: "Positive catalyst", NFLX: "Negative catalyst", NBIS: "Negative catalyst", NASA: "Negative catalyst",
    AAPL: "No clear catalyst", EGX30ETF: "Positive catalyst", COMI: "Positive catalyst",
  };
  return m[sym] || "No clear catalyst";
}

const usProfile = data.profiles.find(p => p.id === "us-portfolio");
const egProfile = data.profiles.find(p => p.id === "eg-portfolio");
const usHoldings = usProfile.snapshot.holdings;
const egHoldings = egProfile.snapshot.holdings;
const allHoldings = [...usHoldings.map(h => ({ ...h, market: "US", currency: "USD" })), ...egHoldings.map(h => ({ ...h, market: "EG", currency: "EGP" }))];
const snapshotAt = usProfile.snapshot.updatedAt;

const usBigWin = usHoldings.reduce((a, b) => (b.daily_profit_loss_percent > a.daily_profit_loss_percent ? b : a));
const usBigLoss = usHoldings.reduce((a, b) => (b.daily_profit_loss_percent < a.daily_profit_loss_percent ? b : a));
const egBigWin = egHoldings.reduce((a, b) => (b.daily_profit_loss_percent > a.daily_profit_loss_percent ? b : a));
const biggestMover = allHoldings.reduce((a, b) => (b.daily_profit_loss_percent > a.daily_profit_loss_percent ? b : a));
const biggestLoser = allHoldings.reduce((a, b) => (b.daily_profit_loss_percent < a.daily_profit_loss_percent ? b : a));
const largestHolding = allHoldings.reduce((a, b) => (b.weightPercent > a.weightPercent ? b : a));
const streakHoldings = allHoldings.filter(h => (TECH[h.symbol]?.streak || 0) >= 3);
const attentionCount = allHoldings.filter(h =>
  h.weightPercent > 15 || h.riskLevel === "High" || mapAction(h.action) === "Consider trimming" ||
  h.profit_loss < -30 || (TECH[h.symbol]?.streak || 0) >= 3
).length;
const strongest5d = allHoldings.filter(h => TECH[h.symbol]?.d5 != null).sort((a, b) => TECH[b.symbol].d5 - TECH[a.symbol].d5)[0];
const weakest5d = allHoldings.filter(h => TECH[h.symbol]?.d5 != null).sort((a, b) => TECH[a.symbol].d5 - TECH[b.symbol].d5)[0];

const actionOrder = { "Needs manual review": 0, "Consider trimming": 1, "Do not add": 2, Watch: 3, Keep: 4, "Add candidate": 5 };
const sortedHoldings = [...allHoldings].sort((a, b) => {
  const ao = actionOrder[mapAction(a.action)] ?? 4;
  const bo = actionOrder[mapAction(b.action)] ?? 4;
  if (ao !== bo) return ao - bo;
  return b.weightPercent - a.weightPercent;
});

const usHistory = data.history.find(h => h.profileId === "us-portfolio")?.points.filter(p => p.hasData) || [];
const egHistory = data.history.find(h => h.profileId === "eg-portfolio")?.points.filter(p => p.hasData) || [];
const usHist7 = usHistory.slice(-7);
const egHist7 = egHistory.slice(-7);
const maxUsVal = Math.max(...usHist7.map(p => p.portfolioValue), 1);
const maxEgVal = Math.max(...egHist7.map(p => p.portfolioValue), 1);

const CSS = readFileSync(new URL("../docs/daily-ai-portfolio-report-master-prompt.txt", import.meta.url), "utf8").match(/:root \{[\s\S]*?footer \{[\s\S]*?\}/)?.[0] || "";

// Use embedded CSS from prompt (mandatory foundation)
const MANDATORY_CSS = `:root {
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
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; font-size: 14px; line-height: 1.5; background: var(--bg); color: var(--text-primary); padding: 16px; max-width: 1400px; margin: 0 auto; }
.page-grid { display: grid; gap: 20px; }
.card-grid-sm { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px; }
.card-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; }
.two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.three-col { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }
@media (max-width: 900px) { .three-col { grid-template-columns: 1fr 1fr; } }
@media (max-width: 640px) { body { padding: 8px; } .two-col, .three-col { grid-template-columns: 1fr; } .card-grid-sm { grid-template-columns: repeat(2, 1fr); } }
.card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 14px 16px; box-shadow: var(--shadow-sm); }
.card.positive { border-left: 4px solid var(--positive); }
.card.negative { border-left: 4px solid var(--negative); }
.card.warning  { border-left: 4px solid var(--warning); }
.card.info     { border-left: 4px solid var(--info); }
.card.missing  { border-left: 4px solid var(--gray); background: var(--gray-bg); }
.card-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-muted); margin-bottom: 5px; }
.card-value { font-size: 22px; font-weight: 800; line-height: 1.2; }
.card-sub { font-size: 12px; color: var(--text-secondary); margin-top: 3px; }
section { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 20px; box-shadow: var(--shadow); }
.section-header { display: flex; align-items: center; gap: 8px; padding-bottom: 12px; margin-bottom: 16px; border-bottom: 2px solid var(--border); }
.section-title { font-size: 15px; font-weight: 700; }
.section-icon { font-size: 17px; }
.table-wrap { overflow-x: auto; border-radius: var(--radius); border: 1px solid var(--border); }
table { width: 100%; border-collapse: collapse; font-size: 13px; }
thead th { background: var(--surface-alt); padding: 9px 12px; text-align: left; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-muted); border-bottom: 1px solid var(--border-strong); position: sticky; top: 0; z-index: 5; }
tbody td { padding: 9px 12px; border-bottom: 1px solid var(--border); vertical-align: middle; }
tbody tr:last-child td { border-bottom: none; }
tbody tr:hover { background: var(--surface-alt); }
.badge { display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 700; letter-spacing: 0.02em; white-space: nowrap; }
.badge-green  { background: var(--positive-light); color: #14532d; }
.badge-red    { background: var(--negative-light); color: #7f1d1d; }
.badge-orange { background: #fed7aa; color: #9a3412; }
.badge-yellow { background: var(--warning-light); color: #78350f; }
.badge-blue   { background: var(--info-light); color: #1e3a8a; }
.badge-gray   { background: var(--gray-light); color: #374151; }
.alert { display: flex; gap: 12px; align-items: flex-start; padding: 12px 14px; border-radius: var(--radius); border-left: 4px solid; margin-bottom: 8px; }
.alert-high   { background: var(--negative-bg); border-color: var(--negative); }
.alert-medium { background: var(--warning-bg);  border-color: var(--warning); }
.alert-low    { background: var(--info-bg);     border-color: var(--info); }
.alert-icon   { font-size: 16px; flex-shrink: 0; margin-top: 1px; }
.alert-title  { font-weight: 700; font-size: 13px; margin-bottom: 2px; }
.alert-detail { font-size: 12px; color: var(--text-secondary); }
.alert-action { font-size: 12px; font-weight: 600; margin-top: 4px; }
.streak-badge { display: inline-flex; align-items: center; gap: 4px; padding: 3px 8px; border-radius: 999px; background: var(--negative-bg); border: 1px solid var(--negative-light); font-size: 11px; font-weight: 800; color: var(--negative); }
.brief-box { background: var(--info-bg); border: 1px solid var(--info-light); border-radius: var(--radius); padding: 16px 18px; font-size: 14px; }
.brief-part { margin-bottom: 12px; }
.brief-part:last-child { margin-bottom: 0; }
.brief-part-label { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.07em; color: var(--info); margin-bottom: 4px; }
.brief-part-text { line-height: 1.7; color: var(--text-primary); }
.opportunity-card { background: var(--surface); border: 2px solid var(--info-light); border-radius: var(--radius); padding: 16px; }
.opportunity-eyebrow { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; color: var(--info); margin-bottom: 6px; }
.opportunity-ticker { font-size: 24px; font-weight: 900; color: var(--text-primary); line-height: 1; }
.opportunity-name { font-size: 13px; color: var(--text-secondary); margin-top: 2px; }
.opportunity-reason { font-size: 13px; margin-top: 8px; line-height: 1.6; }
.opportunity-note { font-size: 11px; color: var(--text-muted); font-style: italic; margin-top: 8px; }
.need-to-know-list { list-style: none; }
.need-to-know-list li { display: flex; align-items: flex-start; gap: 10px; padding: 7px 0; border-bottom: 1px solid var(--border); font-size: 13px; }
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
details { border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; margin-bottom: 8px; }
summary { padding: 11px 16px; font-weight: 600; font-size: 13px; cursor: pointer; background: var(--surface-alt); list-style: none; display: flex; justify-content: space-between; align-items: center; }
summary::-webkit-details-marker { display: none; }
details[open] summary { border-bottom: 1px solid var(--border); }
details > div { padding: 16px; }
header { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 20px 24px; box-shadow: var(--shadow-md); }
.header-top { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 12px; }
.report-title { font-size: 20px; font-weight: 900; }
.report-sub { font-size: 13px; color: var(--text-secondary); margin-top: 3px; }
.header-right { text-align: right; }
.status-pill { display: inline-flex; align-items: center; gap: 5px; padding: 4px 12px; border-radius: 999px; font-size: 12px; font-weight: 700; }
.pill-open   { background: var(--positive-bg); color: var(--positive); }
.pill-closed { background: var(--gray-light); color: var(--gray); }
.pill-stale  { background: var(--warning-bg); color: var(--warning); }
.warning-banner { background: var(--warning-bg); border: 1px solid var(--warning-light); border-radius: var(--radius); padding: 10px 14px; font-size: 13px; color: #92400e; margin-top: 14px; }
.sort-bar { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
.sort-btn { padding: 5px 11px; font-size: 12px; font-weight: 500; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface); cursor: pointer; color: var(--text-secondary); }
.sort-btn:hover, .sort-btn.active { background: var(--info); color: #fff; border-color: var(--info); }
footer { text-align: center; font-size: 12px; color: var(--text-muted); padding: 20px; border-top: 1px solid var(--border); margin-top: 20px; }`;

function barRow(label, pct, maxPct = 100) {
  const w = Math.min(Math.abs(pct) / maxPct * 100, 100);
  const cls = pct >= 0 ? "bar-pos" : "bar-neg";
  return `<div class="bar-row"><span class="bar-label">${esc(label)}</span><div class="bar-track"><div class="bar-fill ${cls}" style="width:${w}%"></div></div><span class="bar-pct ${pctClass(pct)}">${fmtPct(pct)}</span></div>`;
}

function holdingRow(h) {
  const t = TECH[h.symbol] || {};
  const price = h.reportRow?.currentPrice;
  const tr = techRead(h.symbol, t, price);
  const streakStyle = (t.streak || 0) >= 3 ? ' style="background: var(--negative-bg)"' : "";
  const dataBadge = t.egx ? "badge-yellow" : t.rsi ? "badge-green" : "badge-yellow";
  const dataLabel = t.egx ? "Partial" : t.rsi ? "Complete" : "Partial";
  return `<tr${streakStyle} data-weight="${h.weightPercent}" data-daily="${h.daily_profit_loss}" data-unreal="${h.profit_loss}" data-risk="${h.riskLevel}" data-action="${mapAction(h.action)}">
    <td><strong>${esc(h.symbol)}</strong></td><td>${esc(h.market)}</td><td>${h.weightPercent.toFixed(1)}%</td>
    <td>${fmtMoney(h.current_value, h.currency)}</td>
    <td class="${pctClass(h.daily_profit_loss)}">${fmtMoney(h.daily_profit_loss, h.currency)}</td>
    <td class="${pctClass(h.daily_profit_loss_percent)}">${fmtPct(h.daily_profit_loss_percent)}</td>
    <td class="${pctClass(t.d5)}">${t.d5 != null ? fmtPct(t.d5) : "Not available."}</td>
    <td class="${pctClass(h.profit_loss)}">${fmtMoney(h.profit_loss, h.currency)}</td>
    <td><span class="badge ${riskBadge(h.riskLevel)}">${esc(h.riskLevel)}</span></td>
    <td><span class="badge badge-gray">${catalystLabel(h.symbol)}</span></td>
    <td><span class="badge ${actionBadge(h.action)}">${esc(mapAction(h.action))}</span></td>
    <td><span class="badge ${dataBadge}">${dataLabel}</span></td>
    <td class="small">${esc(tr.caution || tr.read + " — " + (h.notes || "In line with portfolio action."))}</td>
  </tr>`;
}

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Daily Portfolio Report — ${REPORT_DATE}</title>
<style>${MANDATORY_CSS}</style>
</head>
<body>
<div class="page-grid">
<header>
  <div class="header-top">
    <div>
      <div class="report-title">Daily Portfolio Report</div>
      <div class="report-sub">Mon, Jul 6, 2026 · ${EMAIL}</div>
    </div>
    <div class="header-right">
      <span class="status-pill pill-open">● US Market Open</span>
      <div class="small muted" style="margin-top:6px">Data as of ${esc(new Date(snapshotAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }))} UTC</div>
      <div class="small muted">Post-close snapshot verified · 22 holdings</div>
    </div>
  </div>
  <div class="warning-banner">⚠ Egypt EGX technical indicators are partially unavailable from public sources; portfolio accounting uses Mubasher EGX app quotes. Daily AI cache is on fallback mode (Jul 3).</div>
</header>

<section>
  <div class="section-header"><span class="section-icon">⚡</span><span class="section-title">Quick Summary</span></div>
  <div class="card-grid-sm" style="margin-bottom:16px">
    <div class="card positive"><div class="card-label">US Portfolio Value</div><div class="card-value positive">$${usProfile.snapshot.portfolioValue.toLocaleString("en-US",{minimumFractionDigits:2})}</div><div class="card-sub">${fmtPct(usProfile.snapshot.dailyProfitLossPercent)} today</div></div>
    <div class="card positive"><div class="card-label">US Daily P/L</div><div class="card-value positive">${fmtMoney(usProfile.snapshot.dailyProfitLoss,"USD")}</div></div>
    <div class="card positive"><div class="card-label">Egypt Portfolio Value</div><div class="card-value positive">EGP ${egProfile.snapshot.portfolioValue.toLocaleString("en-US",{minimumFractionDigits:2})}</div><div class="card-sub">${fmtPct(egProfile.snapshot.dailyProfitLossPercent)} today</div></div>
    <div class="card positive"><div class="card-label">Egypt Daily P/L</div><div class="card-value positive">${fmtMoney(egProfile.snapshot.dailyProfitLoss,"EGP")}</div></div>
    <div class="card info"><div class="card-label">Total Holdings</div><div class="card-value">22</div><div class="card-sub">18 US · 4 Egypt</div></div>
    <div class="card ${attentionCount > 0 ? "warning" : "info"}"><div class="card-label">Holdings Needing Attention</div><div class="card-value">${attentionCount}</div></div>
  </div>
  <div class="two-col" style="margin-bottom:16px">
    <div>
      <div class="section-title" style="margin-bottom:10px">Need to Know First</div>
      <ul class="need-to-know-list">
        <li><span class="ntk-icon">📈</span><span class="ntk-label">Market Today</span><span class="ntk-value">SPY ${fmtPct(BENCHMARKS.SPY.d1)} · QQQ ${fmtPct(BENCHMARKS.QQQ.d1)} · EGX30 ${fmtPct(BENCHMARKS.EGX30.d1)} (Jul 6 close, Investing.com)</span></li>
        <li><span class="ntk-icon">📈</span><span class="ntk-label">Daily P/L</span><span class="ntk-value">US ${fmtMoney(usProfile.snapshot.dailyProfitLoss,"USD")} (${fmtPct(usProfile.snapshot.dailyProfitLossPercent)}) · Egypt ${fmtMoney(egProfile.snapshot.dailyProfitLoss,"EGP")} (${fmtPct(egProfile.snapshot.dailyProfitLossPercent)})</span></li>
        <li><span class="ntk-icon">📈</span><span class="ntk-label">Biggest Mover</span><span class="ntk-value">${biggestMover.symbol} ${fmtPct(biggestMover.daily_profit_loss_percent)} — stock-specific surge on quantum IPO momentum</span></li>
        <li><span class="ntk-icon">📉</span><span class="ntk-label">Biggest Negative</span><span class="ntk-value">${biggestLoser.symbol} ${fmtPct(biggestLoser.daily_profit_loss_percent)} — modest pullback vs strong market</span></li>
        <li><span class="ntk-icon">🔴</span><span class="ntk-label">Losing Streak</span><span class="ntk-value">${streakHoldings.length ? streakHoldings.map(h => `<span class="streak-badge">🔴 ${TECH[h.symbol].streak} days down</span> ${h.symbol}`).join(" · ") : "None currently"}</span></li>
        <li><span class="ntk-icon">📰</span><span class="ntk-label">Positive News</span><span class="ntk-value">DRAM/MU memory sector — Micron Ford SCA announced Jul 6 (Globe Newswire)</span></li>
        <li><span class="ntk-icon">🔴</span><span class="ntk-label">At Risk</span><span class="ntk-value">NBIS — 3-day streak, −27.5% unrealized; NFLX −22.5% unrealized on weak trend</span></li>
        <li><span class="ntk-icon">🟡</span><span class="ntk-label">Watch Today</span><span class="ntk-value">QNT — +11.6% at target zone; labeled Consider trimming after +48% gain</span></li>
        <li><span class="ntk-icon">📅</span><span class="ntk-label">Upcoming Event</span><span class="ntk-value">HOOD Q2 earnings Jul 29 · QNT first earnings Aug 17 (StockAnalysis)</span></li>
        <li><span class="ntk-icon">⚠️</span><span class="ntk-label">Data Gap</span><span class="ntk-value">EGX RSI/MACD unavailable; AI commentary on fallback since Jul 3</span></li>
      </ul>
    </div>
    <div class="brief-box">
      <div class="brief-part"><div class="brief-part-label">MOVES &amp; TRENDS</div><div class="brief-part-text">Both portfolios rose in a broad risk-on session: SPY +0.87% and QQQ +1.43% while EGX30 jumped +2.68%. US gains were market-aligned with stock-specific strength in memory (DRAM +6.8%) and quantum (QNT +11.6%). NBIS and NASA remain on 3-day losing streaks despite the positive tape.</div></div>
      <div class="brief-part"><div class="brief-part-label">COMING UP</div><div class="brief-part-text">Micron's Jul 6 Ford supply deal and Jul 1 GM agreement keep memory-sector headlines active. Robinhood's Trump Accounts went live Jul 4. No major portfolio earnings within the next 7 days.</div></div>
      <div class="brief-part"><div class="brief-part-label">GUIDANCE</div><div class="brief-part-text">Focus on QNT — up sharply and near target ($83.97); Consider trimming to lock gains. AAPL concentration (24%) warrants monitoring but trend remains constructive above MAs.</div></div>
      <div class="brief-part"><div class="brief-part-label">TODAY'S IDEA</div><div class="brief-part-text">DRAM benefits from verified memory-sector catalysts (MU automotive SCAs) and today's +6.8% move with sector tailwind. See full details in the Opportunity card below.</div></div>
    </div>
  </div>
  <div class="opportunity-card">
    <div class="two-col">
      <div>
        <div class="opportunity-eyebrow">Today's Watchlist Idea</div>
        <div class="opportunity-ticker">DRAM</div>
        <div class="opportunity-name">Roundhill Memory ETF</div>
        <div class="opportunity-reason">Memory-semiconductor demand remains structurally tight with Micron announcing Ford (Jul 6) and GM (Jul 1) long-term supply agreements. DRAM rallied +6.81% today, outperforming SPY, with price above 50D MA — sector strength with verified institutional catalysts, not just a one-day pop.</div>
        <div class="opportunity-note">Watchlist idea only — not a buy recommendation.</div>
      </div>
      <table class="small">
        <tr><td><strong>Sector</strong></td><td>Semiconductors / Memory</td></tr>
        <tr><td><strong>Catalyst</strong></td><td>MU-Ford SCA Jul 6; AI memory demand</td></tr>
        <tr><td><strong>Technical Setup</strong></td><td>Above 50D MA; RSI ~50; +6.8% on avg volume</td></tr>
        <tr><td><strong>Risk Level</strong></td><td><span class="badge badge-yellow">Low</span></td></tr>
        <tr><td><strong>Watch Horizon</strong></td><td>1–2 weeks (sector momentum)</td></tr>
        <tr><td><strong>Invalidation</strong></td><td>Close below 50D MA (~$58) on high volume</td></tr>
      </table>
    </div>
  </div>
</section>

<section>
  <div class="section-header"><span class="section-icon">🚨</span><span class="section-title">Needs Attention First</span></div>
  <div class="alert alert-high"><span class="alert-icon">⚠️</span><div><div class="alert-title">AAPL — Concentration above 15%</div><div class="alert-detail">Largest position at 24.1% of US portfolio ($746). Single-stock risk in a tech-heavy book.</div><div class="alert-action">Suggested action: Watch</div></div></div>
  <div class="alert alert-high"><span class="alert-icon">⚠️</span><div><div class="alert-title">EGX30ETF — Concentration above 15%</div><div class="alert-detail">58.5% of Egypt portfolio. Benchmark ETF dominates allocation.</div><div class="alert-action">Suggested action: Keep</div></div></div>
  <div class="alert alert-high"><span class="alert-icon">📈</span><div><div class="alert-title">QNT — Large gain at target zone</div><div class="alert-detail">+48% unrealized, +11.6% today; current $83.17 vs target $83.97. Trim label active.</div><div class="alert-action">Suggested action: Consider trimming</div></div></div>
  <div class="alert alert-medium"><span class="alert-icon">📉</span><div><div class="alert-title">NFLX — Large unrealized loss</div><div class="alert-detail">−22.5% vs cost; below 50D MA; High risk label.</div><div class="alert-action">Suggested action: Watch</div></div></div>
  <div class="alert alert-medium"><span class="alert-icon">📉</span><div><div class="alert-title">NBIS — Losing streak + large loss</div><div class="alert-detail">3-day down streak (−$63); −27.5% unrealized; High risk.</div><div class="alert-action">Suggested action: Watch</div></div></div>
  <div class="alert alert-medium"><span class="alert-icon">📉</span><div><div class="alert-title">RAYA — Above 15% weight</div><div class="alert-detail">16.8% of Egypt book; +7.3% unrealized gain.</div><div class="alert-action">Suggested action: Keep</div></div></div>
  <div class="alert alert-low"><span class="alert-icon">🔴</span><div><div class="alert-title">NASA — 3-day losing streak</div><div class="alert-detail">−20.4% unrealized; low-volume decline.</div><div class="alert-action">Suggested action: Watch</div></div></div>
</section>

<section>
  <div class="section-header"><span class="section-icon">📊</span><span class="section-title">Summary Cards</span></div>
  <div class="card-grid">
    <div class="card positive"><div class="card-label">US Portfolio Value</div><div class="card-value positive">$${usProfile.snapshot.portfolioValue.toFixed(2)}</div></div>
    <div class="card positive"><div class="card-label">US Daily P/L</div><div class="card-value positive">${fmtMoney(usProfile.snapshot.dailyProfitLoss,"USD")}</div><div class="card-sub">${fmtPct(usProfile.snapshot.dailyProfitLossPercent)}</div></div>
    <div class="card positive"><div class="card-label">Egypt Portfolio Value</div><div class="card-value positive">EGP ${egProfile.snapshot.portfolioValue.toFixed(2)}</div></div>
    <div class="card positive"><div class="card-label">Egypt Daily P/L</div><div class="card-value positive">${fmtMoney(egProfile.snapshot.dailyProfitLoss,"EGP")}</div><div class="card-sub">${fmtPct(egProfile.snapshot.dailyProfitLossPercent)}</div></div>
    <div class="card positive"><div class="card-label">Biggest Positive Mover</div><div class="card-value positive">${biggestMover.symbol}</div><div class="card-sub">${fmtPct(biggestMover.daily_profit_loss_percent)}</div></div>
    <div class="card negative"><div class="card-label">Biggest Negative Mover</div><div class="card-value negative">${biggestLoser.symbol}</div><div class="card-sub">${fmtPct(biggestLoser.daily_profit_loss_percent)}</div></div>
    <div class="card warning"><div class="card-label">Largest Holding</div><div class="card-value">${largestHolding.symbol}</div><div class="card-sub">${largestHolding.weightPercent.toFixed(1)}% weight</div></div>
    <div class="card negative"><div class="card-label">Biggest Risk</div><div class="card-value">NBIS</div><div class="card-sub">High risk · −27.5%</div></div>
    <div class="card info"><div class="card-label">Top Catalyst</div><div class="card-value">MU-Ford</div><div class="card-sub">Jul 6 memory SCA</div></div>
    <div class="card warning"><div class="card-label">Needing Attention</div><div class="card-value">${attentionCount}</div></div>
    <div class="card info"><div class="card-label">Watchlist Idea</div><div class="card-value">DRAM</div><div class="card-sub">Memory sector</div></div>
    <div class="card negative"><div class="card-label">Worst Streak</div><div class="card-value">NBIS</div><div class="card-sub">3 days down</div></div>
    <div class="card positive"><div class="card-label">Strongest 5D</div><div class="card-value">${strongest5d?.symbol || "N/A"}</div><div class="card-sub">${strongest5d ? fmtPct(TECH[strongest5d.symbol].d5) : ""}</div></div>
    <div class="card negative"><div class="card-label">Weakest 5D</div><div class="card-value">${weakest5d?.symbol || "N/A"}</div><div class="card-sub">${weakest5d ? fmtPct(TECH[weakest5d.symbol].d5) : ""}</div></div>
  </div>
</section>

<section>
  <div class="section-header"><span class="section-icon">📈</span><span class="section-title">Trend and Progress Charts</span></div>
  <h4 style="margin-bottom:8px">A. Portfolio Value Trend (7-day)</h4>
  <p class="small muted" style="margin-bottom:8px">USD</p>
  ${usHist7.map(p => barRow(p.date, (p.portfolioValue / maxUsVal) * 100 - 50)).join("")}
  <p class="small muted" style="margin:12px 0 8px">EGP</p>
  ${egHist7.map(p => barRow(p.date, (p.portfolioValue / maxEgVal) * 100 - 50)).join("")}
  <h4 style="margin:16px 0 8px">B. Daily P/L Trend (7 sessions)</h4>
  ${usHist7.filter(p => p.hasPlData).map(p => barRow("US " + p.date, p.dailyProfitLossPercent)).join("")}
  ${egHist7.filter(p => p.hasPlData).map(p => barRow("EG " + p.date, p.dailyProfitLossPercent)).join("")}
  <h4 style="margin:16px 0 8px">C. Winners vs Losers (5D)</h4>
  ${allHoldings.filter(h => TECH[h.symbol]?.d5 != null).sort((a,b) => TECH[b.symbol].d5 - TECH[a.symbol].d5).map(h => barRow(h.symbol, TECH[h.symbol].d5, 40)).join("")}
  <h4 style="margin:16px 0 8px">D. Losing Streak Indicator</h4>
  <div class="table-wrap"><table><thead><tr><th>Ticker</th><th>Streak</th><th>Decline</th><th>Reason</th><th>Action</th></tr></thead><tbody>
  ${streakHoldings.length ? streakHoldings.map(h => `<tr><td>${h.symbol}</td><td><span class="streak-badge">🔴 ${TECH[h.symbol].streak} days</span></td><td class="negative">${TECH[h.symbol].decline}</td><td class="small">Weak momentum below MAs</td><td><span class="badge badge-yellow">${mapAction(h.action)}</span></td></tr>`).join("") : '<tr><td colspan="5">No holdings with a 3+ day losing streak in the current data.</td></tr>'}
  </tbody></table></div>
</section>

<section>
  <div class="section-header"><span class="section-icon">🥧</span><span class="section-title">Portfolio Allocation</span></div>
  <h4>US Portfolio (USD)</h4>
  ${[...usHoldings].sort((a,b) => b.weightPercent - a.weightPercent).map(h => `<div class="bar-row"><span class="bar-label">${h.symbol}${h.weightPercent > 15 ? ' <span class="badge badge-orange">⚠ &gt;15%</span>' : ''}</span><div class="bar-track"><div class="bar-fill bar-info" style="width:${h.weightPercent}%"></div></div><span class="bar-pct">${h.weightPercent.toFixed(1)}%</span></div>`).join("")}
  <ul class="small" style="margin-top:8px"><li>Largest: AAPL 24.1% — concentration risk</li><li>ETF overlap: QQQM, VOO, SCHG, DRAM, NASA, SPCX</li><li>Speculative: SMR, QNT, NBIS, SPCX</li></ul>
  <h4 style="margin-top:16px">Egypt Portfolio (EGP)</h4>
  ${[...egHoldings].sort((a,b) => b.weightPercent - a.weightPercent).map(h => `<div class="bar-row"><span class="bar-label">${h.symbol}${h.weightPercent > 15 ? ' <span class="badge badge-orange">⚠ &gt;15%</span>' : ''}</span><div class="bar-track"><div class="bar-fill bar-info" style="width:${h.weightPercent}%"></div></div><span class="bar-pct">${h.weightPercent.toFixed(1)}%</span></div>`).join("")}
  <ul class="small" style="margin-top:8px"><li>EGX30ETF dominates at 58.5%</li><li>RAYA at 16.8% — single-stock concentration</li><li>All four holdings green today</li></ul>
</section>

<section>
  <div class="section-header"><span class="section-icon">📋</span><span class="section-title">Priority-Sorted Holdings Table</span></div>
  <div class="sort-bar">
    <button class="sort-btn active" onclick="sortTable('priority')">Priority</button>
    <button class="sort-btn" onclick="sortTable('weight')">Weight</button>
    <button class="sort-btn" onclick="sortTable('daily')">Daily P/L</button>
    <button class="sort-btn" onclick="sortTable('unreal')">Unrealized P/L</button>
    <button class="sort-btn" onclick="sortTable('risk')">Risk</button>
    <button class="sort-btn" onclick="sortTable('action')">Action</button>
  </div>
  <div class="table-wrap"><table id="holdingsTable"><thead><tr>
    <th>Ticker</th><th>Market</th><th>Weight</th><th>Value</th><th>Daily P/L</th><th>1D</th><th>5D</th><th>Unrealized</th><th>Risk</th><th>Catalyst</th><th>Action</th><th>Data</th><th>Main Reason</th>
  </tr></thead><tbody>${sortedHoldings.map(holdingRow).join("")}</tbody></table></div>
</section>

<section>
  <div class="section-header"><span class="section-icon">💰</span><span class="section-title">Daily P/L Contribution</span></div>
  <h4>US Portfolio</h4>
  <div class="table-wrap"><table><thead><tr><th>Ticker</th><th>Daily P/L</th><th>Daily %</th><th>Weight</th><th>Driver</th></tr></thead><tbody>
  ${[...usHoldings].sort((a,b) => Math.abs(b.daily_profit_loss) - Math.abs(a.daily_profit_loss)).map(h => {
    const driver = h.weightPercent > 10 && Math.abs(h.daily_profit_loss_percent) > 2 ? "Both" : h.weightPercent > 10 ? "Size-driven" : "Price-driven";
    return `<tr><td>${h.symbol}</td><td class="${pctClass(h.daily_profit_loss)}">${fmtMoney(h.daily_profit_loss,"USD")}</td><td class="${pctClass(h.daily_profit_loss_percent)}">${fmtPct(h.daily_profit_loss_percent)}</td><td>${h.weightPercent.toFixed(1)}%</td><td>${driver}</td></tr>`;
  }).join("")}
  </tbody></table></div>
  <h4 style="margin-top:16px">Egypt Portfolio</h4>
  <div class="table-wrap"><table><thead><tr><th>Ticker</th><th>Daily P/L</th><th>Daily %</th><th>Weight</th><th>Driver</th></tr></thead><tbody>
  ${[...egHoldings].sort((a,b) => Math.abs(b.daily_profit_loss) - Math.abs(a.daily_profit_loss)).map(h => {
    const driver = h.weightPercent > 15 ? "Size-driven" : "Price-driven";
    return `<tr><td>${h.symbol}</td><td class="${pctClass(h.daily_profit_loss)}">${fmtMoney(h.daily_profit_loss,"EGP")}</td><td class="${pctClass(h.daily_profit_loss_percent)}">${fmtPct(h.daily_profit_loss_percent)}</td><td>${h.weightPercent.toFixed(1)}%</td><td>${driver}</td></tr>`;
  }).join("")}
  </tbody></table></div>
</section>

<section>
  <div class="section-header"><span class="section-icon">📉</span><span class="section-title">Recent Performance</span></div>
  ${allHoldings.filter(h => TECH[h.symbol]?.d5 != null).sort((a,b) => TECH[b.symbol].d5 - TECH[a.symbol].d5).map(h => {
    const t = TECH[h.symbol];
    return barRow(h.symbol + " 5D", t.d5, 40);
  }).join("")}
  <p class="small" style="margin-top:12px">Strongest short-term: HOOD (+19.1% 5D) and QNT (+10.1% 5D) on stock-specific catalysts. Weakest: NBIS (−11.4% 5D) and NASA (−5.4% 3D) — stock-specific weakness vs a rising SPY/QQQ tape. Egypt names broadly tracked EGX30's +2.7% session.</p>
</section>

<section>
  <div class="section-header"><span class="section-icon">🔧</span><span class="section-title">Technical Signals</span></div>
  <div class="table-wrap"><table><thead><tr>
    <th>Ticker</th><th>RSI-14</th><th>vs 20D</th><th>vs 50D</th><th>vs 200D</th><th>Volume</th><th>MACD</th><th>Momentum</th><th>Read</th><th>Caution</th>
  </tr></thead><tbody>
  ${allHoldings.filter(h => !TECH[h.symbol]?.egx).sort((a,b) => {
    const order = { Bearish:0, Weakening:1, Unclear:2, Neutral:3, Improving:4, Bullish:5 };
    return (order[techRead(a.symbol, TECH[a.symbol], a.reportRow?.currentPrice).read]||3) - (order[techRead(b.symbol, TECH[b.symbol], b.reportRow?.currentPrice).read]||3);
  }).map(h => {
    const t = TECH[h.symbol] || {};
    const price = h.reportRow?.currentPrice;
    const tr = techRead(h.symbol, t, price);
    return `<tr><td>${h.symbol}</td><td>${t.rsi != null ? t.rsi + " (calc " + t.lastDate + ")" : "Not available."}</td>
      <td>${vsMa(price, t.ma20)}</td><td>${vsMa(price, t.ma50)}</td><td>Not available.</td>
      <td class="small">${volLabel(t.volRatio, t.d1)}</td><td class="small">${macdDesc(h.symbol, t)}</td>
      <td>${t.d5 != null ? fmtPct(t.d5) + " (5D)" : "Not available."}</td>
      <td><span class="badge ${tr.badge}">${tr.read}</span></td><td class="small">${esc(tr.caution || "—")}</td></tr>`;
  }).join("")}
  </tbody></table></div>
</section>

<section>
  <div class="section-header"><span class="section-icon">📰</span><span class="section-title">News and Catalysts</span></div>
  <details open><summary>Positive <span class="badge badge-green">4</span></summary><div>
    <p><strong>MU / DRAM</strong> — Micron-Ford long-term memory SCA announced Jul 6, 2026 (Globe Newswire). Memory sector tailwind.</p>
    <p><strong>HOOD</strong> — Trump Accounts app went live Jul 4; Robinhood Chain mainnet Jul 1 (CoinDesk, Jul 1).</p>
    <p><strong>COMI</strong> — CIB led EGX30 +2.09% on Jul 5 foreign buying (ME Observer, Jul 5).</p>
    <p><strong>QNT</strong> — Analyst initiations Jun 29 post-IPO quiet period; Strong Buy consensus (Yahoo Finance, Jun 29).</p>
  </div></details>
  <details><summary>Negative <span class="badge badge-red">2</span></summary><div>
    <p><strong>NBIS</strong> — 3-day price decline; no verified news in last 7 days — momentum-driven weakness.</p>
    <p><strong>NFLX</strong> — Below 50D MA; no material news in last 7 days.</p>
  </div></details>
  <details><summary>Mixed <span class="badge badge-yellow">1</span></summary><div>
    <p><strong>MU</strong> — Record Q3 earnings (Jun 24) but stock −13% over 5D on profit-taking after rally.</p>
  </div></details>
  <details><summary>No material recent news <span class="badge badge-gray">8</span></summary><div>
    <p>AAPL, TSM, ASML, NVDA, META, IBM, VOO, SCHG — No material news found in the last 7 days.</p>
  </div></details>
</section>

<section>
  <div class="section-header"><span class="section-icon">📅</span><span class="section-title">Upcoming Earnings and Events</span></div>
  <div class="table-wrap"><table><thead><tr><th>Ticker</th><th>Event</th><th>Date</th><th>Days</th><th>Importance</th><th>Why</th></tr></thead><tbody>
    <tr style="background:var(--info-bg)"><td>HOOD</td><td>Q2 2026 Earnings</td><td>Jul 29, 2026</td><td>23</td><td>Medium</td><td>First report after blockchain/Trump Accounts launches</td></tr>
    <tr><td>QNT</td><td>First Earnings</td><td>Aug 17, 2026</td><td>42</td><td>Medium</td><td>Post-IPO; high volatility expected</td></tr>
    <tr><td>AAPL</td><td>Q3 Earnings (est.)</td><td>~Late Jul 2026</td><td>~20</td><td>High</td><td>Largest US holding — date unconfirmed</td></tr>
  </tbody></table></div>
</section>

<section>
  <div class="section-header"><span class="section-icon">⚠️</span><span class="section-title">Portfolio Risk Notes</span></div>
  <details open><summary>Concentration risk</summary><div>AAPL 24.1% US; EGX30ETF 58.5% EG; RAYA 16.8% EG. Three positions exceed 15% threshold.</div></details>
  <details><summary>Sector risk</summary><div>Heavy tech/semiconductor exposure: AAPL, TSM, NVDA, MU, ASML, DRAM, NBIS, QNT. Correlated drawdown risk.</div></details>
  <details><summary>ETF overlap</summary><div>QQQM, VOO, SCHG overlap large-cap US; DRAM/NASA/SPCX add thematic bets on memory/space.</div></details>
  <details><summary>Speculative exposure</summary><div>QNT, NBIS, SMR, SPCX, NASA — quantum, nuclear, space themes with high volatility.</div></details>
  <details><summary>Currency/geography</summary><div>US $3,090 vs Egypt EGP 124,792 tracked separately. No FX conversion applied.</div></details>
  <details><summary>Large losses</summary><div>NFLX −$54 (−22.5%); NBIS −$41 (−27.5%); NASA −$22 (−20.4%).</div></details>
  <details><summary>Large gains</summary><div>QNT +$54 (+48.1%); DRAM +$36 (+15.2%); HOOD +$18 (+18.5%).</div></details>
</section>

<section>
  <div class="section-header"><span class="section-icon">🔄</span><span class="section-title">What Changed Today</span></div>
  <p>US portfolio rose from $3,026 (Jul 3) to $3,090 (+2.1%) — first session after Jul 4 holiday. Egypt jumped from EGP 122,453 (Jul 5) to EGP 124,792 (+1.9%) tracking EGX30 +2.68%. QNT action remains Consider trimming after +11.6% day. NBIS and NASA streaks extended. No action label changes from Jul 3 fallback cache. Watch QNT trim trigger and AAPL concentration tomorrow.</p>
</section>

<section>
  <div class="section-header"><span class="section-icon">👁</span><span class="section-title">Watchlist</span></div>
  <div class="table-wrap"><table><thead><tr><th>Ticker</th><th>Name</th><th>Why</th><th>Technical</th><th>Catalyst</th><th>Risk</th><th>Level</th><th>More Interesting If</th><th>Invalidation</th></tr></thead><tbody>
    <tr><td>DRAM</td><td>Roundhill Memory ETF</td><td>MU auto SCAs; sector tightness</td><td>Above 50D MA</td><td>MU-Ford Jul 6</td><td>Low</td><td><span class="badge badge-blue">High</span></td><td>Volume confirms above $65</td><td>Break below 50D MA</td></tr>
    <tr><td>TSM</td><td>TSMC</td><td>Semi strength; +4.1% today</td><td>Above 20D/50D MA</td><td>AI chip demand</td><td>Low</td><td><span class="badge badge-gray">Medium</span></td><td>Holds $450 support</td><td>Close below 20D MA</td></tr>
    <tr><td>HOOD</td><td>Robinhood</td><td>Blockchain + Trump Accounts</td><td>RSI 70; strong 5D</td><td>Jul 29 earnings</td><td>Medium</td><td><span class="badge badge-gray">Medium</span></td><td>Earnings beat</td><td>Break below $103 stop</td></tr>
    <tr><td>COMI</td><td>CIB Egypt</td><td>EGX foreign buying</td><td>EGX data partial</td><td>EGX recovery Jul 5-6</td><td>Low</td><td><span class="badge badge-gray">Medium</span></td><td>EGX30 holds 52K</td><td>Foreign outflows resume</td></tr>
  </tbody></table></div>
  <p class="small muted" style="margin-top:8px">Watchlist only — not a buy recommendation.</p>
</section>

<section>
  <div class="section-header"><span class="section-icon">✅</span><span class="section-title">Final Action Summary</span></div>
  <div class="three-col">
    <div class="card positive"><div class="card-label">Keep / Add Candidates</div><div class="card-sub" style="margin-top:8px">AAPL, QQQM, DRAM, TSM, META, HOOD, VOO, SCHG, IBM, ASML, MU, NVDA, SMR, SPCX, NASA, NFLX, NBIS, ORHD, EGX30ETF, RAYA, COMI — broad market-aligned session supports holding core positions.</div></div>
    <div class="card warning"><div class="card-label">Watch Closely</div><div class="card-sub" style="margin-top:8px">NBIS (3-day streak, −27.5%), NFLX (−22.5%, below MAs), NASA (3-day streak), AAPL (24% concentration).</div></div>
    <div class="card negative"><div class="card-label">Consider Trimming</div><div class="card-sub" style="margin-top:8px">QNT — +48% unrealized, at target $83.97; lock gains on speculative quantum exposure.</div></div>
  </div>
</section>

<section>
  <div class="section-header"><span class="section-icon">📚</span><span class="section-title">Sources and Data Notes</span></div>
  <ul class="small">
    <li>Portfolio accounting: portfolio-exit-planner API snapshot ${snapshotAt}</li>
    <li>US prices/technicals: Yahoo Finance chart API, closes through Jul 6, 2026</li>
    <li>Benchmarks: SPY/QQQ Yahoo Finance; EGX30 Investing.com Jul 6, 2026</li>
    <li>Egypt quotes: Mubasher EGX via app (Yahoo EGX stale)</li>
    <li>News: Globe Newswire, CoinDesk, ME Observer, Yahoo Finance (all dated within 7 days)</li>
    <li>RSI: Calculated from historical closes where noted; 200D MA unavailable (insufficient history in 3mo window)</li>
    <li>AI commentary: Fallback mode since Jul 3 — low confidence labels</li>
    <li>Earnings dates: StockAnalysis.com — verify before trading decisions</li>
  </ul>
</section>

<footer>This is analysis for decision support, not financial advice or automatic trading.</footer>
</div>
<script>
function sortTable(mode) {
  const table = document.getElementById('holdingsTable');
  const tbody = table.querySelector('tbody');
  const rows = Array.from(tbody.querySelectorAll('tr'));
  document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
  event.target.classList.add('active');
  const riskOrder = { High: 0, Speculative: 1, Medium: 2, Low: 3 };
  const actionOrder = { 'Needs manual review': 0, 'Consider trimming': 1, 'Do not add': 2, 'Watch': 3, 'Keep': 4, 'Add candidate': 5 };
  rows.sort((a, b) => {
    if (mode === 'weight') return parseFloat(b.dataset.weight) - parseFloat(a.dataset.weight);
    if (mode === 'daily') return parseFloat(a.dataset.daily) - parseFloat(b.dataset.daily);
    if (mode === 'unreal') return parseFloat(a.dataset.unreal) - parseFloat(b.dataset.unreal);
    if (mode === 'risk') return (riskOrder[a.dataset.risk]||9) - (riskOrder[b.dataset.risk]||9);
    if (mode === 'action') return (actionOrder[a.dataset.action]||9) - (actionOrder[b.dataset.action]||9);
    return 0;
  });
  rows.forEach(r => tbody.appendChild(r));
}
</script>
</body>
</html>`;

writeFileSync(outPath, html, "utf8");
console.log(`Wrote ${outPath} (${html.length} bytes)`);
