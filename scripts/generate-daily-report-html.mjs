#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";

const portfolio = JSON.parse(readFileSync("/tmp/portfolio-data.json", "utf8"));
const market = JSON.parse(readFileSync("/tmp/market-tech.json", "utf8"));

const SESSION = "2026-06-22";
const EMAIL = "danielhanna0001@gmail.com";
const usProfile = portfolio.profiles.find((p) => p.id === "us-portfolio");
const egProfile = portfolio.profiles.find((p) => p.id === "eg-portfolio");
function mergeHoldings(reportHoldings, snapshotHoldings) {
  const weightMap = Object.fromEntries(snapshotHoldings.map((h) => [h.symbol, h.weightPercent]));
  return reportHoldings.map((h) => ({ ...h, weightPercent: weightMap[h.symbol] ?? 0 }));
}
const usHoldings = mergeHoldings(usProfile.report.holdings, usProfile.snapshot.holdings);
const egHoldings = mergeHoldings(egProfile.report.holdings, egProfile.snapshot.holdings);

function fmtUsd(n) {
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtEgp(n) {
  const sign = n < 0 ? "-" : "";
  return `${sign}EGP ${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function pct(n) {
  if (n == null || Number.isNaN(n)) return "Not available.";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}
function pctClass(n) {
  if (n == null) return "";
  return n >= 0 ? "positive" : "negative";
}
function badgeAction(a) {
  const map = {
    Keep: "badge-green",
    "Add candidate": "badge-green",
    Watch: "badge-yellow",
    "Do not add": "badge-red",
    "Consider trimming": "badge-red",
    Trim: "badge-red",
    "Needs manual review": "badge-yellow",
  };
  return map[a] || "badge-gray";
}
function badgeRisk(r) {
  if (r === "High" || r === "Speculative") return "badge-red";
  if (r === "Medium") return "badge-yellow";
  return "badge-gray";
}
function techRead(d) {
  if (!d || d.error) return { read: "Unclear", badge: "badge-gray", caution: "Missing live technical data" };
  let bull = 0,
    bear = 0;
  if (d.rsi14 > 50 && d.vs50?.startsWith("Above")) bull++;
  if (d.rsi14 < 40 && d.vs50?.startsWith("Below")) bear++;
  if (d.macd?.includes("Above signal")) bull++;
  if (d.macd?.includes("Below signal")) bear++;
  if ((d.move5d ?? 0) > 3) bull++;
  if ((d.move5d ?? 0) < -3) bear++;
  let read = "Unclear",
    badge = "badge-gray",
    caution = "";
  if (bull >= 2 && bear === 0) {
    read = "Bullish";
    badge = "badge-green";
  } else if (bear >= 2 && bull === 0) {
    read = "Bearish";
    badge = "badge-red";
  } else if (bull > bear) {
    read = "Improving";
    badge = "badge-blue";
  } else if (bear > bull) {
    read = "Weakening";
    badge = "badge-yellow";
  } else caution = "Mixed signals — insufficient confluence";
  if (d.losingStreak >= 3) caution += (caution ? "; " : "") + `🔴 ${d.losingStreak}-day losing streak`;
  if (d.rsi14 < 30) caution += (caution ? "; " : "") + "RSI deeply oversold — context matters in downtrend";
  return { read, badge, caution: caution || "—" };
}

const spy = market.benchmarks.SPY;
const qqq = market.benchmarks.QQQ;
const egxBenchmarkPct = egHoldings.find((h) => h.symbol === "EGX30ETF")?.dailyProfitLossPercent ?? null;

const allUs = usHoldings.map((h) => {
  const t = market.us[h.symbol] || {};
  return { ...h, tech: t, ...techRead(t) };
});
const allEg = egHoldings.map((h) => {
  const t = market.eg[h.symbol] || {};
  return { ...h, tech: t, ...techRead(t) };
});

const biggestUp = [...allUs].sort((a, b) => b.dailyProfitLossPercent - a.dailyProfitLossPercent)[0];
const biggestDown = [...allUs].sort((a, b) => a.dailyProfitLossPercent - b.dailyProfitLossPercent)[0];
const largest = [...allUs].sort((a, b) => b.weightPercent - a.weightPercent)[0];
const streakHoldings = allUs.filter((h) => (h.tech.losingStreak ?? 0) >= 3);
const attentionCount =
  allUs.filter(
    (h) =>
      h.weightPercent > 15 ||
      h.riskLevel === "High" ||
      h.action === "Trim" ||
      h.action === "Consider trimming" ||
      h.action === "Needs manual review" ||
      (h.tech.losingStreak ?? 0) >= 3 ||
      h.dailyProfitLossPercent < -5
  ).length + allEg.filter((h) => h.weightPercent > 15).length;

const actionOrder = {
  "Needs manual review": 0,
  "Consider trimming": 1,
  Trim: 1,
  "Do not add": 2,
  Watch: 3,
  Keep: 4,
  "Add candidate": 5,
};
const sortedHoldings = [...allUs, ...allEg].sort((a, b) => {
  const ao = (actionOrder[a.action] ?? 9) - (actionOrder[b.action] ?? 9);
  if (ao !== 0) return ao;
  return b.weightPercent - a.weightPercent;
});

const usHistory = portfolio.history.find((h) => h.profileId === "us-portfolio")?.points.filter((p) => p.hasData) || [];
const egHistory = portfolio.history.find((h) => h.profileId === "eg-portfolio")?.points.filter((p) => p.hasData) || [];

const CSS = readFileSync(new URL("../docs/daily-ai-portfolio-report-master-prompt.txt", import.meta.url), "utf8")
  .match(/:root \{[\s\S]*?footer \{[\s\S]*?\}/)?.[0];

// fallback CSS embedded
const baseCss = `:root {
  --bg: #f0f2f5; --surface: #ffffff; --surface-alt: #f8fafc; --border: #e2e8f0; --border-strong: #cbd5e1;
  --text-primary: #1a202c; --text-secondary: #4a5568; --text-muted: #718096;
  --positive: #16a34a; --positive-light: #bbf7d0; --positive-bg: #f0fdf4;
  --negative: #dc2626; --negative-light: #fecaca; --negative-bg: #fef2f2;
  --warning: #d97706; --warning-light: #fde68a; --warning-bg: #fffbeb;
  --info: #2563eb; --info-light: #bfdbfe; --info-bg: #eff6ff;
  --gray: #6b7280; --gray-light: #e5e7eb; --gray-bg: #f9fafb;
  --radius-sm: 4px; --radius: 8px; --radius-lg: 12px;
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
.card.positive { border-left: 4px solid var(--positive); } .card.negative { border-left: 4px solid var(--negative); }
.card.warning { border-left: 4px solid var(--warning); } .card.info { border-left: 4px solid var(--info); }
.card.missing { border-left: 4px solid var(--gray); background: var(--gray-bg); }
.card-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-muted); margin-bottom: 5px; }
.card-value { font-size: 22px; font-weight: 800; line-height: 1.2; }
.card-sub { font-size: 12px; color: var(--text-secondary); margin-top: 3px; }
section { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 20px; box-shadow: var(--shadow); }
.section-header { display: flex; align-items: center; gap: 8px; padding-bottom: 12px; margin-bottom: 16px; border-bottom: 2px solid var(--border); }
.section-title { font-size: 15px; font-weight: 700; } .section-icon { font-size: 17px; }
.table-wrap { overflow-x: auto; border-radius: var(--radius); border: 1px solid var(--border); }
table { width: 100%; border-collapse: collapse; font-size: 13px; }
thead th { background: var(--surface-alt); padding: 9px 12px; text-align: left; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-muted); border-bottom: 1px solid var(--border-strong); position: sticky; top: 0; z-index: 5; }
tbody td { padding: 9px 12px; border-bottom: 1px solid var(--border); vertical-align: middle; }
tbody tr:last-child td { border-bottom: none; } tbody tr:hover { background: var(--surface-alt); }
.badge { display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 700; letter-spacing: 0.02em; white-space: nowrap; }
.badge-green { background: var(--positive-light); color: #14532d; } .badge-red { background: var(--negative-light); color: #7f1d1d; }
.badge-orange { background: #fed7aa; color: #9a3412; } .badge-yellow { background: var(--warning-light); color: #78350f; }
.badge-blue { background: var(--info-light); color: #1e3a8a; } .badge-gray { background: var(--gray-light); color: #374151; }
.alert { display: flex; gap: 12px; align-items: flex-start; padding: 12px 14px; border-radius: var(--radius); border-left: 4px solid; margin-bottom: 8px; }
.alert-high { background: var(--negative-bg); border-color: var(--negative); } .alert-medium { background: var(--warning-bg); border-color: var(--warning); }
.alert-low { background: var(--info-bg); border-color: var(--info); }
.alert-icon { font-size: 16px; flex-shrink: 0; margin-top: 1px; } .alert-title { font-weight: 700; font-size: 13px; margin-bottom: 2px; }
.alert-detail { font-size: 12px; color: var(--text-secondary); } .alert-action { font-size: 12px; font-weight: 600; margin-top: 4px; }
.streak-badge { display: inline-flex; align-items: center; gap: 4px; padding: 3px 8px; border-radius: 999px; background: var(--negative-bg); border: 1px solid var(--negative-light); font-size: 11px; font-weight: 800; color: var(--negative); }
.brief-box { background: var(--info-bg); border: 1px solid var(--info-light); border-radius: var(--radius); padding: 16px 18px; font-size: 14px; }
.brief-part { margin-bottom: 12px; } .brief-part:last-child { margin-bottom: 0; }
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
.ntk-icon { font-size: 14px; flex-shrink: 0; margin-top: 2px; } .ntk-label { font-weight: 700; color: var(--text-secondary); min-width: 110px; flex-shrink: 0; }
.ntk-value { flex: 1; }
.bar-row { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
.bar-label { font-size: 12px; min-width: 60px; } .bar-track { flex: 1; height: 8px; background: var(--gray-light); border-radius: 4px; overflow: hidden; }
.bar-fill { height: 100%; border-radius: 4px; } .bar-pos { background: var(--positive); } .bar-neg { background: var(--negative); }
.bar-warn { background: var(--warning); } .bar-info { background: var(--info); }
.bar-pct { font-size: 12px; font-weight: 600; min-width: 48px; text-align: right; }
.positive { color: var(--positive); font-weight: 600; } .negative { color: var(--negative); font-weight: 600; }
.warning { color: var(--warning); font-weight: 600; } .muted { color: var(--text-muted); } .small { font-size: 12px; }
.mono { font-family: 'SF Mono', 'Fira Code', monospace; font-size: 12px; }
details { border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; margin-bottom: 8px; }
summary { padding: 11px 16px; font-weight: 600; font-size: 13px; cursor: pointer; background: var(--surface-alt); list-style: none; display: flex; justify-content: space-between; align-items: center; }
summary::-webkit-details-marker { display: none; } details[open] summary { border-bottom: 1px solid var(--border); } details > div { padding: 16px; }
header { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 20px 24px; box-shadow: var(--shadow-md); }
.header-top { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 12px; }
.report-title { font-size: 20px; font-weight: 900; } .report-sub { font-size: 13px; color: var(--text-secondary); margin-top: 3px; }
.header-right { text-align: right; }
.status-pill { display: inline-flex; align-items: center; gap: 5px; padding: 4px 12px; border-radius: 999px; font-size: 12px; font-weight: 700; }
.pill-open { background: var(--positive-bg); color: var(--positive); } .pill-closed { background: var(--gray-light); color: var(--gray); }
.pill-stale { background: var(--warning-bg); color: var(--warning); }
.warning-banner { background: var(--warning-bg); border: 1px solid var(--warning-light); border-radius: var(--radius); padding: 10px 14px; font-size: 13px; color: #92400e; margin-top: 14px; }
.sort-bar { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
.sort-btn { padding: 5px 11px; font-size: 12px; font-weight: 500; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface); cursor: pointer; color: var(--text-secondary); }
.sort-btn:hover, .sort-btn.active { background: var(--info); color: #fff; border-color: var(--info); }
footer { text-align: center; font-size: 12px; color: var(--text-muted); padding: 20px; border-top: 1px solid var(--border); margin-top: 20px; }`;

function barRow(label, value, max = 100) {
  const w = Math.min(100, Math.abs(value / max) * 100);
  const cls = value >= 0 ? "bar-pos" : "bar-neg";
  return `<div class="bar-row"><span class="bar-label">${label}</span><div class="bar-track"><div class="bar-fill ${cls}" style="width:${w}%"></div></div><span class="bar-pct ${pctClass(value)}">${pct(value)}</span></div>`;
}

const snapshotTs = usProfile.snapshot.updatedAt;
const keepList = [...allUs, ...allEg].filter((h) => h.action === "Keep" || h.action === "Add candidate");
const watchList = [...allUs, ...allEg].filter((h) => h.action === "Watch" || h.action === "Needs manual review");
const trimList = [...allUs, ...allEg].filter((h) => ["Consider trimming", "Do not add", "Trim"].includes(h.action));

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Daily Portfolio Report — ${SESSION}</title>
<style>${baseCss}</style>
</head>
<body>
<div class="page-grid">
<header>
  <div class="header-top">
    <div>
      <div class="report-title">Daily Portfolio Report</div>
      <div class="report-sub">Mon, Jun 22, 2026 · ${EMAIL}</div>
    </div>
    <div class="header-right">
      <span class="status-pill pill-open">● US Market Closed — Post-Close Snapshot</span>
      <div class="small muted" style="margin-top:6px">Data as of ${new Date(snapshotTs).toUTCString()}</div>
      <div class="small muted">US session: ${usProfile.sessionLabel} · EG session: ${egProfile.sessionLabel}</div>
    </div>
  </div>
  <div class="warning-banner">⚠ Egypt live Yahoo quotes lag by one session vs app snapshot (Jun 22 app vs Jun 21 Yahoo for CAI symbols). EGX30 index daily % unavailable from Yahoo — using EGX30ETF proxy (${pct(egxBenchmarkPct)}).</div>
</header>

<section>
  <div class="section-header"><span class="section-icon">⚡</span><span class="section-title">Quick Summary</span></div>
  <div class="card-grid-sm" style="margin-bottom:16px">
    <div class="card negative"><div class="card-label">US Portfolio Value</div><div class="card-value negative">${fmtUsd(usProfile.snapshot.portfolioValue)}</div></div>
    <div class="card negative"><div class="card-label">US Daily P/L</div><div class="card-value negative">${fmtUsd(usProfile.snapshot.dailyProfitLoss)}</div><div class="card-sub">${pct(usProfile.snapshot.dailyProfitLossPercent)}</div></div>
    <div class="card negative"><div class="card-label">Egypt Portfolio Value</div><div class="card-value">${fmtEgp(egProfile.snapshot.portfolioValue)}</div></div>
    <div class="card negative"><div class="card-label">Egypt Daily P/L</div><div class="card-value negative">${fmtEgp(egProfile.snapshot.dailyProfitLoss)}</div><div class="card-sub">${pct(egProfile.snapshot.dailyProfitLossPercent)}</div></div>
    <div class="card info"><div class="card-label">Total Holdings</div><div class="card-value">17</div><div class="card-sub">13 US · 4 Egypt</div></div>
    <div class="card warning"><div class="card-label">Holdings Needing Attention</div><div class="card-value warning">${attentionCount}</div></div>
  </div>
  <div class="two-col" style="margin-bottom:16px">
    <div>
      <div class="section-title" style="margin-bottom:10px">Need to Know First</div>
      <ul class="need-to-know-list">
        <li><span class="ntk-icon">📈</span><span class="ntk-label">Market Today</span><span class="ntk-value">SPY ${pct(spy.move1d)} · QQQ ${pct(qqq.move1d)} (Yahoo close ${spy.asOfDate}). Broad US market modestly lower — session moves largely market-driven for most holdings.</span></li>
        <li><span class="ntk-icon">📈</span><span class="ntk-label">Egypt Benchmark</span><span class="ntk-value">EGX30ETF proxy ${pct(egxBenchmarkPct)} today; EGX30 index direct quote unavailable with timestamp.</span></li>
        <li><span class="ntk-icon">📉</span><span class="ntk-label">Daily P/L</span><span class="ntk-value">US ${fmtUsd(usProfile.snapshot.dailyProfitLoss)} (${pct(usProfile.snapshot.dailyProfitLossPercent)}) · Egypt ${fmtEgp(egProfile.snapshot.dailyProfitLoss)} (${pct(egProfile.snapshot.dailyProfitLossPercent)}).</span></li>
        <li><span class="ntk-icon">📈</span><span class="ntk-label">Biggest Mover</span><span class="ntk-value">${biggestUp.symbol} ${pct(biggestUp.dailyProfitLossPercent)} — memory/AI theme strength, in line with sector outperformance vs flat indices.</span></li>
        <li><span class="ntk-icon">📉</span><span class="ntk-label">Biggest Loser</span><span class="ntk-value">${biggestDown.symbol} ${pct(biggestDown.dailyProfitLossPercent)} — post-IPO pullback on high volume; stock-specific weakness.</span></li>
        <li><span class="ntk-icon">🔴</span><span class="ntk-label">Losing Streak</span><span class="ntk-value">${streakHoldings.length ? streakHoldings.map((h) => `<span class="streak-badge">🔴 ${h.symbol} ${h.tech.losingStreak} days</span>`).join(" ") : "None currently"}</span></li>
        <li><span class="ntk-icon">📰</span><span class="ntk-label">Positive Catalyst</span><span class="ntk-value">DRAM — AI memory demand, Micron earnings Jun 24; fund +5.23% today on sector strength (Benzinga, Jun 21).</span></li>
        <li><span class="ntk-icon">🔴</span><span class="ntk-label">At Risk</span><span class="ntk-value">NFLX — 52-week low, failed M&A narrative; SPCX — three-day post-IPO decline on high-volume selling.</span></li>
        <li><span class="ntk-icon">🟡</span><span class="ntk-label">Watch Today</span><span class="ntk-value">AAPL (30% weight) — modest decline in line with market; concentration warrants monitoring.</span></li>
        <li><span class="ntk-icon">📅</span><span class="ntk-label">Upcoming Event</span><span class="ntk-value">Micron earnings Wed Jun 24 (DRAM exposure) · NFLX Q2 earnings Jul 16 · SPCX earnings Aug 6.</span></li>
        <li><span class="ntk-icon">⚠️</span><span class="ntk-label">Data Gap</span><span class="ntk-value">Egypt Yahoo technicals one session behind app; EGX30ETF not on Yahoo; 200-day MAs unavailable for several tickers.</span></li>
      </ul>
    </div>
    <div>
      <div class="section-title" style="margin-bottom:10px">Today's Brief</div>
      <div class="brief-box">
        <div class="brief-part"><div class="brief-part-label">MOVES & TRENDS</div><div class="brief-part-text">US portfolios fell ${pct(usProfile.snapshot.dailyProfitLossPercent)} as SPY/QQQ slipped ~0.3% — largely market-wide. DRAM (+5.2%) and TSM (+1.2%) outperformed on AI/memory strength; SPCX (-16.4%) and NFLX (-5.8%) drove stock-specific pain. NASA has a <span class="streak-badge">🔴 4 days</span> losing streak; SPCX <span class="streak-badge">🔴 3 days</span>.</div></div>
        <div class="brief-part"><div class="brief-part-label">COMING UP</div><div class="brief-part-text">Micron fiscal Q3 earnings Jun 24 is the nearest high-impact catalyst for DRAM (72% memory names). NFLX reports Jul 16. No major Egypt-specific events verified within 7 days.</div></div>
        <div class="brief-part"><div class="brief-part-label">GUIDANCE</div><div class="brief-part-text">DRAM deserves the most attention — strong momentum but app label is Trim ahead of Micron results; watch for guidance vs lofty expectations. SPCX post-IPO volatility warrants caution, not adds.</div></div>
        <div class="brief-part"><div class="brief-part-label">TODAY'S IDEA</div><div class="brief-part-text">TSM offers relative strength with confirmed AI supply-chain tailwinds and bullish technical confluence — see full details in the Opportunity card below.</div></div>
      </div>
    </div>
  </div>
  <div class="opportunity-card">
    <div class="two-col">
      <div>
        <div class="opportunity-eyebrow">Today's Watchlist Idea</div>
        <div class="opportunity-ticker">TSM</div>
        <div class="opportunity-name">Taiwan Semiconductor Manufacturing Company</div>
        <div class="opportunity-reason">TSM gained +1.2% today while the broad market fell, holding above its 50-day MA with RSI ~59 and positive MACD momentum. As the primary foundry for AI chips (including Nvidia Vera Rubin HBM supply chain), it benefits from the same structural memory/compute demand lifting DRAM — with lower single-name IPO-style volatility than SPCX.</div>
        <div class="opportunity-note">Watchlist idea only — not a buy recommendation.</div>
      </div>
      <table class="small">
        <tr><td><strong>Sector</strong></td><td>Semiconductors / Foundry</td></tr>
        <tr><td><strong>Catalyst</strong></td><td>AI infrastructure demand; Micron earnings read-through Jun 24</td></tr>
        <tr><td><strong>Technical Setup</strong></td><td>Above 50D MA · MACD above signal · +10.3% 5D</td></tr>
        <tr><td><strong>Risk Level</strong></td><td><span class="badge badge-yellow">Medium</span></td></tr>
        <tr><td><strong>Watch Horizon</strong></td><td>1–2 weeks (earnings sympathy play)</td></tr>
        <tr><td><strong>Invalidation</strong></td><td>Break below 50D MA on high volume or weak Micron guidance</td></tr>
      </table>
    </div>
  </div>
</section>

<section>
  <div class="section-header"><span class="section-icon">🚨</span><span class="section-title">Needs Attention First</span></div>
  <div class="alert alert-high"><span class="alert-icon">⚠️</span><div><div class="alert-title">AAPL — Concentration above 15%</div><div class="alert-detail">Apple is 30.3% of the US portfolio — a single-name risk that amplifies any Apple-specific or mega-cap tech shock.</div><div class="alert-action">Suggested action: Watch</div></div></div>
  <div class="alert alert-high"><span class="alert-icon">📉</span><div><div class="alert-title">SPCX — Large daily loss &amp; 3-day streak</div><div class="alert-detail">Down 16.4% today on high-volume selling after post-IPO peak; three consecutive down sessions per Yahoo closes.</div><div class="alert-action">Suggested action: Needs manual review</div></div></div>
  <div class="alert alert-high"><span class="alert-icon">📉</span><div><div class="alert-title">NFLX — Large unrealized loss &amp; 52-week low</div><div class="alert-detail">Unrealized P/L −25.7%; hit 52-week intraday low Jun 22 amid M&A disappointment narrative (CNBC/TipRanks).</div><div class="alert-action">Suggested action: Watch</div></div></div>
  <div class="alert alert-medium"><span class="alert-icon">⚠️</span><div><div class="alert-title">EGX30ETF — 59% portfolio weight</div><div class="alert-detail">Egypt portfolio is heavily concentrated in one ETF — benchmark-like exposure with limited single-stock diversification.</div><div class="alert-action">Suggested action: Watch</div></div></div>
  <div class="alert alert-medium"><span class="alert-icon">✂️</span><div><div class="alert-title">DRAM — Trim label ahead of earnings</div><div class="alert-detail">Strong +43.5% unrealized gain and +5.2% today, but Micron earnings Jun 24 could reverse momentum if guidance disappoints.</div><div class="alert-action">Suggested action: Consider trimming</div></div></div>
  <div class="alert alert-medium"><span class="alert-icon">🔴</span><div><div class="alert-title">NASA — 4-day losing streak</div><div class="alert-detail">Space-themed ETF down 4.8% today and −6.8% over 5 days; speculative theme underperforming.</div><div class="alert-action">Suggested action: Watch</div></div></div>
  <div class="alert alert-low"><span class="alert-icon">📅</span><div><div class="alert-title">NFLX — Earnings in 24 days (Jul 16)</div><div class="alert-detail">Q2 2026 report could reset narrative after 52-week low; monitor pre-earnings volatility.</div><div class="alert-action">Suggested action: Watch</div></div></div>
</section>

<section>
  <div class="section-header"><span class="section-icon">📊</span><span class="section-title">Summary Cards</span></div>
  <div class="card-grid">
    <div class="card negative"><div class="card-label">US Portfolio Value</div><div class="card-value">${fmtUsd(usProfile.snapshot.portfolioValue)}</div></div>
    <div class="card negative"><div class="card-label">US Daily P/L</div><div class="card-value negative">${fmtUsd(usProfile.snapshot.dailyProfitLoss)}</div><div class="card-sub">${pct(usProfile.snapshot.dailyProfitLossPercent)}</div></div>
    <div class="card"><div class="card-label">Egypt Portfolio Value</div><div class="card-value">${fmtEgp(egProfile.snapshot.portfolioValue)}</div></div>
    <div class="card negative"><div class="card-label">Egypt Daily P/L</div><div class="card-value negative">${fmtEgp(egProfile.snapshot.dailyProfitLoss)}</div><div class="card-sub">${pct(egProfile.snapshot.dailyProfitLossPercent)}</div></div>
    <div class="card positive"><div class="card-label">Biggest Positive Mover</div><div class="card-value positive">${biggestUp.symbol}</div><div class="card-sub">${pct(biggestUp.dailyProfitLossPercent)}</div></div>
    <div class="card negative"><div class="card-label">Biggest Negative Mover</div><div class="card-value negative">${biggestDown.symbol}</div><div class="card-sub">${pct(biggestDown.dailyProfitLossPercent)}</div></div>
    <div class="card warning"><div class="card-label">Largest Holding</div><div class="card-value">${largest.symbol}</div><div class="card-sub">${largest.weightPercent.toFixed(1)}% weight</div></div>
    <div class="card negative"><div class="card-label">Biggest Risk</div><div class="card-value">SPCX</div><div class="card-sub">Post-IPO −16.4% day</div></div>
    <div class="card info"><div class="card-label">Top Catalyst</div><div class="card-value">MU Earnings</div><div class="card-sub">Jun 24 · DRAM exposure</div></div>
    <div class="card warning"><div class="card-label">Needing Attention</div><div class="card-value">${attentionCount}</div></div>
    <div class="card info"><div class="card-label">Watchlist Idea</div><div class="card-value">TSM</div></div>
    <div class="card negative"><div class="card-label">Worst Streak</div><div class="card-value">NASA</div><div class="card-sub">4 days down</div></div>
    <div class="card positive"><div class="card-label">Strongest 5D</div><div class="card-value">DRAM</div><div class="card-sub">${pct(market.us.DRAM?.move5d)}</div></div>
    <div class="card negative"><div class="card-label">Weakest 5D</div><div class="card-value">NFLX</div><div class="card-sub">${pct(market.us.NFLX?.move5d)}</div></div>
  </div>
</section>

<section>
  <div class="section-header"><span class="section-icon">📈</span><span class="section-title">Trend and Progress Charts</span></div>
  <h4 style="margin-bottom:8px">A. Portfolio Value Trend (7 sessions with data)</h4>
  <p class="small muted" style="margin-bottom:8px">USD — US Portfolio</p>
  ${usHistory.slice(-7).map((p) => barRow(p.date, p.dailyProfitLossPercent, 5)).join("")}
  <p class="small muted" style="margin:12px 0 8px">EGP — Egypt Portfolio</p>
  ${egHistory.slice(-7).map((p) => barRow(p.date, p.dailyProfitLossPercent, 3)).join("")}
  <h4 style="margin:16px 0 8px">B. Daily P/L Trend (last 7 sessions)</h4>
  ${usHistory.slice(-7).map((p) => barRow(p.date, p.dailyProfitLoss, 70)).join("")}
  <h4 style="margin:16px 0 8px">C. Winners vs Losers (5D)</h4>
  ${[...allUs].sort((a, b) => (b.tech.move5d ?? 0) - (a.tech.move5d ?? 0)).map((h) => barRow(h.symbol, h.tech.move5d ?? 0, 30)).join("")}
  <h4 style="margin:16px 0 8px">D. Losing Streak Indicator</h4>
  <div class="table-wrap"><table><thead><tr><th>Ticker</th><th>Streak Days</th><th>Decline During Streak</th><th>Possible Reason</th><th>Action</th></tr></thead><tbody>
  ${streakHoldings.length ? streakHoldings.map((h) => `<tr style="background:var(--negative-bg)"><td>${h.symbol}</td><td><span class="streak-badge">🔴 ${h.tech.losingStreak}</span></td><td class="negative">${pct(h.tech.move5d)}</td><td>${h.symbol === "SPCX" ? "Post-IPO profit-taking" : h.symbol === "NASA" ? "Space sector weakness" : "Market-wide pressure"}</td><td><span class="badge ${badgeAction(h.action)}">${h.action}</span></td></tr>`).join("") : `<tr><td colspan="5">No holdings with a 3+ day losing streak in the current data.</td></tr>`}
  </tbody></table></div>
</section>

<section>
  <div class="section-header"><span class="section-icon">🥧</span><span class="section-title">Portfolio Allocation</span></div>
  <h4>US Portfolio (USD)</h4>
  ${[...allUs].sort((a, b) => b.weightPercent - a.weightPercent).map((h) => `<div class="bar-row"><span class="bar-label">${h.symbol}</span><div class="bar-track"><div class="bar-fill bar-info" style="width:${h.weightPercent}%"></div></div><span class="bar-pct">${h.weightPercent.toFixed(1)}%${h.weightPercent > 15 ? ' <span class="badge badge-orange">⚠ &gt;15%</span>' : ""}</span></div>`).join("")}
  <ul class="small" style="margin-top:8px"><li>Largest: AAPL 30.3% — concentration risk</li><li>ETF balance: ~31% ETFs (QQQM, VOO, SCHG, DRAM, NASA) vs ~69% single stocks</li><li>Speculative: SPCX, NASA, HOOD combined ~10%</li></ul>
  <h4 style="margin-top:16px">Egypt Portfolio (EGP)</h4>
  ${[...allEg].sort((a, b) => b.weightPercent - a.weightPercent).map((h) => `<div class="bar-row"><span class="bar-label">${h.symbol}</span><div class="bar-track"><div class="bar-fill bar-info" style="width:${h.weightPercent}%"></div></div><span class="bar-pct">${h.weightPercent.toFixed(1)}%${h.weightPercent > 15 ? ' <span class="badge badge-orange">⚠ &gt;15%</span>' : ""}</span></div>`).join("")}
  <ul class="small" style="margin-top:8px"><li>EGX30ETF dominates at 59% — index-like exposure</li><li>RAYA 15.7% and ORHD 12.8% add single-stock Egypt risk</li></ul>
</section>

<section>
  <div class="section-header"><span class="section-icon">📋</span><span class="section-title">Priority-Sorted Holdings Table</span></div>
  <div class="sort-bar"><button class="sort-btn active" onclick="sortTable('priority')">Priority</button><button class="sort-btn" onclick="sortTable('weight')">Weight</button><button class="sort-btn" onclick="sortTable('daily')">Daily P/L</button><button class="sort-btn" onclick="sortTable('unreal')">Unrealized P/L</button></div>
  <div class="table-wrap"><table id="holdingsTable"><thead><tr>
    <th>Ticker</th><th>Market</th><th>Weight</th><th>Value</th><th>Daily P/L</th><th>1D</th><th>5D</th><th>Unrealized P/L</th><th>Risk</th><th>Catalyst</th><th>Action</th><th>Data</th><th>Main Reason</th>
  </tr></thead><tbody>
  ${sortedHoldings.map((h) => {
    const isEg = h.region === "EG";
    const cur = isEg ? fmtEgp(h.currentValue) : fmtUsd(h.currentValue);
    const dpl = isEg ? fmtEgp(h.dailyProfitLoss) : fmtUsd(h.dailyProfitLoss);
    const upl = isEg ? fmtEgp(h.profitLoss) : fmtUsd(h.profitLoss);
    const streak = (h.tech?.losingStreak ?? 0) >= 3;
    const catalyst = h.symbol === "DRAM" ? "Micron earnings Jun 24" : h.symbol === "NFLX" ? "Q2 earnings Jul 16" : h.symbol === "SPCX" ? "Post-IPO volatility" : h.symbol === "ORHD" ? "User note: sell soon" : "No clear catalyst";
    const dataBadge = h.tech?.error ? "badge-yellow" : isEg && h.tech?.asOfDate !== SESSION ? "badge-yellow" : "badge-green";
    const dataLabel = h.tech?.error ? "Partial" : isEg && h.tech?.asOfDate !== SESSION ? "Partial" : "Complete";
    return `<tr data-weight="${h.weightPercent}" data-daily="${h.dailyProfitLoss}" data-unreal="${h.profitLoss}" style="${streak ? "background:var(--negative-bg)" : ""}">
      <td><strong>${h.symbol}</strong></td><td>${h.region}</td><td>${h.weightPercent.toFixed(1)}%</td><td>${cur}</td>
      <td class="${pctClass(h.dailyProfitLoss)}">${dpl}</td>
      <td class="${pctClass(h.dailyProfitLossPercent)}">${pct(h.dailyProfitLossPercent)}</td>
      <td class="${pctClass(h.tech?.move5d)}">${pct(h.tech?.move5d)}</td>
      <td class="${pctClass(h.profitLoss)}">${upl}</td>
      <td><span class="badge ${badgeRisk(h.riskLevel)}">${h.riskLevel}</span></td>
      <td class="small">${catalyst}</td>
      <td><span class="badge ${badgeAction(h.action)}">${h.action}</span></td>
      <td><span class="badge ${dataBadge}">${dataLabel}</span></td>
      <td class="small">${h.symbol === "DRAM" ? "Trim after big run; earnings risk" : h.symbol === "AAPL" ? "Largest weight; market-beta" : h.symbol === "SPCX" ? "IPO pullback" : h.symbol === "NFLX" ? "M&A disappointment" : "Hold core position"}</td>
    </tr>`;
  }).join("")}
  </tbody></table></div>
</section>

<section>
  <div class="section-header"><span class="section-icon">💰</span><span class="section-title">Daily P/L Contribution</span></div>
  <h4>US (USD)</h4>
  <div class="table-wrap"><table><thead><tr><th>Ticker</th><th>Daily P/L</th><th>Daily %</th><th>Weight</th><th>Impact Driver</th></tr></thead><tbody>
  ${[...allUs].sort((a, b) => Math.abs(b.dailyProfitLoss) - Math.abs(a.dailyProfitLoss)).map((h) => {
    const driver = Math.abs(h.dailyProfitLoss) / h.currentValue > 0.05 ? "Price-driven" : h.weightPercent > 10 ? "Both" : "Size-driven";
    return `<tr><td>${h.symbol}</td><td class="${pctClass(h.dailyProfitLoss)}">${fmtUsd(h.dailyProfitLoss)}</td><td class="${pctClass(h.dailyProfitLossPercent)}">${pct(h.dailyProfitLossPercent)}</td><td>${h.weightPercent.toFixed(1)}%</td><td>${driver}</td></tr>`;
  }).join("")}
  </tbody></table></div>
  <h4 style="margin-top:16px">Egypt (EGP)</h4>
  <div class="table-wrap"><table><thead><tr><th>Ticker</th><th>Daily P/L</th><th>Daily %</th><th>Weight</th><th>Impact Driver</th></tr></thead><tbody>
  ${[...allEg].sort((a, b) => Math.abs(b.dailyProfitLoss) - Math.abs(a.dailyProfitLoss)).map((h) => `<tr><td>${h.symbol}</td><td class="${pctClass(h.dailyProfitLoss)}">${fmtEgp(h.dailyProfitLoss)}</td><td class="${pctClass(h.dailyProfitLossPercent)}">${pct(h.dailyProfitLossPercent)}</td><td>${h.weightPercent.toFixed(1)}%</td><td>${h.weightPercent > 50 ? "Size-driven" : "Price-driven"}</td></tr>`).join("")}
  </tbody></table></div>
</section>

<section>
  <div class="section-header"><span class="section-icon">🏃</span><span class="section-title">Recent Performance</span></div>
  ${[...allUs].sort((a, b) => (b.tech.move5d ?? 0) - (a.tech.move5d ?? 0)).map((h) => `<div class="bar-row"><span class="bar-label">${h.symbol}</span><span class="small muted">1D ${pct(h.tech.move1d)} · 3D ${pct(h.tech.move3d)} · 5D ${pct(h.tech.move5d)} · 20D ${pct(h.tech.move20d)}</span></div>`).join("")}
  <p class="small" style="margin-top:12px">DRAM (+24% 5D) and HOOD (+13% 5D) show strongest US momentum; NFLX (−9% 5D) and NASA (−7% 5D) weakest. Most 1D declines align with SPY −0.33% — market-wide except SPCX/NFLX/DRAM outliers.</p>
</section>

<section>
  <div class="section-header"><span class="section-icon">📉</span><span class="section-title">Technical Signals</span></div>
  <div class="table-wrap"><table><thead><tr>
    <th>Ticker</th><th>RSI-14</th><th>vs 20D</th><th>vs 50D</th><th>vs 200D</th><th>Volume</th><th>MACD</th><th>Momentum</th><th>Read</th><th>Caution</th>
  </tr></thead><tbody>
  ${[...allUs].sort((a, b) => {
    const order = { Bearish: 0, Weakening: 1, Unclear: 2, Neutral: 3, Improving: 4, Bullish: 5 };
    return (order[a.read] ?? 2) - (order[b.read] ?? 2);
  }).map((h) => `<tr>
    <td>${h.symbol}</td>
    <td>${h.tech.rsi14 ?? "Not available."}${h.tech.rsi14 ? '<br><span class="small muted">Calc Yahoo</span>' : ""}</td>
    <td>${h.tech.vs20 ?? "Not available."}</td><td>${h.tech.vs50 ?? "Not available."}</td><td>${h.tech.vs200 ?? "Not available."}</td>
    <td class="small">${h.tech.volLabel ?? "Not available."}</td>
    <td class="small">${h.tech.macd ?? "Not available."}</td>
    <td class="${pctClass(h.tech.move5d)}">${pct(h.tech.move5d)} 5D</td>
    <td><span class="badge ${h.badge}">${h.read}</span></td>
    <td class="small">${h.caution}</td>
  </tr>`).join("")}
  </tbody></table></div>
</section>

<section>
  <div class="section-header"><span class="section-icon">📰</span><span class="section-title">News and Catalysts</span></div>
  <details open><summary>Negative <span class="badge badge-red">3</span></summary><div>
    <p><strong>SPCX</strong> — SpaceX pulling back from post-IPO high; three down days (247wallst.com, Jun 21). Impact: Negative catalyst. High-volume selling confirms weakness. Does not change Trim/Watch stance — already speculative.</p>
    <p><strong>NFLX</strong> — Stock hit 52-week low Jun 22 amid growth/M&amp;A concerns (TipRanks/CNBC, Jun 22). Impact: Negative catalyst. Watch — no action change yet.</p>
    <p><strong>NFLX</strong> — Bank of America downgrade to Hold (TipRanks, Jun 15). <em>Analyst rating change</em> — not news event. Cites lack of near-term catalysts.</p>
  </div></details>
  <details><summary>Mixed <span class="badge badge-yellow">1</span></summary><div>
    <p><strong>DRAM</strong> — AUM hit $21B but Benzinga warns Micron earnings could reverse rally (Jun 21). Mixed catalyst — positive trend, event risk ahead.</p>
  </div></details>
  <details><summary>Positive <span class="badge badge-green">2</span></summary><div>
    <p><strong>DRAM</strong> — SK Hynix overtakes Samsung as Korea's most valuable company; memory complex strength (Stocktwits, Jun 22). Positive catalyst for memory ETF.</p>
    <p><strong>TSM</strong> — Outperformed market today on AI foundry demand tailwinds (sector context). Positive catalyst — supports Keep action.</p>
  </div></details>
  <details><summary>No material recent news found <span class="badge badge-gray">7</span></summary><div>
    <p>AAPL, QQQM, VOO, SCHG, META, NVDA, HOOD, IBM, NASA — No material news found in the last 7 days beyond broad market coverage.</p>
    <p>ORHD, EGX30ETF, RAYA, COMI — No verified English-language news in the last 7 days.</p>
  </div></details>
</section>

<section>
  <div class="section-header"><span class="section-icon">📅</span><span class="section-title">Upcoming Earnings and Events</span></div>
  <div class="table-wrap"><table><thead><tr><th>Ticker</th><th>Event</th><th>Date</th><th>Days Away</th><th>Importance</th><th>Why It Matters</th></tr></thead><tbody>
    <tr style="background:var(--warning-bg)"><td>DRAM (via MU)</td><td>Micron FQ3 earnings</td><td>2026-06-24</td><td>2</td><td>High</td><td>~24% of DRAM ETF; guidance could move entire memory complex</td></tr>
    <tr style="background:var(--info-bg)"><td>NFLX</td><td>Q2 2026 earnings</td><td>2026-07-16</td><td>24</td><td>High</td><td>At 52-week low; report may reset narrative</td></tr>
    <tr><td>SPCX</td><td>Earnings</td><td>2026-08-06</td><td>45</td><td>Medium</td><td>First post-IPO report; high volatility expected</td></tr>
  </tbody></table></div>
</section>

<section>
  <div class="section-header"><span class="section-icon">⚠️</span><span class="section-title">Portfolio Risk Notes</span></div>
  <details open><summary>Concentration risk</summary><div>AAPL 30.3% US; EGX30ETF 59% Egypt. Practical: single-name/ETF shocks move total portfolio materially.</div></details>
  <details><summary>Sector risk</summary><div>~40% US exposure to mega-cap tech + AI/memory theme (AAPL, META, NVDA, DRAM, TSM). Egypt heavily domestic market via EGX30ETF.</div></details>
  <details><summary>ETF overlap</summary><div>QQQM, VOO, SCHG overlap large-cap US growth/value — combined ~26% with individual mega-caps creates redundant S&amp;P/Nasdaq exposure.</div></details>
  <details><summary>Speculative exposure</summary><div>SPCX, NASA, HOOD — ~10% US; post-IPO and thematic ETFs carry higher volatility.</div></details>
  <details><summary>Currency/geography</summary><div>US USD vs Egypt EGP — never combine totals. EGP portfolio ~44× larger in local currency terms.</div></details>
  <details><summary>Large losses</summary><div>NFLX −25.7% unrealized; IBM −19.4%; NASA −17.7%. Monitor for thesis breaks.</div></details>
  <details><summary>Large gains</summary><div>DRAM +43.5% unrealized — consider Trim label ahead of earnings.</div></details>
</section>

<section>
  <div class="section-header"><span class="section-icon">🔄</span><span class="section-title">What Changed Today</span></div>
  <p>US portfolio fell from $2,846.51 (Jun 19) to $2,822.45 — ${fmtUsd(-24.06)} daily. Egypt fell from EGP 124,194 to EGP 123,807. DRAM action remains Trim (was strong again today). SPCX worsened with −16.4% day. NFLX reached new 52-week low. RAYA was only Egypt gainer (+0.67%). No verified action label changes from prior session in app data.</p>
</section>

<section>
  <div class="section-header"><span class="section-icon">👀</span><span class="section-title">Watchlist</span></div>
  <div class="table-wrap"><table><thead><tr><th>Ticker</th><th>Name</th><th>Why Interesting</th><th>Technical</th><th>Catalyst</th><th>Risk</th><th>Level</th><th>More Interesting If</th><th>Invalidation</th></tr></thead><tbody>
    <tr><td>TSM</td><td>TSMC</td><td>AI foundry leader; relative strength today</td><td>Bullish confluence</td><td>MU earnings read-through</td><td>Medium</td><td><span class="badge badge-blue">High</span></td><td>Holds above 50D MA post-Micron</td><td>Break below 50D on volume</td></tr>
    <tr><td>DRAM</td><td>Roundhill Memory ETF</td><td>AI memory supercycle</td><td>Bullish but extended</td><td>Micron Jun 24</td><td>High</td><td><span class="badge badge-orange">Speculative</span></td><td>Strong MU guidance</td><td>Weak MU guidance</td></tr>
    <tr><td>QQQM</td><td>Nasdaq 100 ETF</td><td>Core US growth exposure</td><td>Weakening short-term</td><td>None near-term</td><td>Low</td><td><span class="badge badge-gray">Medium</span></td><td>QQQ reclaims 20D MA</td><td>Further breadth deterioration</td></tr>
  </tbody></table></div>
  <p class="small muted" style="margin-top:8px">Watchlist only — not a buy recommendation.</p>
</section>

<section>
  <div class="section-header"><span class="section-icon">✅</span><span class="section-title">Final Action Summary</span></div>
  <div class="three-col">
    <div class="card positive"><div class="card-label">Keep / Add Candidates</div><div class="card-sub" style="margin-top:8px">${keepList.map((h) => `<div><strong>${h.symbol}</strong> — ${h.action}: ${h.symbol === "TSM" ? "AI supply chain beneficiary" : "Core holding"}</div>`).join("")}</div></div>
    <div class="card warning"><div class="card-label">Watch Closely</div><div class="card-sub" style="margin-top:8px"><div><strong>AAPL</strong> — concentration + market beta</div><div><strong>NFLX</strong> — 52-week low, earnings ahead</div><div><strong>NASA</strong> — 4-day streak</div><div><strong>EGX30ETF</strong> — 59% weight</div></div></div>
    <div class="card negative"><div class="card-label">Consider Trimming</div><div class="card-sub" style="margin-top:8px"><div><strong>DRAM</strong> — Trim: extended run, earnings risk Jun 24</div></div></div>
  </div>
</section>

<section>
  <div class="section-header"><span class="section-icon">📚</span><span class="section-title">Sources and Data Notes</span></div>
  <ul class="small">
    <li>Portfolio accounting: Portfolio Exit Planner API snapshot ${snapshotTs}</li>
    <li>US prices/technicals: Yahoo Finance chart API (closes through 2026-06-22)</li>
    <li>EG prices/technicals: Yahoo Finance .CA symbols (closes through 2026-06-21 — one session lag)</li>
    <li>Benchmarks: SPY, QQQ (Yahoo); EGX30ETF app proxy for Egypt benchmark</li>
    <li>News: CNBC, TipRanks, Benzinga, 247wallst.com, Stocktwits (publication dates Jun 15–22, 2026)</li>
    <li>Limitations: 200-day MAs unavailable (insufficient history in 6mo fetch); EGX30ETF not on Yahoo; no dailyAi cache in app today</li>
  </ul>
</section>

</div>
<footer>This is analysis for decision support, not financial advice or automatic trading.</footer>
<script>
function sortTable(mode) {
  const tbody = document.querySelector('#holdingsTable tbody');
  const rows = Array.from(tbody.querySelectorAll('tr'));
  document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
  event.target.classList.add('active');
  rows.sort((a, b) => {
    if (mode === 'weight') return parseFloat(b.dataset.weight) - parseFloat(a.dataset.weight);
    if (mode === 'daily') return parseFloat(a.dataset.daily) - parseFloat(b.dataset.daily);
    if (mode === 'unreal') return parseFloat(a.dataset.unreal) - parseFloat(b.dataset.unreal);
    return 0;
  });
  if (mode !== 'priority') rows.forEach(r => tbody.appendChild(r));
}
</script>
</body>
</html>`;

const outPath = `/workspace/docs/reports/.raw/portfolio-report-${SESSION}.html`;
writeFileSync(outPath, html, "utf8");
console.log(`Wrote ${outPath} (${html.length} bytes)`);
