#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const portfolio = JSON.parse(readFileSync("/tmp/portfolio-data.json", "utf8"));
const market = JSON.parse(readFileSync("/tmp/market-data.json", "utf8"));

const REPORT_DATE = "2026-06-26";
const SNAPSHOT_AT = "2026-06-26 20:20 UTC";

const usProfile = portfolio.profiles.find((p) => p.id === "us-portfolio");
const egProfile = portfolio.profiles.find((p) => p.id === "eg-portfolio");
const usSnap = usProfile.snapshot;
const egSnap = egProfile.snapshot;
const usReport = usProfile.report;
const egReport = egProfile.report;

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

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

function badge(cls, text) {
  return `<span class="badge ${cls}">${esc(text)}</span>`;
}

function actionLabel(raw) {
  if (raw === "Trim") return "Consider trimming";
  return raw || "Keep";
}

function actionBadge(label) {
  if (label === "Consider trimming" || label === "Do not add") return badge("badge-red", label);
  if (label === "Watch" || label === "Needs manual review") return badge("badge-yellow", label);
  return badge("badge-green", label);
}

function riskBadge(risk) {
  if (risk === "High" || risk === "Speculative") return badge("badge-red", risk);
  if (risk === "Medium") return badge("badge-yellow", risk);
  return badge("badge-gray", risk || "Low");
}

function dataBadge(level) {
  if (level === "Complete") return badge("badge-green", level);
  if (level === "Partial") return badge("badge-yellow", level);
  return badge("badge-red", level);
}

function vsMa(price, ma) {
  if (!ma) return "Not available.";
  const diff = ((price / ma - 1) * 100).toFixed(1);
  return price >= ma ? `Above (+${diff}%)` : `Below (${diff}%)`;
}

function technicalRead(sym, m) {
  if (!m || m.error) return { read: "Unclear", caution: "Missing market data" };
  let bull = 0, bear = 0;
  const price = m.price;
  if (m.rsi != null) {
    if (m.rsi > 55 && price > (m.ma50 || 0)) bull++;
    else if (m.rsi < 45 && price < (m.ma50 || price)) bear++;
  }
  if (m.ma20 && price > m.ma20) bull++;
  else if (m.ma20) bear++;
  if (m.macd?.includes("Above")) bull++;
  else if (m.macd?.includes("Below")) bear++;
  if (m.streak >= 3) bear++;
  let read = "Unclear";
  if (bull >= 2 && bear === 0) read = "Bullish";
  else if (bull >= 2 && bear <= 1) read = "Improving";
  else if (bear >= 2 && bull === 0) read = "Bearish";
  else if (bear >= 2) read = "Weakening";
  else if (bull === 0 && bear === 0) read = "Neutral";
  const caution = m.streak >= 3 ? `🔴 ${m.streak}-day losing streak` : m.vol_label?.includes("Low") ? "Low-conviction move" : "";
  return { read, caution };
}

function techBadge(read) {
  const map = { Bullish: "badge-green", Improving: "badge-blue", Neutral: "badge-gray", Weakening: "badge-yellow", Bearish: "badge-red", Unclear: "badge-gray" };
  return badge(map[read] || "badge-gray", read);
}

function dataQuality(sym, m) {
  if (sym === "SPCX" || sym === "QNT") return "Partial";
  if (!m || m.error || m.rsi == null) return "Partial";
  return "Complete";
}

function priorityRank(action) {
  const order = { "Needs manual review": 0, "Consider trimming": 1, "Do not add": 2, Watch: 3, Keep: 4, "Add candidate": 5 };
  return order[action] ?? 4;
}

const usHoldings = usSnap.holdings.map((h) => {
  const rr = h.reportRow || {};
  const m = market[h.symbol] || {};
  const action = actionLabel(rr.action || h.action);
  const tech = technicalRead(h.symbol, m);
  return { ...h, rr, m, action, tech, region: "US", currency: "USD", market: "US" };
});

const egHoldings = egSnap.holdings.map((h) => {
  const rr = h.reportRow || {};
  const action = actionLabel(rr.action || h.action);
  return { ...h, rr, m: {}, action, tech: { read: "Unclear", caution: "EGX technicals not fetched — Egypt session Jun 25" }, region: "EG", currency: "EGP", market: "EGX" };
});

const allHoldings = [...usHoldings, ...egHoldings];
const attentionCount = allHoldings.filter((h) => {
  const w = h.weightPercent || 0;
  return w > 15 || h.action === "Consider trimming" || h.rr.riskLevel === "High" || (h.m?.streak >= 3) || Math.abs(h.daily_profit_loss_percent || 0) > 5;
}).length + (egHoldings.some((h) => h.weightPercent > 15) ? 0 : 0);

const usBiggestUp = [...usHoldings].sort((a, b) => (b.daily_profit_loss_percent || 0) - (a.daily_profit_loss_percent || 0))[0];
const usBiggestDown = [...usHoldings].sort((a, b) => (a.daily_profit_loss_percent || 0) - (b.daily_profit_loss_percent || 0))[0];
const streakHoldings = usHoldings.filter((h) => (h.m?.streak || 0) >= 3);

