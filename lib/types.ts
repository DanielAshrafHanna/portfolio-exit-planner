export type Action = "Keep" | "Watch" | "Trim" | "Sell";
export type Confidence = "Low" | "Medium" | "High";
export type RiskLevel = "Low" | "Medium" | "High" | "Very High";
export type MarketRegion = "US" | "EG";
export type CurrencyCode = "USD" | "EGP";

export type HoldingInput = {
  id: string;
  symbol: string;
  name: string;
  shares: number;
  averageCost: number;
  totalCost: number;
  brokerCurrentValue?: number;
  notes?: string;
};

export type MarketQuote = {
  symbol: string;
  currentPrice: number;
  dailyChangePercent: number;
  previousClose: number;
  companyName?: string;
  week52High?: number;
  week52Low?: number;
  volume?: number;
  ma20?: number;
  ma50?: number;
  ma200?: number;
  atr?: number;
  rsi?: number;
  provider: string;
  stale?: boolean;
  error?: string;
};

export type NewsItem = {
  headline: string;
  source: string;
  date: string;
  url: string;
  summary: string;
};

export type Catalyst = {
  name: string;
  date: string | null;
  importance: "Low" | "Medium" | "High";
  sourceUrl: string;
};

export type AiAnalysis = {
  symbol: string;
  assetType: "Stock" | "ETF" | "Unknown";
  action: Action;
  confidence: Confidence;
  riskLevel: RiskLevel;
  newsSentiment: "Positive" | "Neutral" | "Negative" | "Mixed" | "Unknown";
  trendStatus: "Bullish" | "Neutral" | "Bearish" | "Unknown";
  upcomingCatalysts: Catalyst[];
  summary: string;
  reasonsToHold: string[];
  reasonsToSell: string[];
  riskFlags: string[];
  suggestedActionPlan: {
    primaryAction: Action;
    explanation: string;
    suggestedStopLoss: number;
    suggestedTakeProfit: number;
    reviewAfterCatalyst: boolean;
  };
  sourcesUsed: Array<{
    title: string;
    publisher: string;
    date: string;
    url: string;
  }>;
};

export type FeeSettings = {
  fixedTradingFee: number;
  percentTradingFee: number;
  fxFeePercent: number;
};

export type EnrichedHolding = HoldingInput & {
  quote?: MarketQuote;
  news: NewsItem[];
  analysis?: AiAnalysis;
  selectedStopStyle: "tight" | "balanced" | "loose";
  selectedTargetPrice?: number;
  targetPriceEdited?: boolean;
  sellPercent: number;
};

export type PortfolioProfile = {
  id: string;
  name: string;
  region: MarketRegion;
  currency: CurrencyCode;
  holdings: EnrichedHolding[];
  settings: FeeSettings;
};

export type SharedPortfolioProfile = {
  id: string;
  userId: string;
  displayName: string;
  profile: PortfolioProfile;
  updatedAt?: string;
};
