import { calculateStopLosses, defaultSellTargets } from "./calculations";
import type { AiAnalysis, HoldingInput, MarketQuote, NewsItem } from "./types";

export function fallbackAnalysis(holding: HoldingInput, quote: MarketQuote, news: NewsItem[]): AiAnalysis {
  const belowMa50 = quote.ma50 ? quote.currentPrice < quote.ma50 : false;
  const aboveMa20 = quote.ma20 ? quote.currentPrice > quote.ma20 : false;
  const lossPercent = holding.totalCost > 0 ? ((quote.currentPrice * holding.shares - holding.totalCost) / holding.totalCost) * 100 : 0;
  const riskLevel = lossPercent < -20 || quote.rsi && quote.rsi > 75 ? "High" : belowMa50 ? "Medium" : "Low";
  const action = lossPercent < -18 && belowMa50 ? "Sell" : lossPercent > 25 && !aboveMa20 ? "Trim" : belowMa50 ? "Watch" : "Keep";
  const trendStatus = aboveMa20 && !belowMa50 ? "Bullish" : belowMa50 ? "Bearish" : "Neutral";
  const stops = calculateStopLosses(holding, quote);
  const targets = defaultSellTargets(quote.currentPrice);
  const noNews = news.length === 0;

  return {
    symbol: holding.symbol,
    assetType: holding.name.toLowerCase().includes("etf") ? "ETF" : "Unknown",
    action,
    confidence: "Low",
    riskLevel,
    newsSentiment: noNews ? "Unknown" : "Mixed",
    trendStatus,
    upcomingCatalysts: [],
    summary: noNews
      ? "No recent news found. This fallback analysis uses only market data and portfolio cost basis."
      : "Mock analysis based on supplied quote, trend, cost basis, and available headlines.",
    reasonsToHold: [
      aboveMa20 ? "Price is above the 20-day moving average." : "Position can be monitored with a defined stop instead of reacting emotionally.",
      lossPercent > 0 ? "The position is currently profitable." : "Position sizing can be reviewed before deciding."
    ],
    reasonsToSell: [
      belowMa50 ? "Price is below the 50-day moving average, which can signal weakening momentum." : "A trailing stop may be useful if gains reverse.",
      lossPercent < 0 ? "The position is currently below cost basis." : "Uncertain news or missing catalyst data can justify trimming risk."
    ],
    riskFlags: [
      noNews ? "No verified upcoming catalyst found." : "Review news manually before acting.",
      quote.error ? quote.error : "AI provider unavailable; fallback analysis has low confidence."
    ],
    suggestedActionPlan: {
      primaryAction: action,
      explanation: "Fallback plan only. Use the balanced stop as the default comparison point and review before making changes.",
      suggestedStopLoss: stops.balanced.price,
      suggestedTakeProfit: targets[1].price,
      reviewAfterCatalyst: false
    },
    sourcesUsed: news.map((item) => ({
      title: item.headline,
      publisher: item.source,
      date: item.date,
      url: item.url
    }))
  };
}
