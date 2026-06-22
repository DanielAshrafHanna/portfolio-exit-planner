#!/usr/bin/env node
/** Fetch Yahoo chart data and compute technicals for report generation */
import { writeFileSync } from "node:fs";

const UA = "Mozilla/5.0 (compatible; PortfolioReport/1.0)";

const SYMBOLS = {
  benchmarks: [
    { symbol: "SPY", label: "S&P 500 ETF" },
    { symbol: "QQQ", label: "Nasdaq 100 ETF" },
  ],
  us: ["AAPL", "NFLX", "QQQM", "DRAM", "TSM", "NASA", "IBM", "SPCX", "VOO", "SCHG", "META", "NVDA", "HOOD"],
  eg: [
    { symbol: "ORHD.CA", app: "ORHD" },
    { symbol: "EGX30ETF.CA", app: "EGX30ETF" },
    { symbol: "RAYA.CA", app: "RAYA" },
    { symbol: "COMI.CA", app: "COMI" },
    { symbol: "EGX30.CA", app: "EGX30", label: "EGX30 Index" },
  ],
};

async function fetchChart(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=6mo`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`${symbol}: HTTP ${res.status}`);
  const j = await res.json();
  const r = j.chart?.result?.[0];
  if (!r) throw new Error(`${symbol}: no result`);
  const q = r.indicators.quote[0];
  const meta = r.meta;
  const rows = [];
  for (let i = 0; i < r.timestamp.length; i++) {
    if (q.close[i] == null) continue;
    rows.push({
      date: new Date(r.timestamp[i] * 1000).toISOString().slice(0, 10),
      ts: r.timestamp[i],
      close: q.close[i],
      volume: q.volume[i] ?? 0,
      high: q.high[i],
      low: q.low[i],
      open: q.open[i],
    });
  }
  return { symbol, meta, rows };
}

function sma(values, period) {
  if (values.length < period) return null;
  const slice = values.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

function calcRSI(closes, period = 14) {
  if (closes.length < period + 1) return null;
  const changes = [];
  for (let i = 1; i < closes.length; i++) changes.push(closes[i] - closes[i - 1]);
  const recent = changes.slice(-period);
  let gains = 0, losses = 0;
  for (const c of recent) {
    if (c > 0) gains += c;
    else losses -= c;
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return Math.round((100 - 100 / (1 + rs)) * 10) / 10;
}

function calcMACD(closes) {
  if (closes.length < 26) return null;
  const ema = (data, p) => {
    const k = 2 / (p + 1);
    let v = data.slice(0, p).reduce((a, b) => a + b, 0) / p;
    for (let i = p; i < data.length; i++) v = data[i] * k + v * (1 - k);
    return v;
  };
  const ema12 = ema(closes, 12);
  const ema26 = ema(closes, 26);
  const macdLine = ema12 - ema26;
  // signal approx from last 9 MACD values - simplified
  const macdHist = [];
  for (let i = 26; i < closes.length; i++) {
    const s = closes.slice(0, i + 1);
    macdHist.push(ema(s, 12) - ema(s, 26));
  }
  const signal = ema(macdHist, 9);
  const hist = macdLine - signal;
  return { macdLine, signal, hist };
}

function pctChange(from, to) {
  if (!from || !to) return null;
  return Math.round(((to - from) / from) * 10000) / 100;
}

function analyze(chart) {
  const { rows, meta, symbol } = chart;
  const closes = rows.map((r) => r.close);
  const volumes = rows.map((r) => r.volume);
  const n = closes.length;
  const last = closes[n - 1];
  const lastDate = rows[n - 1].date;
  const lastTs = new Date(rows[n - 1].ts * 1000).toISOString();

  const move = (daysBack) => {
    const idx = n - 1 - daysBack;
    if (idx < 0) return null;
    return pctChange(closes[idx], last);
  };

  const avgVol20 = sma(volumes, 20);
  const todayVol = volumes[n - 1];
  const volRatio = avgVol20 ? todayVol / avgVol20 : null;

  const ma20 = sma(closes, 20);
  const ma50 = sma(closes, 50);
  const ma200 = sma(closes, 200);

  const rsi = calcRSI(closes);
  const macd = calcMACD(closes);

  // losing streak
  let streak = 0;
  for (let i = n - 1; i > 0; i--) {
    if (closes[i] < closes[i - 1]) streak++;
    else break;
  }

  let volLabel = "Average volume — normal session";
  const isGreen = rows[n - 1].close >= (rows[n - 2]?.close ?? rows[n - 1].open);
  if (volRatio != null) {
    if (volRatio >= 1.5 && isGreen) volLabel = "High-volume buying — confirms move";
    else if (volRatio >= 1.5 && !isGreen) volLabel = "High-volume selling — confirms weakness";
    else if (volRatio < 0.7) volLabel = "Low-volume move — low conviction, less reliable";
  }

  let macdDesc = "Not available";
  if (macd) {
    const above = macd.macdLine > macd.signal;
    const histGrowing = macd.hist > 0;
    if (above && histGrowing) macdDesc = "Above signal line — short-term momentum positive; histogram strengthening bullish momentum";
    else if (above && !histGrowing) macdDesc = "Above signal line — short-term momentum positive; momentum fading — watch";
    else if (!above && macd.hist < 0) macdDesc = "Below signal line — short-term momentum negative; strengthening bearish momentum";
    else macdDesc = "Below signal line — short-term momentum negative";
  }

  const vs = (ma) => {
    if (!ma) return "Not available";
    const diff = pctChange(ma, last);
    return last > ma ? `Above (+${Math.abs(diff).toFixed(1)}%)` : `Below (-${Math.abs(diff).toFixed(1)}%)`;
  };

  return {
    symbol,
    price: last,
    asOf: lastTs,
    asOfDate: lastDate,
    prevClose: meta.previousClose ?? closes[n - 2],
    move1d: move(1),
    move3d: move(3),
    move5d: move(5),
    move20d: move(20),
    rsi14: rsi,
    rsiSource: `Calculated from Yahoo daily closes through ${lastDate}`,
    macd: macdDesc,
    ma20, ma50, ma200,
    vs20: vs(ma20),
    vs50: vs(ma50),
    vs200: vs(ma200),
    volRatio: volRatio ? Math.round(volRatio * 100) : null,
    volLabel,
    losingStreak: streak,
    currency: meta.currency || "USD",
    exchange: meta.exchangeName || "",
  };
}

const results = { benchmarks: {}, us: {}, eg: {}, fetchedAt: new Date().toISOString() };

for (const b of SYMBOLS.benchmarks) {
  try {
    const chart = await fetchChart(b.symbol);
    results.benchmarks[b.symbol] = { ...analyze(chart), label: b.label };
  } catch (e) {
    results.benchmarks[b.symbol] = { error: String(e) };
  }
  await new Promise((r) => setTimeout(r, 200));
}

for (const sym of SYMBOLS.us) {
  try {
    const chart = await fetchChart(sym);
    results.us[sym] = analyze(chart);
  } catch (e) {
    results.us[sym] = { error: String(e) };
  }
  await new Promise((r) => setTimeout(r, 200));
}

for (const item of SYMBOLS.eg) {
  try {
    const chart = await fetchChart(item.symbol);
    results.eg[item.app] = { ...analyze(chart), yahooSymbol: item.symbol };
  } catch (e) {
    results.eg[item.app] = { error: String(e) };
  }
  await new Promise((r) => setTimeout(r, 200));
}

writeFileSync("/tmp/market-tech.json", JSON.stringify(results, null, 2));
console.log("Wrote /tmp/market-tech.json");
console.log("SPY 1D:", results.benchmarks.SPY?.move1d);
console.log("QQQ 1D:", results.benchmarks.QQQ?.move1d);
console.log("EGX30 1D:", results.eg.EGX30?.move1d);
