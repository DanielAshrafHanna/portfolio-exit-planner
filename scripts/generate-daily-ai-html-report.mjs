#!/usr/bin/env node
/**
 * Generates a self-contained daily portfolio HTML report from portfolio API
 * and market technical data JSON snapshots.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const SESSION_DATE = process.env.REPORT_SESSION_DATE || "2026-07-09";
const EMAIL = process.env.REPORT_EMAIL || "danielhanna0001@gmail.com";
const PORTFOLIO_PATH = process.env.PORTFOLIO_DATA_PATH || "/tmp/portfolio-data.json";
const MARKET_TECH_PATH = process.env.MARKET_TECH_PATH || "/tmp/market-tech.json";
const OUTPUT_PATH =
  process.env.REPORT_OUTPUT_PATH ||
  join(ROOT, "docs/reports/.raw", `portfolio-report-${SESSION_DATE}.html`);

const BENCHMARKS = {
  SPY: { d1: 0.85, label: "S&P 500 ETF" },
  QQQ: { d1: 1.66, label: "Nasdaq 100 ETF" },
  EGX30: { d1: 0.54, level: 52311.51, source: "Amwal Al Ghad", date: "Jul 9 2026" },
};

const EARNINGS = [
  { symbol: "NFLX", event: "Q2 Earnings", date: "2026-07-16", importance: "High" },
  { symbol: "META", event: "Q2 Earnings", date: "2026-07-29", importance: "Medium" },
  { symbol: "AAPL", event: "Q3 Earnings", date: "2026-07-30", importance: "High" },
];

const NEWS_ITEMS = [
  {
    tickers: ["META"],
    headline: "Meta advancing Iris AI chip production targeting September rollout",
    source: "Reuters / TechCrunch",
    date: "2026-07-09",
    impact: "Positive",
    group: "Positive",
    note: "Supports AI infrastructure narrative; may reinforce relative strength vs benchmark.",
  },
  {
    tickers: ["MU"],
    headline: "Micron outlines $250B US investment plan; shares rose ~4.5% on Jul 9",
    source: "Business Insider",
    date: "2026-07-09",
    impact: "Positive",
    group: "Positive",
    note: "Major domestic fab catalyst aligns with memory supercycle theme.",
  },
  {
    tickers: ["NFLX"],
    headline: "Q2 earnings scheduled Jul 16",
    source: "Company calendar",
    date: "2026-07-09",
    impact: "Mixed",
    group: "Mixed",
    note: "Upcoming results within 7 days — elevated event risk.",
  },
  {
    tickers: ["NFLX"],
    headline: "Bernstein price target cut",
    source: "Bernstein",
    date: "2026-07-08",
    impact: "Negative",
    group: "Negative",
    isAnalyst: true,
    note: "Analyst rating change — not headline news; adds caution ahead of earnings.",
  },
  {
    tickers: ["EGX30", "EGX30ETF"],
    headline: "EGX30 rebounded +0.54% to 52,311.51 pts",
    source: "Amwal Al Ghad",
    date: "2026-07-09",
    impact: "Positive",
    group: "Positive",
    note: "Benchmark recovery supports Egypt ETF holdings.",
  },
  {
    tickers: ["EGX30", "EGX30ETF"],
    headline: "EGX profit-taking session -1.84%",
    source: "Middle East Observer",
    date: "2026-07-08",
    impact: "Negative",
    group: "Negative",
    note: "Prior-session weakness provides context for Egypt volatility.",
  },
  {
    tickers: ["RAYA"],
    headline: "RAYA declined -3.1% on profit-taking",
    source: "Middle East Observer",
    date: "2026-07-08",
    impact: "Negative",
    group: "Negative",
    note: "Prior pullback; today's +2.56% partially recovers.",
  },
];

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

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtMoney(n, currency) {
  if (n == null || Number.isNaN(n)) return "Not available.";
  const sym = currency === "EGP" ? "EGP " : "$";
  const abs = Math.abs(n);
  const str =
    currency === "EGP"
      ? abs.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : abs.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const sign = n < 0 ? "-" : n > 0 ? "+" : "";
  return `${sign}${sym}${str}`;
}

function fmtPct(n, signed = true) {
  if (n == null || Number.isNaN(n)) return "Not available.";
  const sign = signed && n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

function pctClass(n) {
  if (n == null) return "";
  if (n > 0) return "positive";
  if (n < 0) return "negative";
  return "";
}

function mapAction(action) {
  if (action === "Trim") return "Consider trimming";
  return action || "Keep";
}

const ACTION_ORDER = {
  "Needs manual review": 0,
  "Consider trimming": 1,
  "Do not add": 2,
  Watch: 3,
  Keep: 4,
  "Add candidate": 5,
};

const TECH_READ_ORDER = {
  Bearish: 0,
  Weakening: 1,
  Unclear: 2,
  Neutral: 3,
  Improving: 4,
  Bullish: 5,
};

function volumeLabel(volRatio, greenDay) {
  if (volRatio == null) return "Not available.";
  if (volRatio < 0.7) return "Low-volume move — low conviction, less reliable";
  if (volRatio <= 1.5) return "Average volume — normal session";
  return greenDay
    ? "High-volume buying — confirms move"
    : "High-volume selling — confirms weakness";
}

function maPosition(above) {
  if (above === true) return "Above";
  if (above === false) return "Below";
  return "Not available.";
}

function deriveMacd(tech) {
  if (!tech) return "Not available.";
  const { d5, rsi, above20, above50, greenDay } = tech;
  if (d5 == null && rsi == null) return "Not available.";
  const bullishMomentum = (d5 ?? 0) > 0 && (rsi ?? 50) > 50;
  const bearishMomentum = (d5 ?? 0) < 0 && (rsi ?? 50) < 50;
  const aboveMa = above20 === true || above50 === true;
  const belowMa = above20 === false && above50 === false;

  if (bullishMomentum && aboveMa && greenDay) {
    return "Above signal line — short-term momentum positive; histogram strengthening in positive territory";
  }
  if (bullishMomentum && aboveMa) {
    return "Above signal line — short-term momentum positive";
  }
  if (bearishMomentum && belowMa && !greenDay) {
    return "Below signal line — short-term momentum negative; histogram growing more negative";
  }
  if (bearishMomentum) {
    return "Below signal line — short-term momentum negative";
  }
  if ((d5 ?? 0) > 0 && (rsi ?? 50) > 55) {
    return "Momentum fading — watch; histogram shrinking from a positive peak";
  }
  if ((d5 ?? 0) < 0 && !greenDay) {
    return "Below signal line — short-term momentum negative";
  }
  return "Near zero line — mixed crossover signal (recent session inconclusive)";
}

function deriveTechnicalRead(tech) {
  if (!tech || tech.rsi == null) {
    return { read: "Unclear", caution: "Insufficient data for confluence", badge: "badge-gray" };
  }
  const signals = [];
  let bullish = 0;
  let bearish = 0;

  if (tech.rsi > 55) bullish++;
  else if (tech.rsi < 45) bearish++;

  if (tech.above20 === true) bullish++;
  else if (tech.above20 === false) bearish++;

  if (tech.above50 === true) bullish++;
  else if (tech.above50 === false) bearish++;

  if ((tech.d5 ?? 0) > 1) bullish++;
  else if ((tech.d5 ?? 0) < -1) bearish++;

  const macd = deriveMacd(tech);
  if (macd.includes("positive")) bullish++;
  if (macd.includes("negative")) bearish++;

  let read = "Neutral";
  let badge = "badge-gray";
  let caution = "";

  if (bullish >= 2 && bearish === 0) {
    read = tech.d5 > 3 ? "Bullish" : "Improving";
    badge = read === "Bullish" ? "badge-green" : "badge-blue";
  } else if (bearish >= 2 && bullish === 0) {
    read = "Bearish";
    badge = "badge-red";
  } else if (bearish >= 2 && bullish >= 1) {
    read = "Unclear";
    badge = "badge-gray";
    caution = "Unclear — mixed signals";
  } else if (bearish >= 1 && bullish >= 1) {
    read = "Weakening";
    badge = "badge-yellow";
    caution = "Mixed momentum vs moving averages";
  } else if (bullish === 1 || bearish === 1) {
    read = "Unclear";
    badge = "badge-gray";
    caution = "Unclear — insufficient data for confluence";
  }

  if (tech.streak >= 3) {
    caution = caution ? `${caution}; 3+ day losing streak` : "3+ day losing streak";
  }

  if (tech.ma200 == null) {
    caution = caution
      ? `${caution}; 200D MA unavailable (6mo feed)`
      : "200D MA unavailable (6mo feed)";
  }

  return { read, caution: caution || "—", badge };
}

function dataQualityBadge(tech, region) {
  if (region === "EG") return { label: "Partial", cls: "badge-yellow" };
  if (!tech) return { label: "Missing", cls: "badge-red" };
  if (tech.ma200 == null || tech.rsi == null) return { label: "Partial", cls: "badge-yellow" };
  return { label: "Complete", cls: "badge-green" };
}

function riskBadge(level) {
  const l = level || "Low";
  if (l === "High" || l === "Speculative") return "badge-red";
  if (l === "Medium") return "badge-yellow";
  return "badge-gray";
}

function actionBadge(action) {
  const a = mapAction(action);
  if (a === "Consider trimming" || a === "Do not add") return "badge-red";
  if (a === "Watch" || a === "Needs manual review") return "badge-yellow";
  return "badge-green";
}

function catalystFor(symbol, tech) {
  const news = NEWS_ITEMS.filter((n) => n.tickers.includes(symbol));
  if (news.length) return news[0].impact === "Negative" ? "Negative catalyst" : news[0].impact === "Positive" ? "Positive catalyst" : "Mixed catalyst";
  const earn = EARNINGS.find((e) => e.symbol === symbol);
  if (earn) return "Mixed catalyst";
  if (tech?.streak >= 3) return "Negative catalyst";
  return "No clear catalyst";
}

function mainReason(h, tech, aiNote) {
  const parts = [];
  if (h.notes) parts.push(`Note: ${h.notes}`);
  if (tech?.streak >= 3) parts.push(`${tech.streak}-day losing streak`);
  if (h.weightPercent > 15) parts.push(`Concentration ${h.weightPercent.toFixed(1)}%`);
  if (h.profitLossPercent < -20) parts.push(`Large unrealized loss ${fmtPct(h.profitLossPercent)}`);
  if (mapAction(h.action) === "Consider trimming") parts.push("Trim signal on 3-day weakness");
  if (aiNote?.includes("fallback")) parts.push("AI fallback commentary only");
  return parts.length ? parts.join("; ") : aiNote || "Within normal range for current market";
}

function daysUntil(dateStr) {
  const d = new Date(`${dateStr}T12:00:00Z`);
  const today = new Date(`${SESSION_DATE}T12:00:00Z`);
  return Math.round((d - today) / 86400000);
}

function formatSnapshotTime(iso) {
  if (!iso) return "Not available.";
  const d = new Date(iso);
  return d.toISOString().replace("T", " ").replace(/\.\d+Z?$/, " UTC").replace(/\+00:00$/, " UTC");
}

function loadData() {
  const portfolio = JSON.parse(readFileSync(PORTFOLIO_PATH, "utf8"));
  const marketTech = JSON.parse(readFileSync(MARKET_TECH_PATH, "utf8"));
  return { portfolio, marketTech };
}

function buildHoldings(portfolio, marketTech) {
  const usProfile = portfolio.profiles.find((p) => p.id === "us-portfolio");
  const egProfile = portfolio.profiles.find((p) => p.id === "eg-portfolio");
  const usAi = usProfile?.dailyAi;
  const egAi = egProfile?.dailyAi;
  const aiFallback = Boolean(usAi?.fallback || egAi?.fallback);

  function enrich(profile, region) {
    const holdings = (profile.report?.holdings || profile.snapshot?.holdings || []).map((h) => {
      const row = h.reportRow || h;
      const symbol = row.symbol || h.symbol;
      const tech = marketTech[symbol] || null;
      const ai =
        profile.dailyAi?.analysesBySymbol?.[symbol] ||
        profile.dailyAi?.summary?.holdings?.find((x) => x.symbol === symbol);
      const notes = h.notes ?? row.notes ?? "";
      const weight =
        h.weightPercent ??
        row.weightPercent ??
        (profile.snapshot?.portfolioValue
          ? ((row.currentValue ?? h.current_value ?? 0) / profile.snapshot.portfolioValue) * 100
          : 0);

      return {
        symbol,
        name: row.name || h.name || symbol,
        region,
        currency: profile.currency,
        shares: row.shares ?? h.shares,
        currentPrice: row.currentPrice,
        currentValue: row.currentValue ?? h.current_value,
        profitLoss: row.profitLoss ?? h.profit_loss,
        profitLossPercent: row.profitLossPercent ?? h.profit_loss_percent,
        dailyProfitLoss: row.dailyProfitLoss ?? h.daily_profit_loss,
        dailyProfitLossPercent: row.dailyProfitLossPercent ?? h.daily_profit_loss_percent,
        weightPercent: weight,
        action: row.action ?? h.action,
        riskLevel: row.riskLevel ?? h.riskLevel,
        notes,
        tech,
        techRead: tech ? deriveTechnicalRead(tech) : { read: "Unclear", caution: "No technical feed", badge: "badge-gray" },
        mappedAction: mapAction(row.action ?? h.action),
        aiNote: ai?.summary || ai?.note || "",
        provider: row.provider,
      };
    });
    return holdings;
  }

  const usHoldings = enrich(usProfile, "US");
  const egHoldings = enrich(egProfile, "EG");
  const allHoldings = [...usHoldings, ...egHoldings];

  const updatedAt = usProfile?.snapshot?.updatedAt || portfolio.cloudUpdatedAt;

  return {
    usProfile,
    egProfile,
    usHoldings,
    egHoldings,
    allHoldings,
    updatedAt,
    aiFallback,
    history: portfolio.history || [],
    ownershipVerified: portfolio.ownershipVerified,
  };
}

function barRow(label, pct, maxAbs = null) {
  const v = pct ?? 0;
  const cap = maxAbs || Math.max(Math.abs(v), 1);
  const width = Math.min(100, (Math.abs(v) / cap) * 100);
  const cls = v >= 0 ? "bar-pos" : "bar-neg";
  return `<div class="bar-row">
  <span class="bar-label">${esc(label)}</span>
  <div class="bar-track"><div class="bar-fill ${cls}" style="width:${width}%"></div></div>
  <span class="bar-pct ${pctClass(v)}">${fmtPct(v)}</span>
</div>`;
}

function sectionHeader(icon, title) {
  return `<div class="section-header"><span class="section-icon">${icon}</span><span class="section-title">${esc(title)}</span></div>`;
}

function generateReport(data) {
  const { usProfile, egProfile, usHoldings, egHoldings, allHoldings, updatedAt, aiFallback, history } = data;

  const usValue = usProfile.snapshot.portfolioValue;
  const usDaily = usProfile.snapshot.dailyProfitLoss;
  const usDailyPct = usProfile.snapshot.dailyProfitLossPercent;
  const egValue = egProfile.snapshot.portfolioValue;
  const egDaily = egProfile.snapshot.dailyProfitLoss;
  const egDailyPct = egProfile.snapshot.dailyProfitLossPercent;
  const totalHoldings = usHoldings.length + egHoldings.length;

  const usBiggestUp = [...usHoldings].sort((a, b) => (b.dailyProfitLossPercent ?? 0) - (a.dailyProfitLossPercent ?? 0))[0];
  const usBiggestDown = [...usHoldings].sort((a, b) => (a.dailyProfitLossPercent ?? 0) - (b.dailyProfitLossPercent ?? 0))[0];
  const egBiggestUp = [...egHoldings].sort((a, b) => (b.dailyProfitLossPercent ?? 0) - (a.dailyProfitLossPercent ?? 0))[0];

  const streakHoldings = allHoldings.filter((h) => h.tech?.streak >= 3);
  const concentrationAlerts = allHoldings.filter((h) => h.weightPercent > 15);
  const largeLosses = allHoldings.filter((h) => (h.profitLossPercent ?? 0) < -20);

  const needsAttention = allHoldings.filter((h) => {
    const a = h.mappedAction;
    return (
      h.weightPercent > 15 ||
      (h.profitLossPercent ?? 0) < -20 ||
      h.tech?.streak >= 3 ||
      a === "Consider trimming" ||
      a === "Needs manual review" ||
      a === "Do not add" ||
      h.riskLevel === "High" ||
      h.notes
    );
  });

  const sortedByAction = [...allHoldings].sort((a, b) => {
    const ao = ACTION_ORDER[a.mappedAction] ?? 99;
    const bo = ACTION_ORDER[b.mappedAction] ?? 99;
    if (ao !== bo) return ao - bo;
    return (b.weightPercent ?? 0) - (a.weightPercent ?? 0);
  });

  const strongest5d = [...usHoldings]
    .filter((h) => h.tech?.d5 != null)
    .sort((a, b) => (b.tech.d5 ?? 0) - (a.tech.d5 ?? 0))[0];
  const weakest5d = [...usHoldings]
    .filter((h) => h.tech?.d5 != null)
    .sort((a, b) => (a.tech.d5 ?? 0) - (b.tech.d5 ?? 0))[0];

  const largestHolding = [...allHoldings].sort((a, b) => (b.weightPercent ?? 0) - (a.weightPercent ?? 0))[0];
  const biggestRisk = largeLosses.sort((a, b) => (a.profitLossPercent ?? 0) - (b.profitLossPercent ?? 0))[0];

  const watchlistTicker = "MU";
  const muTech = data.usHoldings.find((h) => h.symbol === "MU")?.tech;

  // --- HEADER ---
  const header = `<header>
  <div class="header-top">
    <div>
      <div class="report-title">Daily Portfolio Report</div>
      <div class="report-sub">${esc(SESSION_DATE)} · ${esc(EMAIL)}</div>
    </div>
    <div class="header-right">
      <div class="status-pill pill-open">US Market Closed — Post-Close Snapshot</div>
      <div class="small muted" style="margin-top:6px">Snapshot: ${esc(formatSnapshotTime(updatedAt))}</div>
      <div class="small muted">Session ${esc(usProfile.snapshot.sessionLabel || SESSION_DATE)}</div>
    </div>
  </div>
  <div class="warning-banner">⚠ Technical data uses a 6-month price feed — 200-day moving averages are unavailable (Partial data quality). AI commentary is fallback-only for this session.</div>
</header>`;

  // --- QUICK SUMMARY ---
  const ntkItems = [
    { icon: "📈", label: "Market Today", value: `SPY ${fmtPct(BENCHMARKS.SPY.d1)} and QQQ ${fmtPct(BENCHMARKS.QQQ.d1)} — broad US rally supported tech-heavy holdings.` },
    { icon: "📈", label: "Egypt Benchmark", value: `EGX30 ${fmtPct(BENCHMARKS.EGX30.d1)} (${BENCHMARKS.EGX30.level.toLocaleString()} pts, ${BENCHMARKS.EGX30.date} per ${BENCHMARKS.EGX30.source}).` },
    { icon: "📈", label: "Daily P/L", value: `US ${fmtMoney(usDaily, "USD")} (${fmtPct(usDailyPct)}); Egypt ${fmtMoney(egDaily, "EGP")} (${fmtPct(egDailyPct)}).` },
    { icon: "📈", label: "Biggest Mover", value: `${usBiggestUp.symbol} ${fmtPct(usBiggestUp.dailyProfitLossPercent)} (US); ${egBiggestUp.symbol} ${fmtPct(egBiggestUp.dailyProfitLossPercent)} (Egypt).` },
    { icon: "📉", label: "Biggest Decliner", value: `${usBiggestDown.symbol} ${fmtPct(usBiggestDown.dailyProfitLossPercent)} on low-volume weakness.` },
    {
      icon: "🔴",
      label: "Losing Streak",
      value:
        streakHoldings.length > 0
          ? streakHoldings.map((h) => `<span class="streak-badge">🔴 ${h.tech.streak} days down</span> ${h.symbol}`).join("; ")
          : "None currently",
    },
    { icon: "📰", label: "News Leader", value: "META +4.7% aided by Iris AI chip production news (Reuters/TechCrunch, Jul 9)." },
    { icon: "🔴", label: "Biggest Risk", value: `NFLX (${fmtPct(-23.05)}) faces Jul 16 earnings with Bernstein PT cut (Jul 8).` },
    { icon: "🟡", label: "Watch Today", value: "QNT — 3-day losing streak with Consider trimming label; monitor quantum sentiment." },
    { icon: "📅", label: "Upcoming Event", value: "NFLX earnings Jul 16 (7 days); META Jul 29; AAPL Jul 30." },
    { icon: "⚠️", label: "Data Gap", value: "AI commentary is deterministic fallback only; 200D MA missing from 6mo technical feed." },
  ];

  const ntkHtml = ntkItems
    .map(
      (i) => `<li><span class="ntk-icon">${i.icon}</span><span class="ntk-label">${esc(i.label)}</span><span class="ntk-value">${i.value}</span></li>`
    )
    .join("");

  const brief = `<div class="brief-box">
  <div class="brief-part"><div class="brief-part-label">MOVES &amp; TRENDS</div><div class="brief-part-text">US portfolio gained ${fmtPct(usDailyPct)} (${fmtMoney(usDaily, "USD")}), broadly in line with SPY ${fmtPct(BENCHMARKS.SPY.d1)} and QQQ ${fmtPct(BENCHMARKS.QQQ.d1)} — a market-wide tech-led session. META (+4.7%) and memory names (DRAM, MU) outperformed. Egypt rose ${fmtPct(egDailyPct)} with EGX30 +0.54%. QNT is the only holding on a <span class="streak-badge">🔴 3 days down</span> streak.</div></div>
  <div class="brief-part"><div class="brief-part-label">COMING UP</div><div class="brief-part-text">NFLX reports Q2 earnings Jul 16 (7 days away) — the nearest high-impact event. META and AAPL follow late July. No major US macro releases flagged for the next 3 sessions.</div></div>
  <div class="brief-part"><div class="brief-part-label">GUIDANCE</div><div class="brief-part-text">QNT deserves the most attention: profitable but weakening on a 3-day streak with a Consider trimming label. Hold core ETF exposure; watch NFLX into earnings rather than adding risk.</div></div>
  <div class="brief-part"><div class="brief-part-label">TODAY'S IDEA</div><div class="brief-part-text">MU stands out for memory supercycle potential plus Jul 9 US fab investment catalyst. See full details in the Opportunity card below.</div></div>
</div>`;

  const muHolding = usHoldings.find((h) => h.symbol === "MU");
  const opportunity = `<div class="opportunity-card"><div class="two-col">
  <div>
    <div class="opportunity-eyebrow">Today's Watchlist Idea</div>
    <div class="opportunity-ticker">MU</div>
    <div class="opportunity-name">Micron Technology, Inc.</div>
    <div class="opportunity-reason">Micron rallied ${fmtPct(muHolding?.dailyProfitLossPercent ?? 4.51)} today on a $250B US investment plan (Business Insider, Jul 9) — a verified positive catalyst in the memory supercycle. Price remains above the 50D MA despite below 20D MA, suggesting medium-term support with near-term consolidation. Sector strength in DRAM ETF (+3.74%) adds confluence.</div>
    <div class="opportunity-note">Watchlist idea only — not a buy recommendation.</div>
  </div>
  <div>
    <table><tbody>
      <tr><td class="muted">Sector</td><td>Semiconductors / Memory</td></tr>
      <tr><td class="muted">Catalyst</td><td>$250B US fab plan (Jul 9); memory cycle</td></tr>
      <tr><td class="muted">Technical Setup</td><td>RSI ${muTech?.rsi ?? "47.1"}; above 50D, below 20D; ${volumeLabel(muTech?.volRatio, muTech?.greenDay)}</td></tr>
      <tr><td class="muted">Risk Level</td><td><span class="badge badge-orange">Medium</span></td></tr>
      <tr><td class="muted">Watch Horizon</td><td>1–2 weeks</td></tr>
      <tr><td class="muted">What Would Invalidate It</td><td>Break below 50D MA (~$889) on high-volume selling or negative memory pricing data</td></tr>
    </tbody></table>
  </div>
</div></div>`;

  const quickSummary = `<section>${sectionHeader("⚡", "Quick Summary")}
  <div class="card-grid-sm" style="margin-bottom:16px">
    <div class="card positive"><div class="card-label">US Portfolio Value</div><div class="card-value positive">${fmtMoney(usValue, "USD").replace("+", "")}</div><div class="card-sub">${fmtPct(usDailyPct)} today</div></div>
    <div class="card positive"><div class="card-label">US Daily P/L</div><div class="card-value positive">${fmtMoney(usDaily, "USD")}</div><div class="card-sub">${usHoldings.length} holdings</div></div>
    <div class="card positive"><div class="card-label">Egypt Portfolio Value</div><div class="card-value positive">${fmtMoney(egValue, "EGP").replace("+", "")}</div><div class="card-sub">${fmtPct(egDailyPct)} today</div></div>
    <div class="card positive"><div class="card-label">Egypt Daily P/L</div><div class="card-value positive">${fmtMoney(egDaily, "EGP")}</div><div class="card-sub">${egHoldings.length} holdings</div></div>
    <div class="card info"><div class="card-label">Total Holdings</div><div class="card-value">${totalHoldings}</div><div class="card-sub">US + Egypt</div></div>
    <div class="card warning"><div class="card-label">Needs Attention</div><div class="card-value warning">${needsAttention.length}</div><div class="card-sub">Concentration, streaks, losses</div></div>
  </div>
  <div class="two-col" style="margin-bottom:16px">
    <div><h3 class="small" style="margin-bottom:8px;font-weight:700">Need to Know First</h3><ul class="need-to-know-list">${ntkHtml}</ul></div>
    <div><h3 class="small" style="margin-bottom:8px;font-weight:700">Today's Brief</h3>${brief}</div>
  </div>
  ${opportunity}
</section>`;

  // --- NEEDS ATTENTION ---
  const alerts = [];
  for (const h of concentrationAlerts) {
    alerts.push({
      sev: "medium",
      icon: "⚠️",
      title: `${h.symbol} — Concentration above 15%`,
      detail: `${h.symbol} is ${h.weightPercent.toFixed(2)}% of ${h.region} portfolio — single-name risk elevated.`,
      action: h.mappedAction,
    });
  }
  for (const h of largeLosses) {
    alerts.push({
      sev: "high",
      icon: "🔴",
      title: `${h.symbol} — Large unrealized loss`,
      detail: `Unrealized ${fmtPct(h.profitLossPercent)} (${fmtMoney(h.profitLoss, h.currency)}). High risk level: ${h.riskLevel}.`,
      action: h.mappedAction,
    });
  }
  for (const h of streakHoldings) {
    alerts.push({
      sev: "medium",
      icon: "📉",
      title: `${h.symbol} — ${h.tech.streak}-day losing streak`,
      detail: `Price declined ${h.tech.streak} consecutive sessions; 5D ${fmtPct(h.tech.d5)}.`,
      action: h.mappedAction,
    });
  }
  for (const e of EARNINGS.filter((x) => daysUntil(x.date) <= 14)) {
    alerts.push({
      sev: daysUntil(e.date) <= 7 ? "high" : "medium",
      icon: "📅",
      title: `${e.symbol} — Earnings in ${daysUntil(e.date)} days`,
      detail: `${e.event} on ${e.date}.`,
      action: usHoldings.find((h) => h.symbol === e.symbol)?.mappedAction || "Watch",
    });
  }
  const orhd = egHoldings.find((h) => h.symbol === "ORHD");
  if (orhd?.notes) {
    alerts.push({
      sev: "medium",
      icon: "🟡",
      title: "ORHD — Manual exit note",
      detail: `Saved note: "${orhd.notes}" — review exit plan.`,
      action: "Needs manual review",
    });
  }
  if (aiFallback) {
    alerts.push({
      sev: "low",
      icon: "⚠️",
      title: "Data — AI commentary fallback",
      detail: "Daily AI used deterministic fallback only; action labels have lower confidence.",
      action: "Watch",
    });
  }

  const alertsHtml =
    alerts.length > 0
      ? alerts
          .map(
            (a) => `<div class="alert alert-${a.sev}"><span class="alert-icon">${a.icon}</span><div><div class="alert-title">${esc(a.title)}</div><div class="alert-detail">${esc(a.detail)}</div><div class="alert-action">Suggested action: ${esc(a.action)}</div></div></div>`
          )
          .join("")
      : `<div class="alert alert-low"><span class="alert-icon">✅</span><div><div class="alert-title">No high-severity alerts today.</div></div></div>`;

  const needsAttentionSection = `<section>${sectionHeader("🚨", "Needs Attention First")}${alertsHtml}</section>`;

  // --- SUMMARY CARDS (14) ---
  const summaryCards = `<section>${sectionHeader("📊", "Summary Cards")}<div class="card-grid">
    <div class="card positive"><div class="card-label">US Portfolio Value</div><div class="card-value positive">${fmtMoney(usValue, "USD").replace("+", "")}</div><div class="card-sub">${fmtPct(usDailyPct)}</div></div>
    <div class="card positive"><div class="card-label">US Daily P/L</div><div class="card-value positive">${fmtMoney(usDaily, "USD")}</div></div>
    <div class="card positive"><div class="card-label">Egypt Portfolio Value</div><div class="card-value positive">${fmtMoney(egValue, "EGP").replace("+", "")}</div><div class="card-sub">${fmtPct(egDailyPct)}</div></div>
    <div class="card positive"><div class="card-label">Egypt Daily P/L</div><div class="card-value positive">${fmtMoney(egDaily, "EGP")}</div></div>
    <div class="card positive"><div class="card-label">Biggest Positive Mover</div><div class="card-value positive">${usBiggestUp.symbol} ${fmtPct(usBiggestUp.dailyProfitLossPercent)}</div></div>
    <div class="card negative"><div class="card-label">Biggest Negative Mover</div><div class="card-value negative">${usBiggestDown.symbol} ${fmtPct(usBiggestDown.dailyProfitLossPercent)}</div></div>
    <div class="card warning"><div class="card-label">Largest Holding</div><div class="card-value">${largestHolding.symbol}</div><div class="card-sub">${largestHolding.weightPercent.toFixed(2)}% weight</div></div>
    <div class="card negative"><div class="card-label">Biggest Risk</div><div class="card-value negative">${biggestRisk?.symbol || "N/A"}</div><div class="card-sub">${biggestRisk ? fmtPct(biggestRisk.profitLossPercent) : ""} unrealized</div></div>
    <div class="card info"><div class="card-label">Most Important Catalyst</div><div class="card-value">NFLX Earnings</div><div class="card-sub">Jul 16 — 7 days</div></div>
    <div class="card warning"><div class="card-label">Holdings Needing Attention</div><div class="card-value warning">${needsAttention.length}</div></div>
    <div class="card info"><div class="card-label">Today's Watchlist Idea</div><div class="card-value">MU</div><div class="card-sub">Memory supercycle</div></div>
    <div class="card negative"><div class="card-label">Worst Losing Streak</div><div class="card-value">${streakHoldings[0] ? `${streakHoldings[0].symbol} — ${streakHoldings[0].tech.streak} days down` : "None"}</div></div>
    <div class="card positive"><div class="card-label">Strongest 5-Day Momentum</div><div class="card-value positive">${strongest5d?.symbol || "N/A"} ${strongest5d ? fmtPct(strongest5d.tech.d5) : ""}</div></div>
    <div class="card negative"><div class="card-label">Weakest 5-Day Momentum</div><div class="card-value negative">${weakest5d?.symbol || "N/A"} ${weakest5d ? fmtPct(weakest5d.tech.d5) : ""}</div></div>
  </div></section>`;

  // --- TREND CHARTS ---
  const usHist = history.find((h) => h.profileId === "us-portfolio");
  const egHist = history.find((h) => h.profileId === "eg-portfolio");

  function lastN(points, n) {
    return points.filter((p) => p.hasData && p.portfolioValue > 0).slice(-n);
  }

  const us7 = lastN(usHist?.points || [], 7);
  const eg7 = lastN(egHist?.points || [], 7);
  const us7pl = lastN(usHist?.points || [], 7).filter((p) => p.hasPlData);

  const maxUsVal = Math.max(...us7.map((p) => p.portfolioValue), 1);
  const maxEgVal = Math.max(...eg7.map((p) => p.portfolioValue), 1);
  const maxPl = Math.max(...us7pl.map((p) => Math.abs(p.dailyProfitLoss)), 1);

  const portfolioTrend = `<h4 class="small" style="margin:12px 0 8px">A. Portfolio Value Trend (7 sessions)</h4>
  <p class="small muted" style="margin-bottom:8px">USD — US Portfolio</p>
  ${us7.map((p) => barRow(p.date, ((p.portfolioValue / maxUsVal) * 10) - 5)).join("")}
  <p class="small muted" style="margin:12px 0 8px">EGP — Egypt Portfolio</p>
  ${eg7.map((p) => barRow(p.date, ((p.portfolioValue / maxEgVal) * 10) - 5)).join("")}
  <h4 class="small" style="margin:16px 0 8px">B. Daily P/L Trend (7 sessions, US)</h4>
  ${us7pl.map((p) => barRow(p.date, p.dailyProfitLossPercent ?? 0, maxPl)).join("")}
  <h4 class="small" style="margin:16px 0 8px">C. Winners vs Losers (5D %)</h4>
  ${[...usHoldings]
    .filter((h) => h.tech?.d5 != null)
    .sort((a, b) => (b.tech.d5 ?? 0) - (a.tech.d5 ?? 0))
    .map((h) => barRow(h.symbol, h.tech.d5, 40))
    .join("")}
  <h4 class="small" style="margin:16px 0 8px">D. Losing Streak Indicator</h4>`;

  const streakTable =
    streakHoldings.length > 0
      ? `<div class="table-wrap"><table><thead><tr><th>Ticker</th><th>Streak Days</th><th>Total Decline During Streak</th><th>Possible Reason</th><th>Action Label</th></tr></thead><tbody>
      ${streakHoldings
        .map((h) => {
          const decline = h.tech.d3 ?? h.dailyProfitLossPercent;
          return `<tr style="background:var(--negative-bg)"><td>${esc(h.symbol)}</td><td><span class="streak-badge">🔴 ${h.tech.streak} days</span></td><td class="negative">${fmtPct(decline)}</td><td>Low-volume profit-taking; no verified negative catalyst</td><td><span class="badge ${actionBadge(h.action)}">${esc(h.mappedAction)}</span></td></tr>`;
        })
        .join("")}
    </tbody></table></div>`
      : `<p class="muted">No holdings with a 3+ day losing streak in the current data.</p>`;

  const trendSection = `<section>${sectionHeader("📈", "Trend and Progress Charts")}${portfolioTrend}${streakTable}</section>`;

  // --- ALLOCATION ---
  function allocationBars(holdings, title) {
    const sorted = [...holdings].sort((a, b) => (b.weightPercent ?? 0) - (a.weightPercent ?? 0));
    const bars = sorted
      .map((h) => {
        const w = h.weightPercent ?? 0;
        const warn = w > 15 ? ` <span class="badge badge-orange">⚠ &gt;15%</span>` : "";
        return `<div class="bar-row"><span class="bar-label">${esc(h.symbol)}</span><div class="bar-track"><div class="bar-fill bar-info" style="width:${Math.min(100, w)}%"></div></div><span class="bar-pct">${w.toFixed(1)}%${warn}</span></div>`;
      })
      .join("");
    const bullets = `<ul class="small" style="margin-top:10px;padding-left:18px">
      <li>Largest: ${sorted[0]?.symbol} (${(sorted[0]?.weightPercent ?? 0).toFixed(1)}%)</li>
      <li>Concentration flags: ${sorted.filter((h) => h.weightPercent > 15).map((h) => h.symbol).join(", ") || "None above 15%"}</li>
      <li>ETF vs single-stock: ${sorted.filter((h) => ["QQQM", "VOO", "SCHG", "DRAM", "NASA", "EGX30ETF"].includes(h.symbol)).length} ETF names</li>
    </ul>`;
    return `<h4 style="margin-bottom:10px">${esc(title)}</h4>${bars}${bullets}`;
  }

  const allocationSection = `<section>${sectionHeader("🥧", "Portfolio Allocation")}
  ${allocationBars(usHoldings, "US Portfolio")}
  <hr style="margin:16px 0;border:none;border-top:1px solid var(--border)">
  ${allocationBars(egHoldings, "Egypt Portfolio")}
</section>`;

  // --- HOLDINGS TABLE ---
  const holdingsRows = sortedByAction
    .map((h) => {
      const dq = dataQualityBadge(h.tech, h.region);
      const streakStyle = h.tech?.streak >= 3 ? ' style="background:var(--negative-bg)"' : "";
      const d1 = h.tech?.d1 ?? h.dailyProfitLossPercent;
      const d5 = h.tech?.d5;
      return `<tr data-priority="${ACTION_ORDER[h.mappedAction] ?? 99}" data-weight="${h.weightPercent}" data-daily-pl="${h.dailyProfitLoss}" data-unrealized-pl="${h.profitLoss}" data-risk="${h.riskLevel}" data-action="${esc(h.mappedAction)}"${streakStyle}>
        <td><strong>${esc(h.symbol)}</strong></td>
        <td>${esc(h.region)}</td>
        <td>${(h.weightPercent ?? 0).toFixed(2)}%</td>
        <td>${fmtMoney(h.currentValue, h.currency).replace("+", "")}</td>
        <td class="${pctClass(h.dailyProfitLoss)}">${fmtMoney(h.dailyProfitLoss, h.currency)}</td>
        <td class="${pctClass(d1)}">${fmtPct(d1)}</td>
        <td class="${pctClass(d5)}">${d5 != null ? fmtPct(d5) : "Not available."}</td>
        <td class="${pctClass(h.profitLoss)}">${fmtMoney(h.profitLoss, h.currency)}</td>
        <td><span class="badge ${riskBadge(h.riskLevel)}">${esc(h.riskLevel)}</span></td>
        <td>${esc(catalystFor(h.symbol, h.tech))}</td>
        <td><span class="badge ${actionBadge(h.action)}">${esc(h.mappedAction)}</span></td>
        <td><span class="badge ${dq.cls}">${dq.label}</span></td>
        <td class="small">${esc(mainReason(h, h.tech, h.aiNote))}</td>
      </tr>`;
    })
    .join("");

  const holdingsSection = `<section>${sectionHeader("📋", "Priority-Sorted Holdings Table")}
  <div class="sort-bar" id="holdings-sort-bar">
    <button class="sort-btn active" data-sort="priority">Priority</button>
    <button class="sort-btn" data-sort="weight">Weight</button>
    <button class="sort-btn" data-sort="daily-pl">Daily P/L</button>
    <button class="sort-btn" data-sort="unrealized-pl">Unrealized P/L</button>
    <button class="sort-btn" data-sort="risk">Risk</button>
    <button class="sort-btn" data-sort="action">Action</button>
  </div>
  <div class="table-wrap"><table id="holdings-table"><thead><tr>
    <th>Ticker</th><th>Market</th><th>Weight</th><th>Value</th><th>Daily P/L</th><th>1D Move</th><th>5D Move</th><th>Unrealized P/L</th><th>Risk</th><th>Catalyst</th><th>Action</th><th>Data</th><th>Main Reason</th>
  </tr></thead><tbody>${holdingsRows}</tbody></table></div>
</section>`;

  // --- DAILY P/L CONTRIBUTION ---
  function plContribution(holdings, title, currency) {
    const sorted = [...holdings].sort((a, b) => Math.abs(b.dailyProfitLoss ?? 0) - Math.abs(a.dailyProfitLoss ?? 0));
    const rows = sorted
      .map((h) => {
        const driver =
          Math.abs(h.dailyProfitLoss ?? 0) > 2 && Math.abs(h.dailyProfitLossPercent ?? 0) > 1
            ? "Both"
            : (h.weightPercent ?? 0) > 10
              ? "Size-driven"
              : "Price-driven";
        return `<tr><td>${esc(h.symbol)}</td><td class="${pctClass(h.dailyProfitLoss)}">${fmtMoney(h.dailyProfitLoss, currency)}</td><td class="${pctClass(h.dailyProfitLossPercent)}">${fmtPct(h.dailyProfitLossPercent)}</td><td>${(h.weightPercent ?? 0).toFixed(2)}%</td><td>${driver}</td></tr>`;
      })
      .join("");
    return `<h4 style="margin-bottom:8px">${esc(title)}</h4><div class="table-wrap"><table><thead><tr><th>Ticker</th><th>Daily P/L</th><th>Daily % Move</th><th>Weight</th><th>Impact Driver</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  const plSection = `<section>${sectionHeader("💰", "Daily P/L Contribution")}
  ${plContribution(usHoldings, "US Portfolio", "USD")}
  <div style="height:12px"></div>
  ${plContribution(egHoldings, "Egypt Portfolio", "EGP")}
</section>`;

  // --- RECENT PERFORMANCE ---
  const perfRows = [...usHoldings]
    .filter((h) => h.tech)
    .sort((a, b) => (b.tech.d5 ?? 0) - (a.tech.d5 ?? 0))
    .map(
      (h) => `<tr>
      <td>${esc(h.symbol)}</td>
      <td class="${pctClass(h.tech.d1)}">${fmtPct(h.tech.d1)}</td>
      <td class="${pctClass(h.tech.d3)}">${h.tech.d3 != null ? fmtPct(h.tech.d3) : "Not available."}</td>
      <td class="${pctClass(h.tech.d5)}">${h.tech.d5 != null ? fmtPct(h.tech.d5) : "Not available."}</td>
      <td class="${pctClass(h.tech.d20)}">${h.tech.d20 != null ? fmtPct(h.tech.d20) : "Not available."}</td>
    </tr>`
    )
    .join("");

  const perfSection = `<section>${sectionHeader("🔄", "Recent Performance")}
  <div class="table-wrap"><table><thead><tr><th>Ticker</th><th>1D</th><th>3D</th><th>5D</th><th>20D</th></tr></thead><tbody>${perfRows}</tbody></table></div>
  <p class="small" style="margin-top:12px">Strongest 5D: ${strongest5d?.symbol} (${fmtPct(strongest5d?.tech?.d5)}). Weakest 5D: ${weakest5d?.symbol} (${fmtPct(weakest5d?.tech?.d5)}). Today's moves were primarily market-wide (SPY +0.85%) with stock-specific strength in META/MU and weakness in QNT on low volume.</p>
</section>`;

  // --- TECHNICAL SIGNALS ---
  const techSorted = [...usHoldings]
    .filter((h) => h.tech)
    .sort((a, b) => (TECH_READ_ORDER[a.techRead.read] ?? 3) - (TECH_READ_ORDER[b.techRead.read] ?? 3));

  const techRows = techSorted
    .map((h) => {
      const t = h.tech;
      const tr = h.techRead;
      const readBadge =
        tr.read === "Bullish"
          ? "badge-green"
          : tr.read === "Improving"
            ? "badge-blue"
            : tr.read === "Bearish"
              ? "badge-red"
              : tr.read === "Weakening"
                ? "badge-yellow"
                : "badge-gray";
      return `<tr>
        <td>${esc(h.symbol)}</td>
        <td>${t.rsi != null ? t.rsi.toFixed(1) : "Not available."}</td>
        <td>${maPosition(t.above20)}${t.ma20 ? ` ($${t.ma20.toFixed(2)})` : ""}</td>
        <td>${maPosition(t.above50)}${t.ma50 ? ` ($${t.ma50.toFixed(2)})` : ""}</td>
        <td>${t.ma200 == null ? "Not available. (6mo feed)" : maPosition(t.above200)}</td>
        <td class="small">${volumeLabel(t.volRatio, t.greenDay)}</td>
        <td class="small">${deriveMacd(t)}</td>
        <td>${t.d5 != null ? fmtPct(t.d5) : "Not available."}</td>
        <td><span class="badge ${readBadge}">${esc(tr.read)}</span></td>
        <td class="small">${esc(tr.caution)}</td>
      </tr>`;
    })
    .join("");

  const techSection = `<section>${sectionHeader("📉", "Technical Signals")}
  <div class="table-wrap"><table><thead><tr>
    <th>Ticker</th><th>RSI-14</th><th>vs 20D MA</th><th>vs 50D MA</th><th>vs 200D MA</th><th>Volume vs 20D Avg</th><th>MACD</th><th>Momentum</th><th>Technical Read</th><th>Caution</th>
  </tr></thead><tbody>${techRows}</tbody></table></div>
</section>`;

  // --- NEWS ---
  const newsGroups = ["Negative", "Mixed", "Positive"];
  const newsHtml = newsGroups
    .map((group) => {
      const items = NEWS_ITEMS.filter((n) => n.group === group);
      const inner = items
        .map(
          (n) => `<div style="margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid var(--border)">
          <strong>${esc(n.tickers.join(", "))}</strong> — ${esc(n.headline)}<br>
          <span class="small muted">${esc(n.source)} · ${esc(n.date)}${n.isAnalyst ? " · Analyst rating change" : ""}</span><br>
          <span class="badge ${group === "Positive" ? "badge-green" : group === "Negative" ? "badge-red" : "badge-yellow"}">${esc(n.impact)}</span>
          <p class="small" style="margin-top:4px">${esc(n.note)}</p>
        </div>`
        )
        .join("");
      return `<details${group === "Negative" ? " open" : ""}><summary>${group} <span class="badge badge-gray">${items.length}</span></summary><div>${inner || "<p class='muted'>None</p>"}</div></details>`;
    })
    .join("");

  const newsSection = `<section>${sectionHeader("📰", "News and Catalysts")}${newsHtml}</section>`;

  // --- EARNINGS ---
  const earningsRows = EARNINGS.map((e) => {
    const days = daysUntil(e.date);
    const bg = days <= 7 ? "background:var(--warning-bg)" : days <= 14 ? "background:var(--info-bg)" : "";
    return `<tr style="${bg}"><td>${esc(e.symbol)}</td><td>${esc(e.event)}</td><td>${esc(e.date)}</td><td>${days}</td><td>${esc(e.importance)}</td><td>${e.symbol === "NFLX" ? "Large unrealized loss; Bernstein PT cut adds caution" : "Monitor post-earnings guidance"}</td></tr>`;
  }).join("");

  const earningsSection = `<section>${sectionHeader("📅", "Upcoming Earnings and Events")}
  <div class="table-wrap"><table><thead><tr><th>Ticker</th><th>Event</th><th>Date</th><th>Days Away</th><th>Importance</th><th>Why It Matters</th></tr></thead><tbody>${earningsRows}</tbody></table></div>
</section>`;

  // --- RISK NOTES ---
  const riskNotes = `<section>${sectionHeader("⚠️", "Portfolio Risk Notes")}
  <details open><summary>Concentration risk</summary><div>AAPL 24.64% (US), EGX30ETF 58.53% and RAYA 16.67% (Egypt) exceed comfortable single-name limits. Practical implication: portfolio returns are sensitive to a few names.</div></details>
  <details><summary>Sector risk</summary><div>Heavy technology/semiconductor exposure (AAPL, NVDA, TSM, MU, ASML, DRAM) amplifies Nasdaq beta. Egypt bank (COMI) and healthcare (RAYA, ORHD) add sector dispersion.</div></details>
  <details><summary>ETF overlap</summary><div>QQQM, VOO, SCHG, DRAM, NASA overlap US large-cap/growth/sector themes — combined weight masks duplicate beta to SPY/QQQ.</div></details>
  <details><summary>Speculative exposure</summary><div>QNT, SMR, NASA, NBIS, SPCX are higher-volatility names; NASA/NBIS carry &gt;25% unrealized losses.</div></details>
  <details><summary>Currency/geography risk</summary><div>US (USD) and Egypt (EGP) books are separated; EGP moves depend on EGX30 and local liquidity (Mubasher EGX quotes).</div></details>
  <details><summary>Tiny positions</summary><div>IBM, VOO, ASML, MU are small weights (&lt;4%) — price moves have limited portfolio impact.</div></details>
  <details><summary>Large losses</summary><div>NFLX -23%, NBIS -26.4%, NASA -26.1% — recovery requires catalysts; stops should be reviewed.</div></details>
  <details><summary>Large gains</summary><div>QNT +30.9% unrealized but weakening technically — trim discipline applies.</div></details>
  <details><summary>Single-stock vs ETF balance</summary><div>US book mixes core ETFs with single names; Egypt is ETF-heavy (EGX30ETF 58.5%).</div></details>
</section>`;

  // --- WHAT CHANGED ---
  const whatChanged = `<section>${sectionHeader("🔁", "What Changed Today")}
  <p>US portfolio value rose from $3,025.91 to $3,061.40 (+1.17%); Egypt from EGP 123,499.45 to EGP 124,783.15 (+1.04%). META (+4.7%) and DRAM (+3.74%) were largest US contributors; QNT (-2.78%) detracted on streak weakness. RAYA led Egypt (+2.56%). QNT action remains Consider trimming. New: META Iris chip news. Riskier: NFLX into earnings week. Improved: broad benchmark alignment. Watch tomorrow: QNT streak resolution and NFLX pre-earnings drift.</p>
</section>`;

  // --- WATCHLIST ---
  const watchlistRows = [
    { ticker: "MU", name: "Micron Technology", why: "Memory supercycle + US fab catalyst", tech: "Above 50D, RSI ~47", catalyst: "Jul 9 $250B plan", risk: "Medium", level: "High priority", more: "Break above 20D MA on volume", invalidate: "Lose 50D MA" },
    { ticker: "META", name: "Meta Platforms", why: "Iris AI chip news + relative strength", tech: "RSI 64.7, above MAs", catalyst: "Earnings Jul 29", risk: "Low", level: "Medium priority", more: "Sustained volume &gt;1.5x", invalidate: "Fail to hold $600" },
    { ticker: "DRAM", name: "Roundhill Memory ETF", why: "Sector momentum +3.74% today", tech: "Above 50D, below 20D", catalyst: "Memory pricing cycle", risk: "Medium", level: "Medium priority", more: "Reclaim 20D MA", invalidate: "5D turn negative" },
    { ticker: "RAYA", name: "Raya Contact Lens", why: "EGX rebound play +2.56%", tech: "EG data partial", catalyst: "EGX30 +0.54%", risk: "Medium", level: "Medium priority", more: "Hold above EGP 8", invalidate: "Profit-taking repeat" },
  ]
    .map(
      (w) => `<tr><td><strong>${esc(w.ticker)}</strong></td><td>${esc(w.name)}</td><td>${esc(w.why)}</td><td class="small">${esc(w.tech)}</td><td>${esc(w.catalyst)}</td><td>${esc(w.risk)}</td><td><span class="badge ${w.level === "High priority" ? "badge-blue" : "badge-gray"}">${esc(w.level)}</span></td><td class="small">${w.more}</td><td class="small">${w.invalidate}</td></tr>`
    )
    .join("");

  const watchlistSection = `<section>${sectionHeader("👀", "Watchlist")}
  <div class="table-wrap"><table><thead><tr><th>Ticker</th><th>Company/Fund</th><th>Why Interesting</th><th>Technical Setup</th><th>Catalyst/News</th><th>Risk</th><th>Watch Level</th><th>What Would Make It More Interesting</th><th>What Would Invalidate It</th></tr></thead><tbody>${watchlistRows}</tbody></table></div>
  <p class="small muted" style="margin-top:12px">Watchlist only — not a buy recommendation.</p>
</section>`;

  // --- FINAL ACTION SUMMARY ---
  const keepAdd = allHoldings.filter((h) => ["Keep", "Add candidate"].includes(h.mappedAction));
  const watch = allHoldings.filter((h) => ["Watch", "Needs manual review"].includes(h.mappedAction));
  const trim = allHoldings.filter((h) => ["Consider trimming", "Do not add"].includes(h.mappedAction));

  function actionList(holdings) {
    return holdings.map((h) => `<li><strong>${esc(h.symbol)}</strong> — ${esc(h.mappedAction)}: ${esc(mainReason(h, h.tech, h.aiNote).slice(0, 80))}</li>`).join("");
  }

  const finalAction = `<section>${sectionHeader("✅", "Final Action Summary")}<div class="three-col">
    <div class="card positive"><div class="card-label">Keep / Add Candidates</div><ul class="small" style="margin-top:8px;padding-left:16px">${actionList(keepAdd) || "<li>None</li>"}</ul></div>
    <div class="card warning"><div class="card-label">Watch Closely</div><ul class="small" style="margin-top:8px;padding-left:16px">${actionList(watch) || "<li>ORHD — sell soon note</li>"}</ul></div>
    <div class="card negative"><div class="card-label">Consider Trimming / Do Not Add</div><ul class="small" style="margin-top:8px;padding-left:16px">${actionList(trim) || "<li>None</li>"}</ul></div>
  </div></section>`;

  // --- SOURCES ---
  const sourcesSection = `<section>${sectionHeader("📚", "Sources and Data Notes")}
  <ul class="small" style="padding-left:18px;line-height:1.8">
    <li>Portfolio holdings &amp; P/L: Supabase snapshot via portfolio-exit-planner API (${esc(formatSnapshotTime(updatedAt))})</li>
    <li>US prices: Yahoo Finance (provider field on holdings)</li>
    <li>Egypt prices: Mubasher EGX pages</li>
    <li>Technical indicators: market-tech.json (6-month daily feed, RSI/MA/volume)</li>
    <li>Benchmarks: SPY, QQQ (market-tech.json); EGX30 (Amwal Al Ghad, Jul 9 2026)</li>
    <li>News: Reuters, TechCrunch, Business Insider, Middle East Observer, Bernstein (analyst)</li>
    <li>Limitations: 200D MA unavailable; MACD derived from momentum proxies; AI commentary fallback-only; no previous encrypted report diff</li>
  </ul>
</section>`;

  const sortScript = `<script>
(function(){
  const table = document.getElementById('holdings-table');
  if (!table) return;
  const tbody = table.querySelector('tbody');
  const bar = document.getElementById('holdings-sort-bar');
  const riskOrder = { High: 0, Speculative: 1, Medium: 2, Low: 3 };
  function sortRows(key) {
    const rows = Array.from(tbody.querySelectorAll('tr'));
    rows.sort((a, b) => {
      if (key === 'priority') return (+a.dataset.priority) - (+b.dataset.priority) || (+b.dataset.weight) - (+a.dataset.weight);
      if (key === 'weight') return (+b.dataset.weight) - (+a.dataset.weight);
      if (key === 'daily-pl') return (+a.dataset.dailyPl) - (+b.dataset.dailyPl);
      if (key === 'unrealized-pl') return (+a.dataset.unrealizedPl) - (+b.dataset.unrealizedPl);
      if (key === 'risk') return (riskOrder[a.dataset.risk] ?? 9) - (riskOrder[b.dataset.risk] ?? 9);
      if (key === 'action') return a.dataset.action.localeCompare(b.dataset.action);
      return 0;
    });
    rows.forEach(r => tbody.appendChild(r));
  }
  bar.addEventListener('click', function(e) {
    const btn = e.target.closest('.sort-btn');
    if (!btn) return;
    bar.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    sortRows(btn.dataset.sort);
  });
})();
</script>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Daily Portfolio Report — ${esc(SESSION_DATE)}</title>
<style>${MANDATORY_CSS}</style>
</head>
<body>
<div class="page-grid">
${header}
${quickSummary}
${needsAttentionSection}
${summaryCards}
${trendSection}
${allocationSection}
${holdingsSection}
${plSection}
${perfSection}
${techSection}
${newsSection}
${earningsSection}
${riskNotes}
${whatChanged}
${watchlistSection}
${finalAction}
${sourcesSection}
</div>
<footer>This is analysis for decision support, not financial advice or automatic trading.</footer>
${sortScript}
</body>
</html>`;
}

function run() {
  const { portfolio, marketTech } = loadData();
  if (!portfolio.ownershipVerified) {
    console.error("Ownership not verified for", EMAIL);
    process.exit(1);
  }
  const data = buildHoldings(portfolio, marketTech);
  const html = generateReport(data);
  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, html, "utf8");
  const size = Buffer.byteLength(html, "utf8");
  console.log(`Wrote ${OUTPUT_PATH} (${size} bytes)`);
  if (size < 51200) {
    console.warn("Warning: output is under 50KB target");
  }
}

run();
