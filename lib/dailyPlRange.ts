import { calculateDailyProfitLoss, roundMoney } from "./calculations";

export type DailyPlRange = {
  low: number;
  high: number;
  current: number;
  lowPercent: number;
  highPercent: number;
  currentPercent: number;
  position: number;
};

type RangeInput = {
  shares: number;
  previousClose: number;
  dayLow?: number;
  dayHigh?: number;
  currentPrice: number;
};

export function computeDailyPlRange(input: RangeInput): DailyPlRange | undefined {
  const { shares, previousClose, dayLow, dayHigh, currentPrice } = input;
  if (shares <= 0 || previousClose <= 0 || !dayLow || !dayHigh || dayLow <= 0 || dayHigh <= 0) {
    return undefined;
  }

  const atLow = calculateDailyProfitLoss(shares, dayLow, previousClose);
  const atHigh = calculateDailyProfitLoss(shares, dayHigh, previousClose);
  const atCurrent = calculateDailyProfitLoss(shares, currentPrice, previousClose);
  if (atLow.priorValue <= 0) return undefined;

  const low = Math.min(atLow.profitLoss, atHigh.profitLoss);
  const high = Math.max(atLow.profitLoss, atHigh.profitLoss);
  const current = atCurrent.profitLoss;
  const span = high - low;

  return {
    low,
    high,
    current,
    lowPercent: roundMoney((low / atLow.priorValue) * 100),
    highPercent: roundMoney((high / atLow.priorValue) * 100),
    currentPercent: atCurrent.profitLossPercent,
    position: span > 0 ? Math.min(1, Math.max(0, (current - low) / span)) : 0.5
  };
}

export function aggregateDailyPlRangeFromHoldings(
  holdings: RangeInput[]
): DailyPlRange | undefined {
  let low = 0;
  let high = 0;
  let current = 0;
  let priorValue = 0;

  holdings.forEach((holding) => {
    const range = computeDailyPlRange(holding);
    if (!range) return;
    low += range.low;
    high += range.high;
    current += range.current;
    const atCurrent = calculateDailyProfitLoss(holding.shares, holding.currentPrice, holding.previousClose);
    priorValue += atCurrent.priorValue;
  });

  if (priorValue <= 0) return undefined;

  const roundedLow = roundMoney(low);
  const roundedHigh = roundMoney(high);
  const roundedCurrent = roundMoney(current);
  const span = roundedHigh - roundedLow;

  return {
    low: roundedLow,
    high: roundedHigh,
    current: roundedCurrent,
    lowPercent: roundMoney((roundedLow / priorValue) * 100),
    highPercent: roundMoney((roundedHigh / priorValue) * 100),
    currentPercent: roundMoney((roundedCurrent / priorValue) * 100),
    position: span > 0 ? Math.min(1, Math.max(0, (roundedCurrent - roundedLow) / span)) : 0.5
  };
}