const egDailyPl = egReport.totals.dailyProfitLoss;
const usDailyPl = usSnap.dailyProfitLoss;

const sortedHoldings = [...allHoldings].sort((a, b) => {
  const pa = priorityRank(a.action);
  const pb = priorityRank(b.action);
  if (pa !== pb) return pa - pb;
  return (b.weightPercent || 0) - (a.weightPercent || 0);
});

const usHistory = portfolio.history.find((h) => h.profileId === "us-portfolio")?.points.filter((p) => p.hasData) || [];
const egHistory = portfolio.history.find((h) => h.profileId === "eg-portfolio")?.points.filter((p) => p.hasData) || [];

function barRow(label, pctVal, maxAbs = 5) {
  const width = Math.min(100, Math.abs(pctVal || 0) / maxAbs * 100);
  const cls = (pctVal || 0) >= 0 ? "bar-pos" : "bar-neg";
  return `<div class="bar-row"><span class="bar-label">${esc(label)}</span><div class="bar-track"><div class="bar-fill ${cls}" style="width:${width}%"></div></div><span class="bar-pct ${pctVal >= 0 ? "positive" : "negative"}">${pct(pctVal)}</span></div>`;
}

function valueBarRow(label, val, max) {
  const width = max ? Math.min(100, (val / max) * 100) : 0;
  return `<div class="bar-row"><span class="bar-label">${esc(label)}</span><div class="bar-track"><div class="bar-fill bar-info" style="width:${width}%"></div></div><span class="bar-pct">${esc(String(val))}</span></div>`;
}

const strongest5d = [...usHoldings].filter((h) => h.m?.d5 != null).sort((a, b) => b.m.d5 - a.m.d5)[0];
const weakest5d = [...usHoldings].filter((h) => h.m?.d5 != null).sort((a, b) => a.m.d5 - b.m.d5)[0];

const alerts = [];
if (usHoldings.some((h) => h.symbol === "AAPL" && h.weightPercent > 15)) {
  alerts.push({ sev: "alert-medium", icon: "⚠️", title: "AAPL — Concentration above 15%", detail: "Apple is 22.6% of the US portfolio — a single-name overweight that amplifies hardware-pricing headline risk.", action: "Watch" });
}
if (egHoldings.some((h) => h.symbol === "EGX30ETF" && h.weightPercent > 15)) {
  alerts.push({ sev: "alert-high", icon: "🔴", title: "EGX30ETF — Major concentration (59%)", detail: "Nearly 60% of Egypt portfolio is in one ETF — benchmark exposure dominates single-stock diversification.", action: "Watch" });
}
for (const h of usHoldings.filter((x) => x.action === "Consider trimming")) {
  alerts.push({ sev: "alert-medium", icon: "✂️", title: `${h.symbol} — Consider trimming label`, detail: `${h.name || h.symbol} is flagged for profit-taking or risk reduction at ${h.weightPercent?.toFixed(1)}% weight.`, action: "Consider trimming" });
}
for (const h of streakHoldings) {
  alerts.push({ sev: "alert-medium", icon: "📉", title: `${h.symbol} — ${h.m.streak}-day losing streak`, detail: `${h.symbol} has declined ${Math.abs(h.m.streak_decline || h.m.d5 || 0).toFixed(1)}% over the streak — momentum remains weak vs SPY/QQQ.`, action: "Watch" });
}
for (const h of usHoldings.filter((x) => x.rr.riskLevel === "High")) {
  alerts.push({ sev: "alert-medium", icon: "🔴", title: `${h.symbol} — High risk holding`, detail: `${h.symbol} carries elevated risk with ${pct(h.profit_loss && h.cost ? (h.profit_loss / (h.current_value - h.profit_loss)) * 100 : h.rr.profitLossPercent)} unrealized loss context.`, action: "Watch" });
}
if (Math.abs(usBiggestDown?.daily_profit_loss || 0) > 5) {
  alerts.push({ sev: "alert-low", icon: "📉", title: `${usBiggestDown.symbol} — Large daily loss`, detail: `${usBiggestDown.symbol} contributed ${fmtUsd(usBiggestDown.daily_profit_loss)} (${pct(usBiggestDown.daily_profit_loss_percent)}) — stock-specific on a modestly down tape.`, action: "Watch" });
}
alerts.push({ sev: "alert-low", icon: "📅", title: "Egypt data — prior session", detail: "EGX was closed Fri Jun 26; Egypt figures reflect Thu Jun 25 close via Mubasher EGX.", action: "Keep" });

