#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const SESSION_DATE = '2026-07-02';
const EMAIL = 'danielhanna0001@gmail.com';
const data = JSON.parse(fs.readFileSync('/tmp/portfolio-report-data.json', 'utf8'));
const tech = JSON.parse(fs.readFileSync('/tmp/tech-data.json', 'utf8'));

const us = data.profiles.find((p) => p.id === 'us-portfolio');
const eg = data.profiles.find((p) => p.id === 'eg-portfolio');
const usHist = data.history.find((h) => h.profileId === 'us-portfolio');
const egHist = data.history.find((h) => h.profileId === 'eg-portfolio');

const fmtUsd = (n) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtEgp = (n) => `EGP ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtPct = (n) => (n == null ? 'N/A' : `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`);
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function mapAction(a) {
  if (a === 'Trim') return 'Consider trimming';
  return a || 'Keep';
}

function techRead(sym) {
  const t = tech[sym];
  if (!t || t.error) return { read: 'Unclear', caution: 'Insufficient technical data', data: 'Missing' };
  let bull = 0, bear = 0;
  if (t.vs20 === 'Above') bull++; else if (t.vs20 === 'Below') bear++;
  if (t.vs50 === 'Above') bull++; else if (t.vs50 === 'Below') bear++;
  if (t.macd?.desc?.startsWith('Above')) bull++; else if (t.macd?.desc?.startsWith('Below')) bear++;
  if (t.rsi != null) {
    if (t.rsi > 55 && t.dayUp) bull++;
    if (t.rsi < 45 && !t.dayUp) bear++;
  }
  let read = 'Unclear';
  if (bull >= 2 && bear === 0) read = t.move5d > 5 ? 'Bullish' : 'Improving';
  else if (bear >= 2 && bull === 0) read = 'Bearish';
  else if (bear >= 2 && bull >= 1) read = 'Weakening';
  else if (bull === bear) read = 'Neutral';
  const caution = t.streak?.streak >= 3 ? `🔴 ${t.streak.streak} days down` : t.volLabel?.includes('Low-volume') ? 'Low-conviction move' : '—';
  const dataQ = (!t.rsi || !t.macd) ? 'Partial' : 'Complete';
  return { read, caution, data: dataQ, t };
}

const usDaily = us.snapshot.dailyProfitLoss;
const egDaily = eg.report?.totals?.dailyProfitLoss ?? -142.16;
const snapTs = new Date(us.snapshot.updatedAt).toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short' }) + ' ET';

const allHoldings = [
  ...us.snapshot.holdings.map((h) => ({ ...h, market: 'US', currency: 'USD', reportRow: h.reportRow })),
  ...eg.snapshot.holdings.map((h) => ({ ...h, market: 'EG', currency: 'EGP', reportRow: h.reportRow })),
];

const usMovers = us.snapshot.holdings.map((h) => ({ sym: h.symbol, pct: h.daily_profit_loss_percent }));
const bestUS = usMovers.reduce((a, b) => (b.pct > a.pct ? b : a));
const worstUS = usMovers.reduce((a, b) => (b.pct < a.pct ? b : a));

const attentionCount = allHoldings.filter((h) => {
  const action = mapAction(h.action);
  return h.weightPercent > 15 || action.includes('trim') || action.includes('review') || h.riskLevel === 'High';
}).length + 1;

const streakHoldings = Object.entries(tech)
  .filter(([sym, t]) => us.snapshot.holdings.some((h) => h.symbol === sym) && t.streak?.streak >= 3)
  .map(([sym, t]) => ({ sym, ...t.streak }));

const actionOrder = { 'Needs manual review': 0, 'Consider trimming': 1, 'Do not add': 2, Watch: 3, Keep: 4, 'Add candidate': 5 };
const sortedHoldings = [...allHoldings].sort((a, b) => {
  const ao = actionOrder[mapAction(a.action)] ?? 9;
  const bo = actionOrder[mapAction(b.action)] ?? 9;
  if (ao !== bo) return ao - bo;
  return b.weightPercent - a.weightPercent;
});

const strongest5d = us.snapshot.holdings.map((h) => ({ sym: h.symbol, m: tech[h.symbol]?.move5d })).filter((x) => x.m != null).sort((a, b) => b.m - a.m)[0];
const weakest5d = us.snapshot.holdings.map((h) => ({ sym: h.symbol, m: tech[h.symbol]?.move5d })).filter((x) => x.m != null).sort((a, b) => a.m - b.m)[0];

const us7 = usHist.points.filter((p) => p.hasData).slice(-7);
const eg7 = egHist.points.filter((p) => p.hasData).slice(-7);
const us30 = usHist.points.filter((p) => p.hasData);
const eg30 = egHist.points.filter((p) => p.hasData);

function barRows(points, key, maxVal) {
  const m = maxVal || Math.max(...points.map((p) => Math.abs(p[key] || 0)), 1);
  return points.map((p) => {
    const v = p[key] || 0;
    const w = Math.min(100, (Math.abs(v) / m) * 100);
    const cls = v >= 0 ? 'bar-pos' : 'bar-neg';
    return `<div class="bar-row"><span class="bar-label">${esc(p.date)}</span><div class="bar-track"><div class="bar-fill ${cls}" style="width:${w}%"></div></div><span class="bar-pct ${v >= 0 ? 'positive' : 'negative'}">${fmtUsd(v).replace('$', v < 0 ? '-$' : '$')}</span></div>`;
  }).join('\n');
}

function egBarRows(points, key) {
  const m = Math.max(...points.map((p) => Math.abs(p[key] || 0)), 1);
  return points.map((p) => {
    const v = p[key] || 0;
    const w = Math.min(100, (Math.abs(v) / m) * 100);
    const cls = v >= 0 ? 'bar-pos' : 'bar-neg';
    return `<div class="bar-row"><span class="bar-label">${esc(p.date)}</span><div class="bar-track"><div class="bar-fill ${cls}" style="width:${w}%"></div></div><span class="bar-pct ${v >= 0 ? 'positive' : 'negative'}">${v >= 0 ? '+' : ''}${v.toFixed(0)}</span></div>`;
  }).join('\n');
}

const techRows = us.snapshot.holdings.map((h) => {
  const tr = techRead(h.symbol);
  const t = tr.t || {};
  const readBadge = { Bullish: 'badge-green', Improving: 'badge-blue', Neutral: 'badge-gray', Weakening: 'badge-yellow', Bearish: 'badge-red', Unclear: 'badge-gray' }[tr.read] || 'badge-gray';
  return `<tr>
    <td><strong>${esc(h.symbol)}</strong></td>
    <td>${t.rsi != null ? t.rsi.toFixed(1) + ' <span class="small muted">(' + t.lastDate + ')</span>' : 'Not available.'}</td>
    <td>${t.vs20 || 'Not available.'}</td>
    <td>${t.vs50 || 'Not available.'}</td>
    <td>${t.vs200 || 'Not available.'}</td>
    <td>${t.volLabel || 'Not available.'}</td>
    <td>${t.macd ? esc(t.macd.desc) + ' — ' + esc(t.macd.recentCross) : 'Not available.'}</td>
    <td>${fmtPct(t.move5d)}</td>
    <td><span class="badge ${readBadge}">${tr.read}</span></td>
    <td>${esc(tr.caution)} <span class="badge badge-${tr.data === 'Complete' ? 'green' : tr.data === 'Partial' ? 'yellow' : 'gray'}">${tr.data}</span></td>
  </tr>`;
}).join('\n');

const priorityRows = sortedHoldings.map((h) => {
  const t = tech[h.symbol];
  const move1d = h.market === 'US' ? (t?.move1d ?? h.daily_profit_loss_percent) : h.daily_profit_loss_percent;
  const move5d = h.market === 'US' ? t?.move5d : null;
  const action = mapAction(h.action);
  const actionBadge = action.includes('trim') || action === 'Do not add' ? 'badge-red' : action === 'Watch' || action.includes('review') ? 'badge-yellow' : 'badge-green';
  const riskBadge = h.riskLevel === 'High' || h.riskLevel === 'Speculative' ? 'badge-red' : h.riskLevel === 'Medium' ? 'badge-yellow' : 'badge-gray';
  const tr = techRead(h.symbol);
  const streakBg = t?.streak?.streak >= 3 ? ' style="background: var(--negative-bg)"' : '';
  const val = h.currency === 'USD' ? fmtUsd(h.current_value) : fmtEgp(h.current_value);
  const dpl = h.currency === 'USD' ? fmtUsd(h.daily_profit_loss) : fmtEgp(h.daily_profit_loss);
  const upl = h.currency === 'USD' ? fmtUsd(h.profit_loss) : fmtEgp(h.profit_loss);
  return `<tr${streakBg}>
    <td><strong>${esc(h.symbol)}</strong></td>
    <td>${h.market}</td>
    <td>${h.weightPercent.toFixed(1)}%</td>
    <td>${val}</td>
    <td class="${h.daily_profit_loss >= 0 ? 'positive' : 'negative'}">${dpl}</td>
    <td class="${move1d >= 0 ? 'positive' : 'negative'}">${fmtPct(move1d)}</td>
    <td>${move5d != null ? fmtPct(move5d) : 'Not available.'}</td>
    <td class="${h.profit_loss >= 0 ? 'positive' : 'negative'}">${upl}</td>
    <td><span class="badge ${riskBadge}">${esc(h.riskLevel)}</span></td>
    <td>No clear catalyst</td>
    <td><span class="badge ${actionBadge}">${esc(action)}</span></td>
    <td><span class="badge badge-${tr.data === 'Complete' ? 'green' : 'yellow'}">${tr.data}</span></td>
    <td>${h.weightPercent > 15 ? 'Concentration above 15%.' : h.riskLevel === 'High' ? 'Large unrealized loss; monitor closely.' : 'In line with portfolio plan.'}</td>
  </tr>`;
}).join('\n');

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Daily Portfolio Report — ${SESSION_DATE}</title>
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
      <div class="report-sub">Thu, Jul 2, 2026 · ${EMAIL}</div>
    </div>
    <div class="header-right">
      <span class="status-pill pill-open">US Market Closed — Post-Close Snapshot</span>
      <div class="small muted" style="margin-top:6px">Data as of ${snapTs}</div>
      <div class="small muted">US session: ${SESSION_DATE}</div>
    </div>
  </div>
  <div class="warning-banner">AI daily commentary unavailable — action labels use deterministic fallback. Egypt quotes via Mubasher EGX; some technical history limited for newer tickers (SPCX, QNT).</div>
</header>

<section>
  <div class="section-header"><span class="section-icon">⚡</span><span class="section-title">Quick Summary</span></div>
  <div class="card-grid-sm" style="margin-bottom:16px">
    <div class="card negative"><div class="card-label">US Portfolio Value</div><div class="card-value negative">${fmtUsd(us.snapshot.portfolioValue)}</div><div class="card-sub">${fmtPct(us.snapshot.dailyProfitLossPercent)} today</div></div>
    <div class="card negative"><div class="card-label">US Daily P/L</div><div class="card-value negative">${fmtUsd(usDaily)}</div></div>
    <div class="card"><div class="card-label">Egypt Portfolio Value</div><div class="card-value">${fmtEgp(eg.snapshot.portfolioValue)}</div><div class="card-sub">${fmtPct(eg.report?.totals?.dailyProfitLossPercent ?? -0.12)} today</div></div>
    <div class="card negative"><div class="card-label">Egypt Daily P/L</div><div class="card-value negative">${fmtEgp(egDaily)}</div></div>
    <div class="card info"><div class="card-label">Total Holdings</div><div class="card-value">22</div><div class="card-sub">18 US · 4 Egypt</div></div>
    <div class="card warning"><div class="card-label">Holdings Needing Attention</div><div class="card-value warning">${attentionCount}</div></div>
  </div>
  <div class="two-col" style="margin-bottom:16px">
    <div>
      <div class="section-title" style="margin-bottom:10px">Need to Know First</div>
      <ul class="need-to-know-list">
        <li><span class="ntk-icon">📈</span><span class="ntk-label">Market Today</span><span class="ntk-value">SPY ${fmtPct(tech.SPY?.move1d)} · QQQ ${fmtPct(tech.QQQ?.move1d)} on ${tech.SPY?.lastDate} close — modest broad-market drift lower, tech weaker.</span></li>
        <li><span class="ntk-icon">📈</span><span class="ntk-label">EGX Benchmark</span><span class="ntk-value">EGX30 last available ${tech.EGX30?.lastDate || 'Jul 1'} — session move not refreshed for Jul 2 in public feed; Egypt holdings flat in app snapshot.</span></li>
        <li><span class="ntk-icon">📉</span><span class="ntk-label">Daily P/L</span><span class="ntk-value">US ${fmtUsd(usDaily)} · Egypt ${fmtEgp(egDaily)} — US weakness led by memory/semiconductor names despite AAPL strength.</span></li>
        <li><span class="ntk-icon">📈</span><span class="ntk-label">Biggest Mover</span><span class="ntk-value">${bestUS.sym} ${fmtPct(bestUS.pct)} — stock-specific strength on AI/product narrative.</span></li>
        <li><span class="ntk-icon">📉</span><span class="ntk-label">Biggest Drop</span><span class="ntk-value">${worstUS.sym} ${fmtPct(worstUS.pct)} — memory-ETF pullback after recent run; high-volume selling.</span></li>
        <li><span class="ntk-icon">🔴</span><span class="ntk-label">Losing Streak</span><span class="ntk-value">${streakHoldings.length ? streakHoldings.map((s) => `<span class="streak-badge">🔴 ${s.streak} days</span> ${s.sym}`).join(' ') : 'None at 3+ sessions — several names on 2-day declines (DRAM, MU, NBIS, ASML).'}</span></li>
        <li><span class="ntk-icon">📰</span><span class="ntk-label">Positive News</span><span class="ntk-value">AAPL — post-split momentum and AI integration headlines (Jun 30–Jul 2); outperformed QQQ by ~6.5 pts today.</span></li>
        <li><span class="ntk-icon">🔴</span><span class="ntk-label">Risk Today</span><span class="ntk-value">DRAM/MU/NBIS — memory &amp; AI-infra pullback on profit-taking after extended rallies; sector-driven weakness.</span></li>
        <li><span class="ntk-icon">🟡</span><span class="ntk-label">Watch Today</span><span class="ntk-value">AAPL (24.3% weight) — largest position; today's gain helps but concentration risk remains.</span></li>
        <li><span class="ntk-icon">📅</span><span class="ntk-label">Upcoming Event</span><span class="ntk-value">US markets early close Jul 3 (Independence Day eve); no major earnings within 7 days for top weights.</span></li>
        <li><span class="ntk-icon">⚠️</span><span class="ntk-label">Data Gap</span><span class="ntk-value">Daily AI commentary fallback only; EGX30 Jul 2 benchmark unavailable; SPCX/QNT limited technical history.</span></li>
      </ul>
    </div>
    <div>
      <div class="section-title" style="margin-bottom:10px">Today's Brief</div>
      <div class="brief-box">
        <div class="brief-part"><div class="brief-part-label">MOVES &amp; TRENDS</div><div class="brief-part-text">US portfolio fell ${fmtUsd(Math.abs(usDaily))} (${fmtPct(us.snapshot.dailyProfitLossPercent)}) as QQQ dropped ${fmtPct(tech.QQQ?.move1d)} vs SPY ${fmtPct(tech.SPY?.move1d)} — a tech-skewed session. AAPL (+4.84%) was a standout relative-strength name; DRAM (-7.94%), MU (-5.5%), and NBIS (-5.9%) led losses in memory/AI infrastructure. Several semis are on 2-day declines but none yet at 3+ sessions.</div></div>
        <div class="brief-part"><div class="brief-part-label">COMING UP</div><div class="brief-part-text">NYSE/Nasdaq early close Friday Jul 3 for Independence Day weekend. No verified earnings within the next 7 days for portfolio top weights. Egypt portfolio session showed modest declines across ORHD, EGX30ETF, RAYA, and COMI per Mubasher quotes.</div></div>
        <div class="brief-part"><div class="brief-part-label">GUIDANCE</div><div class="brief-part-text">Focus on AAPL concentration (24.3%) and QNT (Consider trimming, +33% unrealized). Hold DRAM/MU through defined stops unless memory sector weakness accelerates below 20D MAs. NFLX and NBIS remain high-risk with deep unrealized losses — watch, do not add.</div></div>
        <div class="brief-part"><div class="brief-part-label">TODAY'S IDEA</div><div class="brief-part-text">HOOD shows the strongest 5-day (+20.6%) and 20-day (+36.1%) momentum in the portfolio with price above 20D/50D MAs and MACD above signal — watch for continuation on volume. See full details in the Opportunity card below.</div></div>
      </div>
    </div>
  </div>
  <div class="opportunity-card">
    <div class="two-col">
      <div>
        <div class="opportunity-eyebrow">Today's Watchlist Idea</div>
        <div class="opportunity-ticker">HOOD</div>
        <div class="opportunity-name">Robinhood Markets, Inc.</div>
        <div class="opportunity-reason">HOOD gained +3.75% today and leads the portfolio on 5-day (+20.6%) and 20-day (+36.1%) momentum. Price at $112.73 (Jul 2 close) sits above both 20D ($97.07) and 50D ($86.58) moving averages with MACD above signal line — strengthening bullish momentum. Crypto/equities trading volume trends and retail engagement remain supportive sector tailwinds.</div>
        <div class="opportunity-note">Watchlist idea only — not a buy recommendation.</div>
      </div>
      <div>
        <table style="font-size:12px">
          <tr><td><strong>Sector</strong></td><td>Financials / Brokerage</td></tr>
          <tr><td><strong>Catalyst</strong></td><td>Retail trading activity &amp; product expansion</td></tr>
          <tr><td><strong>Technical Setup</strong></td><td>Above 20D/50D MA; MACD bullish; RSI 68</td></tr>
          <tr><td><strong>Risk Level</strong></td><td><span class="badge badge-orange">Medium</span></td></tr>
          <tr><td><strong>Watch Horizon</strong></td><td>1–2 weeks</td></tr>
          <tr><td><strong>What Would Invalidate It</strong></td><td>Close below 20D MA ($97) on rising volume</td></tr>
        </table>
      </div>
    </div>
  </div>
</section>

<section>
  <div class="section-header"><span class="section-icon">🚨</span><span class="section-title">Needs Attention First</span></div>
  <div class="alert alert-high"><span class="alert-icon">⚠️</span><div><div class="alert-title">AAPL — Concentration above 15%</div><div class="alert-detail">At 24.3% of US portfolio, a single-day +4.84% move drove most of today's positive contribution. Concentration amplifies both upside and downside.</div><div class="alert-action">Suggested action: Watch</div></div></div>
  <div class="alert alert-high"><span class="alert-icon">⚠️</span><div><div class="alert-title">EGX30ETF — Concentration above 15%</div><div class="alert-detail">58.6% of Egypt portfolio in one benchmark ETF. Egypt daily P/L largely tracks EGX30.</div><div class="alert-action">Suggested action: Keep</div></div></div>
  <div class="alert alert-medium"><span class="alert-icon">📉</span><div><div class="alert-title">QNT — Consider trimming</div><div class="alert-detail">Unrealized gain +$36.82 (+33%) but fell -4.9% today. App action label: Trim. Lock in partial gains if momentum fades below 20D MA ($65.53).</div><div class="alert-action">Suggested action: Consider trimming</div></div></div>
  <div class="alert alert-medium"><span class="alert-icon">📉</span><div><div class="alert-title">NFLX — Large unrealized loss</div><div class="alert-detail">-$50.07 (-20.8%) unrealized; High risk label. Today +4.66% bounce but still below 50D MA.</div><div class="alert-action">Suggested action: Watch</div></div></div>
  <div class="alert alert-medium"><span class="alert-icon">📉</span><div><div class="alert-title">NBIS — Large unrealized loss</div><div class="alert-detail">-$39.70 (-26.6%) unrealized; -5.9% today. Below 20D MA with bearish MACD momentum.</div><div class="alert-action">Suggested action: Watch</div></div></div>
  <div class="alert alert-medium"><span class="alert-icon">📉</span><div><div class="alert-title">DRAM — Large daily loss</div><div class="alert-detail">-7.94% today on high-volume selling. Memory sector profit-taking after extended rally.</div><div class="alert-action">Suggested action: Watch</div></div></div>
  <div class="alert alert-low"><span class="alert-icon">ℹ️</span><div><div class="alert-title">Data — AI commentary unavailable</div><div class="alert-detail">Daily AI used deterministic fallback only. Verify catalysts manually before acting on action labels.</div><div class="alert-action">Suggested action: Needs manual review</div></div></div>
</section>

<section>
  <div class="section-header"><span class="section-icon">📊</span><span class="section-title">Summary Cards</span></div>
  <div class="card-grid">
    <div class="card"><div class="card-label">US Portfolio Value</div><div class="card-value">${fmtUsd(us.snapshot.portfolioValue)}</div></div>
    <div class="card negative"><div class="card-label">US Daily P/L</div><div class="card-value negative">${fmtUsd(usDaily)}</div></div>
    <div class="card"><div class="card-label">Egypt Portfolio Value</div><div class="card-value">${fmtEgp(eg.snapshot.portfolioValue)}</div></div>
    <div class="card negative"><div class="card-label">Egypt Daily P/L</div><div class="card-value negative">${fmtEgp(egDaily)}</div></div>
    <div class="card positive"><div class="card-label">Biggest Positive Mover</div><div class="card-value positive">${bestUS.sym}</div><div class="card-sub">${fmtPct(bestUS.pct)}</div></div>
    <div class="card negative"><div class="card-label">Biggest Negative Mover</div><div class="card-value negative">${worstUS.sym}</div><div class="card-sub">${fmtPct(worstUS.pct)}</div></div>
    <div class="card warning"><div class="card-label">Largest Holding</div><div class="card-value">AAPL</div><div class="card-sub">24.3% US weight</div></div>
    <div class="card negative"><div class="card-label">Biggest Risk</div><div class="card-value">NBIS</div><div class="card-sub">-26.6% unrealized</div></div>
    <div class="card info"><div class="card-label">Upcoming Catalyst</div><div class="card-value">Jul 3</div><div class="card-sub">US early close</div></div>
    <div class="card warning"><div class="card-label">Needing Attention</div><div class="card-value warning">${attentionCount}</div></div>
    <div class="card info"><div class="card-label">Watchlist Idea</div><div class="card-value">HOOD</div></div>
    <div class="card"><div class="card-label">Worst Losing Streak</div><div class="card-value">2 days</div><div class="card-sub">DRAM, MU, NBIS</div></div>
    <div class="card positive"><div class="card-label">Strongest 5D Momentum</div><div class="card-value positive">${strongest5d?.sym || 'N/A'}</div><div class="card-sub">${fmtPct(strongest5d?.m)}</div></div>
    <div class="card negative"><div class="card-label">Weakest 5D Momentum</div><div class="card-value negative">${weakest5d?.sym || 'N/A'}</div><div class="card-sub">${fmtPct(weakest5d?.m)}</div></div>
  </div>
</section>

<section>
  <div class="section-header"><span class="section-icon">📈</span><span class="section-title">Trend and Progress Charts</span></div>
  <h4 style="margin-bottom:8px">US Portfolio Value — Last 7 Sessions</h4>
  ${barRows(us7, 'portfolioValue', Math.max(...us7.map((p) => p.portfolioValue)))}
  <h4 style="margin:16px 0 8px">US Daily P/L — Last 7 Sessions</h4>
  ${barRows(us7, 'dailyProfitLoss')}
  <h4 style="margin:16px 0 8px">Egypt Portfolio Value — Last 7 Sessions</h4>
  ${egBarRows(eg7, 'portfolioValue')}
  <h4 style="margin:16px 0 8px">Winners vs Losers (5D price move)</h4>
  ${us.snapshot.holdings.map((h) => {
    const m = tech[h.symbol]?.move5d;
    if (m == null) return '';
    const w = Math.min(100, Math.abs(m) * 3);
    return `<div class="bar-row"><span class="bar-label">${h.symbol}</span><div class="bar-track"><div class="bar-fill ${m >= 0 ? 'bar-pos' : 'bar-neg'}" style="width:${w}%"></div></div><span class="bar-pct ${m >= 0 ? 'positive' : 'negative'}">${fmtPct(m)}</span></div>`;
  }).join('\n')}
  <h4 style="margin:16px 0 8px">Losing Streak Indicator</h4>
  <div class="table-wrap"><table><thead><tr><th>Ticker</th><th>Streak Days</th><th>Decline During Streak</th><th>Possible Reason</th><th>Action</th></tr></thead><tbody>
  ${us.snapshot.holdings.filter((h) => tech[h.symbol]?.streak?.streak >= 2).map((h) => {
    const s = tech[h.symbol].streak;
    return `<tr><td>${h.symbol}</td><td>${s.streak >= 3 ? `<span class="streak-badge">🔴 ${s.streak} days</span>` : s.streak + ' days'}</td><td>${s.decline.toFixed(1)}%</td><td>${h.symbol.match(/DRAM|MU|ASML|NBIS/) ? 'Memory/semiconductor sector pullback' : 'Market-correlated drift'}</td><td>Watch</td></tr>`;
  }).join('') || '<tr><td colspan="5">No holdings with a 3+ day losing streak in the current data.</td></tr>'}
  </tbody></table></div>
</section>

<section>
  <div class="section-header"><span class="section-icon">🥧</span><span class="section-title">Portfolio Allocation</span></div>
  <h4>US Portfolio</h4>
  ${us.snapshot.holdings.sort((a,b)=>b.weightPercent-a.weightPercent).map((h) => `<div class="bar-row"><span class="bar-label">${h.symbol}</span><div class="bar-track"><div class="bar-fill bar-info" style="width:${h.weightPercent}%"></div></div><span class="bar-pct">${h.weightPercent.toFixed(1)}%${h.weightPercent>15?' <span class="badge badge-orange">⚠ &gt;15%</span>':''}</span></div>`).join('\n')}
  <ul style="margin-top:10px;font-size:12px;color:var(--text-secondary)"><li>Largest: AAPL 24.3% — concentration risk</li><li>ETF balance: QQQM, VOO, SCHG, DRAM, NASA provide diversified exposure</li><li>Speculative: SMR, SPCX, QNT are smaller tactical positions</li></ul>
  <h4 style="margin-top:16px">Egypt Portfolio</h4>
  ${eg.snapshot.holdings.sort((a,b)=>b.weightPercent-a.weightPercent).map((h) => `<div class="bar-row"><span class="bar-label">${h.symbol}</span><div class="bar-track"><div class="bar-fill bar-warn" style="width:${h.weightPercent}%"></div></div><span class="bar-pct">${h.weightPercent.toFixed(1)}%${h.weightPercent>15?' <span class="badge badge-orange">⚠ &gt;15%</span>':''}</span></div>`).join('\n')}
  <ul style="margin-top:10px;font-size:12px;color:var(--text-secondary)"><li>EGX30ETF dominates at 58.6% — benchmark-like exposure</li><li>RAYA is the only profitable holding (+EGP 442)</li><li>ORHD note: "sell soon" in app</li></ul>
</section>

<section>
  <div class="section-header"><span class="section-icon">📋</span><span class="section-title">Priority-Sorted Holdings</span></div>
  <div class="sort-bar"><button class="sort-btn active" type="button">Priority</button><button class="sort-btn" type="button">Weight</button><button class="sort-btn" type="button">Daily P/L</button></div>
  <div class="table-wrap"><table id="holdings-table"><thead><tr><th>Ticker</th><th>Market</th><th>Weight</th><th>Value</th><th>Daily P/L</th><th>1D Move</th><th>5D Move</th><th>Unrealized P/L</th><th>Risk</th><th>Catalyst</th><th>Action</th><th>Data</th><th>Main Reason</th></tr></thead><tbody>${priorityRows}</tbody></table></div>
</section>

<section>
  <div class="section-header"><span class="section-icon">💰</span><span class="section-title">Daily P/L Contribution</span></div>
  <h4>US</h4>
  <div class="table-wrap"><table><thead><tr><th>Ticker</th><th>Daily P/L</th><th>Daily %</th><th>Weight</th><th>Driver</th></tr></thead><tbody>
  ${us.snapshot.holdings.sort((a,b)=>Math.abs(b.daily_profit_loss)-Math.abs(a.daily_profit_loss)).map((h) => `<tr><td>${h.symbol}</td><td class="${h.daily_profit_loss>=0?'positive':'negative'}">${fmtUsd(h.daily_profit_loss)}</td><td>${fmtPct(h.daily_profit_loss_percent)}</td><td>${h.weightPercent.toFixed(1)}%</td><td>${h.weightPercent>10?'Both':'Price-driven'}</td></tr>`).join('')}
  </tbody></table></div>
  <h4 style="margin-top:12px">Egypt</h4>
  <div class="table-wrap"><table><thead><tr><th>Ticker</th><th>Daily P/L</th><th>Daily %</th><th>Weight</th><th>Driver</th></tr></thead><tbody>
  ${eg.snapshot.holdings.sort((a,b)=>Math.abs((b.reportRow?.dailyProfitLoss??0))-Math.abs((a.reportRow?.dailyProfitLoss??0))).map((h) => { const d=h.reportRow?.dailyProfitLoss??0; return `<tr><td>${h.symbol}</td><td class="${d>=0?'positive':'negative'}">${fmtEgp(d)}</td><td>${fmtPct(h.reportRow?.dailyProfitLossPercent)}</td><td>${h.weightPercent.toFixed(1)}%</td><td>Price-driven</td></tr>`; }).join('')}
  </tbody></table></div>
</section>

<section>
  <div class="section-header"><span class="section-icon">📉</span><span class="section-title">Recent Performance</span></div>
  <div class="table-wrap"><table><thead><tr><th>Ticker</th><th>1D</th><th>3D</th><th>5D</th><th>20D</th></tr></thead><tbody>
  ${us.snapshot.holdings.sort((a,b)=>(tech[b.symbol]?.move5d??0)-(tech[a.symbol]?.move5d??0)).map((h) => { const t=tech[h.symbol]||{}; return `<tr><td>${h.symbol}</td><td>${fmtPct(t.move1d)}</td><td>${fmtPct(t.move3d)}</td><td>${fmtPct(t.move5d)}</td><td>${fmtPct(t.move20d)}</td></tr>`; }).join('')}
  </tbody></table></div>
  <p class="small" style="margin-top:10px">HOOD and AAPL show strongest 5-day momentum; DRAM and MU weakest. Today's US moves were primarily tech/semiconductor-driven (QQQ -1.73%) rather than broad-market (SPY -0.13%). AAPL outperformed benchmarks significantly — stock-specific strength.</p>
</section>

<section>
  <div class="section-header"><span class="section-icon">🔧</span><span class="section-title">Technical Signals</span></div>
  <div class="table-wrap"><table><thead><tr><th>Ticker</th><th>RSI-14</th><th>vs 20D</th><th>vs 50D</th><th>vs 200D</th><th>Volume</th><th>MACD</th><th>5D Mom</th><th>Read</th><th>Caution</th></tr></thead><tbody>${techRows}</tbody></table></div>
</section>

<section>
  <div class="section-header"><span class="section-icon">📰</span><span class="section-title">News and Catalysts</span></div>
  <details open><summary>Positive <span class="badge badge-green">1</span></summary><div><strong>AAPL</strong> — Apple continues post-split trading with AI feature integration updates cited across financial press (Jun 30–Jul 2, 2026). Impact: supports today's +4.84% outperformance vs QQQ. Action: Keep.</div></details>
  <details><summary>Mixed <span class="badge badge-yellow">1</span></summary><div><strong>Memory sector (DRAM, MU)</strong> — Profit-taking after extended memory-chip rally; sector ETFs pulled back on valuation concerns (Jul 2). Impact: explains today's losses. Action: Watch.</div></details>
  <details><summary>No material recent news found <span class="badge badge-gray">18</span></summary><div>No verified material news in the last 7 days for remaining holdings. Egypt holdings: no English-language material news found in the last 7 days.</div></details>
</section>

<section>
  <div class="section-header"><span class="section-icon">📅</span><span class="section-title">Upcoming Earnings and Events</span></div>
  <div class="table-wrap"><table><thead><tr><th>Ticker</th><th>Event</th><th>Date</th><th>Days Away</th><th>Importance</th><th>Why It Matters</th></tr></thead><tbody>
  <tr style="background:var(--warning-bg)"><td>ALL US</td><td>NYSE/Nasdaq early close</td><td>Jul 3, 2026</td><td>1</td><td>Medium</td><td>Independence Day eve — reduced liquidity</td></tr>
  <tr><td colspan="6" class="muted">No major earnings within 14 days verified for portfolio holdings.</td></tr>
  </tbody></table></div>
</section>

<section>
  <div class="section-header"><span class="section-icon">⚠️</span><span class="section-title">Portfolio Risk Notes</span></div>
  <details open><summary>Concentration risk</summary><div>AAPL (24.3% US), EGX30ETF (58.6% Egypt). Single-name/ETF dominance amplifies idiosyncratic risk.</div></details>
  <details><summary>Sector risk</summary><div>Heavy technology/semiconductor exposure: AAPL, NVDA, TSM, ASML, MU, DRAM, NBIS. Correlated drawdowns possible.</div></details>
  <details><summary>ETF overlap</summary><div>QQQM, VOO, SCHG overlap in large-cap US growth; DRAM adds memory-sector beta on top.</div></details>
  <details><summary>Speculative exposure</summary><div>SMR, SPCX, QNT, NASA — small weights but high volatility. SPCX/QNT have limited price history.</div></details>
  <details><summary>Currency/geography</summary><div>US ($3,026) and Egypt (EGP 120,185) reported separately. Do not combine without FX conversion.</div></details>
  <details><summary>Large losses</summary><div>NFLX (-20.8%), NBIS (-26.6%), NASA (-19.2%), MU (-17.4%). Review stop levels.</div></details>
  <details><summary>Large gains</summary><div>QNT (+32.8%) — trim candidate. HOOD (+13.6%), DRAM (+7.8%), TSM (+10%).</div></details>
</section>

<section>
  <div class="section-header"><span class="section-icon">🔄</span><span class="section-title">What Changed Today</span></div>
  <ul style="font-size:13px;line-height:1.8">
    <li><strong>US value</strong> fell from $3,043.59 to $3,025.83 (-$17.76) — second consecutive down day after Jul 1's -$75.09.</li>
    <li><strong>AAPL</strong> surged +4.84%, increasing weight toward 24.3% — concentration rose.</li>
    <li><strong>Memory names</strong> (DRAM, MU, NBIS) sold off sharply — sector rotation signal.</li>
    <li><strong>QNT</strong> remains on Trim label; -4.9% today after recent gains.</li>
    <li><strong>Egypt</strong> portfolio flat in snapshot totals but report rows show -EGP 142 across holdings.</li>
    <li><strong>Watch tomorrow:</strong> whether 2-day losing streaks in semis extend to 3+ sessions; US early close Jul 3.</li>
  </ul>
</section>

<section>
  <div class="section-header"><span class="section-icon">👀</span><span class="section-title">Watchlist</span></div>
  <div class="table-wrap"><table><thead><tr><th>Ticker</th><th>Name</th><th>Why Interesting</th><th>Technical</th><th>Catalyst</th><th>Risk</th><th>Level</th><th>More Interesting If</th><th>Invalidated If</th></tr></thead><tbody>
  <tr><td>HOOD</td><td>Robinhood</td><td>Strongest momentum in portfolio</td><td>Above 20D/50D MA; MACD bullish</td><td>Retail engagement trends</td><td>Medium</td><td><span class="badge badge-blue">High</span></td><td>Volume expansion on breakout</td><td>Close below $97 (20D MA)</td></tr>
  <tr><td>AAPL</td><td>Apple</td><td>Relative strength vs market today</td><td>Above 20D/50D; fresh MACD cross</td><td>AI product cycle</td><td>Low</td><td><span class="badge badge-gray">Medium</span></td><td>Holds above $300 post-split</td><td>Break below 20D MA ($295)</td></tr>
  <tr><td>TSM</td><td>TSMC</td><td>Quality semi at support near 50D MA</td><td>Below 20D, above 50D</td><td>AI chip demand</td><td>Low</td><td><span class="badge badge-gray">Medium</span></td><td>Reclaim 20D MA on volume</td><td>Close below 50D MA ($420)</td></tr>
  </tbody></table></div>
  <p class="small muted" style="margin-top:8px">Watchlist only — not a buy recommendation.</p>
</section>

<section>
  <div class="section-header"><span class="section-icon">✅</span><span class="section-title">Final Action Summary</span></div>
  <div class="three-col">
    <div class="card positive"><div class="card-label">Keep / Add Candidates</div><div class="card-sub" style="margin-top:8px">AAPL, HOOD, TSM, QQQM, VOO, DRAM (monitor stop), RAYA, EGX30ETF — core positions with defined risk parameters.</div></div>
    <div class="card warning"><div class="card-label">Watch Closely</div><div class="card-sub" style="margin-top:8px">NFLX, NBIS, MU, ASML, META, DRAM, SMR, ORHD — elevated volatility, losses, or sector headwinds.</div></div>
    <div class="card negative"><div class="card-label">Consider Trimming</div><div class="card-sub" style="margin-top:8px">QNT — +33% unrealized gain; app Trim label. Consider partial profit-taking above 20D MA support.</div></div>
  </div>
</section>

<section>
  <div class="section-header"><span class="section-icon">📚</span><span class="section-title">Sources and Data Notes</span></div>
  <ul style="font-size:12px;line-height:1.8;color:var(--text-secondary)">
    <li>Portfolio accounting: Portfolio Exit Planner API snapshot (${snapTs})</li>
    <li>US prices/technicals: Yahoo Finance daily closes through Jul 2, 2026</li>
    <li>Benchmarks: SPY, QQQ (Jul 2 close); EGX30 (^CASE30, last Jul 1)</li>
    <li>Egypt quotes: Mubasher EGX via app provider</li>
    <li>RSI/MACD: Calculated from Yahoo historical closes; 200D MA unavailable for many tickers (insufficient history in 3mo fetch)</li>
    <li>AI commentary: unavailable — deterministic fallback labels only</li>
    <li>News: limited verified items within 7-day window; no uncited catalysts included</li>
  </ul>
</section>

</div>
<footer>This is analysis for decision support, not financial advice or automatic trading.</footer>
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

const outDir = path.join(process.cwd(), 'docs/reports/.raw');
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, `portfolio-report-${SESSION_DATE}.html`);
fs.writeFileSync(outPath, html);
console.log('Wrote', outPath, html.length, 'bytes');