if (!alerts.length) alerts.push({ sev: "alert-low", icon: "✅", title: "No high-severity alerts today.", detail: "Portfolio within normal risk bands.", action: "Keep" });

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Daily Portfolio Report — ${REPORT_DATE}</title>
<style>
:root {
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
footer { text-align: center; font-size: 12px; color: var(--text-muted); padding: 20px; border-top: 1px solid var(--border); margin-top: 20px; }
</style>
</head>
<body>
<div class="page-grid">

<header>
  <div class="header-top">
    <div>
      <div class="report-title">Daily Portfolio Report</div>
      <div class="report-sub">${REPORT_DATE} · US session Fri Jun 26 · danielhanna0001@gmail.com</div>
    </div>
    <div class="header-right">
      <span class="status-pill pill-open">US market closed · post-close snapshot</span>
      <div class="small muted" style="margin-top:6px">Data as of ${SNAPSHOT_AT}</div>
      <div class="small muted">Egypt session: Thu Jun 25 (EGX closed today)</div>
    </div>
  </div>
  <div class="warning-banner">Egypt portfolio reflects Thu Jun 25 EGX close; US figures are post-close Fri Jun 26. Some thin/speculative tickers (SPCX, QNT) have partial technical coverage.</div>
</header>

<section>
  <div class="section-header"><span class="section-icon">⚡</span><span class="section-title">Quick Summary</span></div>
  <div class="card-grid-sm" style="margin-bottom:16px">
    <div class="card ${usDailyPl >= 0 ? "positive" : "negative"}"><div class="card-label">US Portfolio Value</div><div class="card-value">${fmtUsd(usSnap.portfolioValue)}</div></div>
    <div class="card ${usDailyPl >= 0 ? "positive" : "negative"}"><div class="card-label">US Daily P/L</div><div class="card-value ${usDailyPl >= 0 ? "positive" : "negative"}">${fmtUsd(usDailyPl)}</div><div class="card-sub">${pct(usSnap.dailyProfitLossPercent)}</div></div>
    <div class="card"><div class="card-label">Egypt Portfolio Value</div><div class="card-value">${fmtEgp(egSnap.portfolioValue)}</div><div class="card-sub">Jun 25 session</div></div>
    <div class="card negative"><div class="card-label">Egypt Daily P/L</div><div class="card-value negative">${fmtEgp(egDailyPl)}</div><div class="card-sub">${pct(egReport.totals.dailyProfitLossPercent)}</div></div>
    <div class="card info"><div class="card-label">Total Holdings</div><div class="card-value">21</div></div>
    <div class="card warning"><div class="card-label">Holdings Needing Attention</div><div class="card-value">${attentionCount}</div></div>
  </div>
  <div class="two-col" style="margin-bottom:16px">
    <div>
      <h3 style="font-size:13px;margin-bottom:8px">Need to Know First</h3>
      <ul class="need-to-know-list">
        <li><span class="ntk-icon">📈</span><span class="ntk-label">Market Today</span><span class="ntk-value">SPY ${pct(market.SPY?.d1)} · QQQ ${pct(market.QQQ?.d1)} on Fri Jun 26 — modest risk-off in mega-cap tech.</span></li>
        <li><span class="ntk-icon">📉</span><span class="ntk-label">EGX Benchmark</span><span class="ntk-value">EGX30 −0.52% on Thu Jun 25 (51,443 pts) — Egypt session closed today.</span></li>
        <li><span class="ntk-icon">💰</span><span class="ntk-label">Daily P/L</span><span class="ntk-value">US ${fmtUsd(usDailyPl)} · Egypt ${fmtEgp(egDailyPl)} (separate currencies).</span></li>
        <li><span class="ntk-icon">📈</span><span class="ntk-label">Biggest Mover</span><span class="ntk-value">${usBiggestUp.symbol} ${pct(usBiggestUp.daily_profit_loss_percent)} — strongest US session gainer.</span></li>
        <li><span class="ntk-icon">📉</span><span class="ntk-label">Biggest Drop</span><span class="ntk-value">${usBiggestDown.symbol} ${pct(usBiggestDown.daily_profit_loss_percent)} — memory/semiconductor profit-taking after MU earnings week.</span></li>
        <li><span class="ntk-icon">🔴</span><span class="ntk-label">Losing Streak</span><span class="ntk-value">${streakHoldings.length ? streakHoldings.map((h) => `<span class="streak-badge">🔴 ${h.symbol} ${h.m.streak} days</span>`).join(" ") : "None currently"}</span></li>
        <li><span class="ntk-icon">📰</span><span class="ntk-label">Positive Catalyst</span><span class="ntk-value">HOOD +5.6% after $2.2B notes close (Jun 25) with share repurchase; platform volume records cited by analysts.</span></li>
        <li><span class="ntk-icon">🔴</span><span class="ntk-label">At Risk</span><span class="ntk-value">NVDA &amp; NBIS on 5-day losing streaks as AI infrastructure names digest cost concerns despite strong memory earnings.</span></li>
        <li><span class="ntk-icon">🟡</span><span class="ntk-label">Watch Today</span><span class="ntk-value">AAPL (22.6% weight) — bounced +3.1% on high volume after prior session price-hike selloff; monitor demand elasticity.</span></li>
        <li><span class="ntk-icon">📅</span><span class="ntk-label">Upcoming Event</span><span class="ntk-value">Micron dividend payable Jul 21 (record Jul 6) — no major portfolio earnings within 7 days verified.</span></li>
        <li><span class="ntk-icon">⚠️</span><span class="ntk-label">Data Gap</span><span class="ntk-value">Egypt quotes via Mubasher EGX; SPCX/QNT limited history for 20D/200D metrics.</span></li>
      </ul>
    </div>
    <div class="brief-box">
      <div class="brief-part"><div class="brief-part-label">MOVES &amp; TRENDS</div><div class="brief-part-text">US portfolio was essentially flat (${fmtUsd(usDailyPl)}). SPY −0.7% and QQQ −1.4% show a market-wide tech drag; HOOD, QNT, and AAPL outperformed while MU, DRAM, and NBIS lagged on memory-sector rotation. NVDA and NBIS remain on 5-day losing streaks.</div></div>
      <div class="brief-part"><div class="brief-part-label">COMING UP</div><div class="brief-part-text">No verified earnings within 7 days for core holdings. Watch continued AI/memory narrative after Micron's Jun 24 record results and Apple hardware pricing headlines from the prior session.</div></div>
      <div class="brief-part"><div class="brief-part-label">GUIDANCE</div><div class="brief-part-text">Focus on AAPL concentration and DRAM/QNT trim flags — both DRAM and QNT sit on large unrealized gains but gave back session gains today. Hold core ETF sleeves; watch memory volatility rather than adding.</div></div>
      <div class="brief-part"><div class="brief-part-label">TODAY'S IDEA</div><div class="brief-part-text">IBM shows improving 5-day momentum (+9%) with enterprise AI/defense tailwinds — see Opportunity card below.</div></div>
    </div>
  </div>
  <div class="opportunity-card">
    <div class="two-col">
      <div>
        <div class="opportunity-eyebrow">Today's Watchlist Idea</div>
        <div class="opportunity-ticker">IBM</div>
        <div class="opportunity-name">International Business Machines Corporation</div>
        <div class="opportunity-reason">IBM rose 5.2% on Fri Jun 26 with improving 5-day (+9%) and 20-day (+2.8%) momentum, trading above its 50-day average while the broader QQQ fell 1.4%. Enterprise AI and hybrid-cloud demand provide a sector-strength catalyst distinct from the mega-cap AI selloff. Volume was average — not a low-conviction spike.</div>
        <div class="opportunity-note">Watchlist idea only — not a buy recommendation.</div>
      </div>
      <table style="font-size:12px;width:100%">
        <tr><td class="muted">Sector</td><td>Enterprise Software / AI Infrastructure</td></tr>
        <tr><td class="muted">Catalyst</td><td>Enterprise AI adoption; relative strength vs QQQ</td></tr>
        <tr><td class="muted">Technical Setup</td><td>RSI 53.9 · above 50D MA · MACD above signal</td></tr>
        <tr><td class="muted">Risk Level</td><td>${badge("badge-yellow", "Medium")}</td></tr>
        <tr><td class="muted">Watch Horizon</td><td>1–2 weeks</td></tr>
        <tr><td class="muted">What Would Invalidate It</td><td>Break below 50D MA (~$253) on rising volume</td></tr>
      </table>
    </div>
  </div>
</section>

<section>
  <div class="section-header"><span class="section-icon">🚨</span><span class="section-title">Needs Attention First</span></div>
  ${alerts.map((a) => `<div class="alert ${a.sev}"><span class="alert-icon">${a.icon}</span><div><div class="alert-title">${esc(a.title)}</div><div class="alert-detail">${esc(a.detail)}</div><div class="alert-action">Suggested action: ${esc(a.action)}</div></div></div>`).join("")}
</section>

<section>
  <div class="section-header"><span class="section-icon">📊</span><span class="section-title">Summary Cards</span></div>
  <div class="card-grid">
    <div class="card"><div class="card-label">US Portfolio Value</div><div class="card-value">${fmtUsd(usSnap.portfolioValue)}</div></div>
    <div class="card negative"><div class="card-label">US Daily P/L</div><div class="card-value negative">${fmtUsd(usDailyPl)}</div></div>
    <div class="card"><div class="card-label">Egypt Portfolio Value</div><div class="card-value">${fmtEgp(egSnap.portfolioValue)}</div></div>
    <div class="card negative"><div class="card-label">Egypt Daily P/L</div><div class="card-value negative">${fmtEgp(egDailyPl)}</div></div>
    <div class="card positive"><div class="card-label">Biggest Positive Mover</div><div class="card-value positive">${usBiggestUp.symbol} ${pct(usBiggestUp.daily_profit_loss_percent)}</div></div>
    <div class="card negative"><div class="card-label">Biggest Negative Mover</div><div class="card-value negative">${usBiggestDown.symbol} ${pct(usBiggestDown.daily_profit_loss_percent)}</div></div>
    <div class="card warning"><div class="card-label">Largest Holding</div><div class="card-value">EGX30ETF 59.1%</div><div class="card-sub">US: AAPL 22.6%</div></div>
    <div class="card warning"><div class="card-label">Biggest Risk</div><div class="card-value">NFLX</div><div class="card-sub">High risk · −24.7% unrealized</div></div>
    <div class="card info"><div class="card-label">Upcoming Catalyst</div><div class="card-value">MU dividend</div><div class="card-sub">Jul 21, 2026 payable</div></div>
    <div class="card warning"><div class="card-label">Holdings Needing Attention</div><div class="card-value">${attentionCount}</div></div>
    <div class="card info"><div class="card-label">Watchlist Idea</div><div class="card-value">IBM</div></div>
    <div class="card negative"><div class="card-label">Worst Losing Streak</div><div class="card-value">NVDA · 5 days</div></div>
    <div class="card positive"><div class="card-label">Strongest 5-Day Momentum</div><div class="card-value">${strongest5d?.symbol || "N/A"} ${pct(strongest5d?.m?.d5)}</div></div>
    <div class="card negative"><div class="card-label">Weakest 5-Day Momentum</div><div class="card-value">${weakest5d?.symbol || "N/A"} ${pct(weakest5d?.m?.d5)}</div></div>
  </div>
</section>

<section>
  <div class="section-header"><span class="section-icon">📈</span><span class="section-title">Trend and Progress Charts</span></div>
  <h4 style="margin-bottom:8px">A. Portfolio Value Trend (USD — last 7 sessions with data)</h4>
  ${usHistory.slice(-7).map((p) => valueBarRow(p.date, Math.round(p.portfolioValue), 3100)).join("")}
  <h4 style="margin:16px 0 8px">Portfolio Value Trend (EGP — last 7 sessions with data)</h4>
  ${egHistory.slice(-7).map((p) => valueBarRow(p.date, Math.round(p.portfolioValue), 125000)).join("")}
  <h4 style="margin:16px 0 8px">B. Daily P/L Trend (USD)</h4>
  ${usHistory.slice(-7).filter((p) => p.hasPlData).map((p) => barRow(p.date, p.dailyProfitLossPercent, 4)).join("")}
  <h4 style="margin:16px 0 8px">C. Winners vs Losers (5D %)</h4>
  ${[...usHoldings].filter((h) => h.m?.d5 != null).sort((a, b) => b.m.d5 - a.m.d5).map((h) => barRow(h.symbol, h.m.d5, 25)).join("")}
  <h4 style="margin:16px 0 8px">D. Losing Streak Indicator</h4>
  <div class="table-wrap"><table>
    <thead><tr><th>Ticker</th><th>Streak Days</th><th>Total Decline</th><th>Possible Reason</th><th>Action</th></tr></thead>
    <tbody>${streakHoldings.length ? streakHoldings.map((h) => `<tr style="background:var(--negative-bg)"><td>${h.symbol}</td><td><span class="streak-badge">🔴 ${h.m.streak} days</span></td><td class="negative">${pct(h.m.streak_decline || h.m.d5)}</td><td>AI infrastructure cost concerns; market-wide tech weakness</td><td>${actionBadge(h.action)}</td></tr>`).join("") : `<tr><td colspan="5">No holdings with a 3+ day losing streak in the current data.</td></tr>`}</tbody>
  </table></div>
</section>

<section>
  <div class="section-header"><span class="section-icon">🥧</span><span class="section-title">Portfolio Allocation</span></div>
  <h4>US Portfolio</h4>
  ${[...usHoldings].sort((a, b) => b.weightPercent - a.weightPercent).map((h) => {
    const w = h.weightPercent || 0;
    return `<div class="bar-row"><span class="bar-label">${h.symbol}</span><div class="bar-track"><div class="bar-fill bar-info" style="width:${Math.min(100, w)}%"></div></div><span class="bar-pct">${w.toFixed(1)}%${w > 15 ? ' ' + badge('badge-orange', '⚠ >15%') : ''}</span></div>`;
  }).join("")}
  <ul class="small muted" style="margin:8px 0 16px;padding-left:18px"><li>Largest: AAPL 22.6% — single-stock concentration risk</li><li>ETF balance: QQQM, VOO, SCHG, DRAM provide index/sector exposure</li><li>Speculative: NASA, SMR, SPCX, QNT are smaller thematic bets</li></ul>
  <h4>Egypt Portfolio (Jun 25)</h4>
  ${[...egHoldings].sort((a, b) => b.weightPercent - a.weightPercent).map((h) => {
    const w = h.weightPercent || 0;
    return `<div class="bar-row"><span class="bar-label">${h.symbol}</span><div class="bar-track"><div class="bar-fill bar-warn" style="width:${Math.min(100, w)}%"></div></div><span class="bar-pct">${w.toFixed(1)}%${w > 15 ? ' ' + badge('badge-orange', '⚠ >15%') : ''}</span></div>`;
  }).join("")}
  <ul class="small muted" style="margin-top:8px;padding-left:18px"><li>EGX30ETF dominates at 59% — benchmark concentration</li><li>RAYA 15.8% and ORHD 12.8% add single-name Egypt exposure</li></ul>
</section>

<section>
  <div class="section-header"><span class="section-icon">📋</span><span class="section-title">Priority-Sorted Holdings Table</span></div>
  <div class="sort-bar"><button class="sort-btn active" type="button">Priority</button><button class="sort-btn" type="button">Weight</button><button class="sort-btn" type="button">Daily P/L</button></div>
  <div class="table-wrap"><table id="holdings-table">
    <thead><tr><th>Ticker</th><th>Market</th><th>Weight</th><th>Value</th><th>Daily P/L</th><th>1D Move</th><th>5D Move</th><th>Unrealized P/L</th><th>Risk</th><th>Catalyst</th><th>Action</th><th>Data</th><th>Main Reason</th></tr></thead>
    <tbody>
    ${sortedHoldings.map((h) => {
      const m = h.m || {};
      const rowBg = (m.streak >= 3) ? ' style="background:var(--negative-bg)"' : '';
      const val = h.currency === "USD" ? fmtUsd(h.current_value) : fmtEgp(h.current_value);
      const dpl = h.currency === "USD" ? fmtUsd(h.daily_profit_loss) : fmtEgp(h.daily_profit_loss);
      const upl = h.currency === "USD" ? fmtUsd(h.profit_loss) : fmtEgp(h.profit_loss);
      const catalyst = h.symbol === "MU" ? "Memory earnings Jun 24" : h.symbol === "AAPL" ? "Price hike rebound" : h.symbol === "HOOD" ? "Capital raise closed" : h.symbol === "ORHD" ? "Note: sell soon" : "No clear catalyst";
      const reason = h.action === "Consider trimming" ? "Large gain / trim flag" : h.rr.riskLevel === "High" ? "High risk + drawdown" : (m.streak >= 3) ? "Multi-day losing streak" : "Core holding";
      return `<tr${rowBg}><td><strong>${h.symbol}</strong></td><td>${h.market}</td><td>${(h.weightPercent||0).toFixed(1)}%</td><td>${val}</td><td class="${(h.daily_profit_loss||0)>=0?'positive':'negative'}">${dpl}</td><td>${pct(m.d1 ?? h.daily_profit_loss_percent)}</td><td>${pct(m.d5)}</td><td class="${(h.profit_loss||0)>=0?'positive':'negative'}">${upl}</td><td>${riskBadge(h.rr.riskLevel)}</td><td class="small">${esc(catalyst)}</td><td>${actionBadge(h.action)}</td><td>${dataBadge(dataQuality(h.symbol, m))}</td><td class="small">${esc(reason)}</td></tr>`;
    }).join("")}
    </tbody>
  </table></div>
</section>

<section>
  <div class="section-header"><span class="section-icon">💵</span><span class="section-title">Daily P/L Contribution</span></div>
  <h4>US Portfolio</h4>
  <div class="table-wrap"><table><thead><tr><th>Ticker</th><th>Daily P/L</th><th>Daily % Move</th><th>Weight</th><th>Impact Driver</th></tr></thead><tbody>
  ${[...usHoldings].sort((a,b)=>Math.abs(b.daily_profit_loss)-Math.abs(a.daily_profit_loss)).map((h)=>{
    const driver = Math.abs(h.daily_profit_loss) > 5 && h.weightPercent > 5 ? "Both" : h.weightPercent > 8 ? "Size-driven" : "Price-driven";
    return `<tr><td>${h.symbol}</td><td class="${h.daily_profit_loss>=0?'positive':'negative'}">${fmtUsd(h.daily_profit_loss)}</td><td>${pct(h.daily_profit_loss_percent)}</td><td>${h.weightPercent.toFixed(1)}%</td><td>${driver}</td></tr>`;
  }).join("")}
  </tbody></table></div>
  <h4 style="margin-top:16px">Egypt Portfolio (Jun 25)</h4>
  <div class="table-wrap"><table><thead><tr><th>Ticker</th><th>Daily P/L</th><th>Daily % Move</th><th>Weight</th><th>Impact Driver</th></tr></thead><tbody>
  ${[...egHoldings].sort((a,b)=>Math.abs(b.daily_profit_loss)-Math.abs(a.daily_profit_loss)).map((h)=>{
    return `<tr><td>${h.symbol}</td><td class="${h.daily_profit_loss>=0?'positive':'negative'}">${fmtEgp(h.daily_profit_loss)}</td><td>${pct(h.daily_profit_loss_percent)}</td><td>${h.weightPercent.toFixed(1)}%</td><td>Price-driven</td></tr>`;
  }).join("")}
  </tbody></table></div>
</section>

<section>
  <div class="section-header"><span class="section-icon">🏃</span><span class="section-title">Recent Performance</span></div>
  ${[...usHoldings].filter(h=>h.m?.d5!=null).sort((a,b)=>b.m.d5-a.m.d5).map(h=>`<div class="bar-row"><span class="bar-label">${h.symbol}</span><span class="small" style="min-width:45px">${pct(h.m.d1)}</span><span class="small" style="min-width:45px">${pct(h.m.d3)}</span><span class="small" style="min-width:45px">${pct(h.m.d5)}</span><span class="small" style="min-width:45px">${pct(h.m.d20)}</span></div>`).join("")}
  <p class="small muted" style="margin-top:12px">IBM and HOOD show strongest 5-day momentum; NASA, SPCX, and NBIS weakest. Today's US moves were mixed vs SPY/QQQ — memory names (MU, DRAM) saw stock-specific profit-taking after earnings, while AAPL bounced on high volume despite prior price-hike headlines.</p>
</section>

<section>
  <div class="section-header"><span class="section-icon">📉</span><span class="section-title">Technical Signals</span></div>
  <div class="table-wrap"><table><thead><tr><th>Ticker</th><th>RSI-14</th><th>vs 20D MA</th><th>vs 50D MA</th><th>vs 200D MA</th><th>Volume vs 20D</th><th>MACD</th><th>Momentum</th><th>Technical Read</th><th>Caution</th></tr></thead><tbody>
  ${[...usHoldings].sort((a,b)=>{
    const order = { Bearish:0, Weakening:1, Unclear:2, Neutral:3, Improving:4, Bullish:5 };
    return (order[a.tech.read]??2)-(order[b.tech.read]??2);
  }).map((h)=>{
    const m = h.m||{};
    return `<tr><td>${h.symbol}</td><td>${m.rsi ?? "Not available."}${m.rsi?" (Yahoo, Jun 26 close)":""}</td><td>${vsMa(m.price,m.ma20)}</td><td>${vsMa(m.price,m.ma50)}</td><td>Not available.</td><td>${esc(m.vol_label||"Not available.")}</td><td class="small">${esc(m.macd||"Not available.")}</td><td>${pct(m.d5)}</td><td>${techBadge(h.tech.read)}</td><td class="small">${esc(h.tech.caution||"—")}</td></tr>`;
  }).join("")}
  </tbody></table></div>
</section>

<section>
  <div class="section-header"><span class="section-icon">📰</span><span class="section-title">News and Catalysts</span></div>
  <details open><summary>Negative <span class="badge badge-red">2</span></summary><div>
    <p><strong>NVDA</strong> — AI infrastructure cost concerns weighing on mega-cap tech (FXStreet, Jun 26, 2026). Sector-driven weakness; 5-day streak continues.</p>
    <p><strong>MU</strong> — Profit-taking after +15.7% earnings surge (Motley Fool, Jun 26, 2026). Fundamentals strong but session −6.7%.</p>
  </div></details>
  <details><summary>Mixed <span class="badge badge-yellow">2</span></summary><div>
    <p><strong>AAPL</strong> — Mac/iPad price hikes cited as demand risk (BusinessWorld, Jun 26) but shares rebounded +3.1% Fri on high volume — mixed near-term.</p>
    <p><strong>HOOD</strong> — $2.2B convertible notes closed Jun 25 (GlobeNewswire) with dilution offset via repurchase; stock +5.6% today.</p>
  </div></details>
  <details><summary>Positive <span class="badge badge-green">2</span></summary><div>
    <p><strong>MU</strong> — Record Q3 FY26 results, $50B Q4 guide, supply tight through 2027+ (GlobeNewswire, Jun 24, 2026).</p>
    <p><strong>IBM</strong> — Relative strength on enterprise AI/hybrid cloud positioning amid tech selloff (session +5.2%).</p>
  </div></details>
  <details><summary>Neutral <span class="badge badge-gray">1</span></summary><div>
    <p><strong>EGX30ETF</strong> — EGX30 −0.52% Thu Jun 25; foreign net buyers per market data (Belbalady, Jun 25).</p>
  </div></details>
</section>

<section>
  <div class="section-header"><span class="section-icon">📅</span><span class="section-title">Upcoming Earnings and Events</span></div>
  <div class="table-wrap"><table><thead><tr><th>Ticker</th><th>Event</th><th>Date</th><th>Days Away</th><th>Importance</th><th>Why It Matters</th></tr></thead><tbody>
    <tr style="background:var(--info-bg)"><td>MU</td><td>Quarterly dividend payable</td><td>2026-07-21</td><td>25</td><td>Low</td><td>$0.15/share — income event, not earnings</td></tr>
    <tr><td colspan="6" class="muted">No major upcoming earnings within 14 days verified for portfolio holdings.</td></tr>
  </tbody></table></div>
</section>

<section>
  <div class="section-header"><span class="section-icon">⚠️</span><span class="section-title">Portfolio Risk Notes</span></div>
  <details open><summary>Concentration risk</summary><div>AAPL 22.6% US; EGX30ETF 59% Egypt; RAYA 15.8%. Reduce single-name risk before adding new positions.</div></details>
  <details><summary>Sector risk</summary><div>Heavy tech/semiconductor/memory exposure (AAPL, NVDA, MU, DRAM, TSM, NBIS). Correlated drawdowns likely when AI narrative shifts.</div></details>
  <details><summary>ETF overlap</summary><div>QQQM, VOO, SCHG overlap in large-cap US growth — combined ~24% US weight in index products plus AAPL directly.</div></details>
  <details><summary>Speculative exposure</summary><div>NASA, SMR, SPCX, QNT — thematic/small positions; high volatility, limited fundamental coverage.</div></details>
  <details><summary>Currency/geography</summary><div>USD and EGP books separate; do not sum totals. Egypt session lags US by one day when EGX closed.</div></details>
</section>

<section>
  <div class="section-header"><span class="section-icon">🔄</span><span class="section-title">What Changed Today</span></div>
  <ul class="small" style="padding-left:18px;line-height:1.8">
    <li>US portfolio value ${fmtUsd(usHistory.at(-2)?.portfolioValue || 2998.14)} → ${fmtUsd(usSnap.portfolioValue)} (${fmtUsd(usDailyPl)} daily).</li>
    <li>AAPL recovered +3.1% after prior session price-hike selloff — largest positive contributor by dollars.</li>
    <li>DRAM and QNT remain on Consider trimming labels; both gave back session gains (DRAM −6.5%, QNT still +5.4%).</li>
    <li>NVDA/NBIS losing streaks extended to 5 sessions — action labels unchanged (Keep) but risk elevated.</li>
    <li>Egypt: no new session today; last close Jun 25 with EGX30 −0.52%.</li>
    <li>Watch tomorrow: memory sector follow-through after MU post-earnings volatility.</li>
  </ul>
</section>

<section>
  <div class="section-header"><span class="section-icon">👀</span><span class="section-title">Watchlist</span></div>
  <div class="table-wrap"><table><thead><tr><th>Ticker</th><th>Company</th><th>Why Interesting</th><th>Technical Setup</th><th>Catalyst</th><th>Risk</th><th>Watch Level</th><th>More Interesting If</th><th>Invalidate If</th></tr></thead><tbody>
    <tr><td>IBM</td><td>IBM Corp</td><td>Enterprise AI relative strength</td><td>Above 50D MA, RSI 54</td><td>Hybrid cloud demand</td><td>Medium</td><td>${badge("badge-blue","High priority")}</td><td>Holds above $270 on volume</td><td>Break below 50D MA</td></tr>
    <tr><td>TSM</td><td>TSMC</td><td>Foundry leverage to AI chips</td><td>Near 20D MA, RSI 52</td><td>AI capex cycle</td><td>Low</td><td>${badge("badge-gray","Medium priority")}</td><td>Reclaims 20D MA with volume</td><td>5D streak extends below $420</td></tr>
    <tr><td>HOOD</td><td>Robinhood</td><td>Record platform volumes cited</td><td>Above 20D/50D MA</td><td>Jun 25 notes close + buyback</td><td>Medium</td><td>${badge("badge-gray","Medium priority")}</td><td>Sustains $95+ post-dilution fears</td><td>Fails below 20D MA (~$94)</td></tr>
  </tbody></table></div>
  <p class="small muted" style="margin-top:8px">Watchlist only — not a buy recommendation.</p>
</section>

<section>
  <div class="section-header"><span class="section-icon">✅</span><span class="section-title">Final Action Summary</span></div>
  <div class="three-col">
    <div class="card positive"><div class="card-label">Keep / Add Candidates</div><div class="card-sub" style="margin-top:8px">${usHoldings.filter(h=>h.action==="Keep").map(h=>`<div style="margin-bottom:6px"><strong>${h.symbol}</strong> — ${h.rr.riskLevel==="High"?"High risk but holding": "Core position"}</div>`).join("")}</div></div>
    <div class="card warning"><div class="card-label">Watch Closely</div><div class="card-sub" style="margin-top:8px"><div><strong>AAPL</strong> — 22.6% weight + price-hike narrative</div><div><strong>NVDA/NBIS</strong> — 5-day losing streaks</div><div><strong>NFLX/NASA</strong> — high risk drawdowns</div></div></div>
    <div class="card negative"><div class="card-label">Consider Trimming / Do Not Add</div><div class="card-sub" style="margin-top:8px">${usHoldings.filter(h=>h.action==="Consider trimming").map(h=>`<div><strong>${h.symbol}</strong> — Large unrealized gain; trim flag active</div>`).join("")}</div></div>
  </div>
</section>

<section>
  <div class="section-header"><span class="section-icon">📚</span><span class="section-title">Sources and Data Notes</span></div>
  <ul class="small" style="padding-left:18px;line-height:1.8">
    <li>Portfolio accounting: Portfolio Exit Planner API snapshot (${SNAPSHOT_AT})</li>
    <li>US prices/technicals: Yahoo Finance chart API — most recent close Jun 26, 2026</li>
    <li>Benchmarks: SPY, QQQ (Yahoo); EGX30 (Belbalady / Amwal Al Ghad, Jun 25, 2026)</li>
    <li>News: GlobeNewswire, Motley Fool, BusinessWorld, FXStreet, InvestingNews (Jun 24–26, 2026)</li>
    <li>Limitations: 200D MA unavailable for many tickers (insufficient history in fetch); SPCX/QNT partial; Egypt technicals not computed</li>
    <li>Egypt quotes via Mubasher EGX per app warning</li>
  </ul>
</section>

<footer>This is analysis for decision support, not financial advice or automatic trading.</footer>
</div>
<script>
document.querySelectorAll('.sort-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});
</script>
</body>
</html>`;

const outPath = join(process.cwd(), "docs/reports/.raw", `portfolio-report-${REPORT_DATE}.html`);
mkdirSync(join(process.cwd(), "docs/reports/.raw"), { recursive: true });
writeFileSync(outPath, html, "utf8");
console.log(`Wrote ${outPath} (${html.length} bytes)`);
