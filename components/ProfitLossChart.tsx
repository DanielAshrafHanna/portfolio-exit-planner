"use client";

import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { CurrencyCode, EnrichedHolding, FeeSettings } from "@/lib/types";
import { calculateProfitLoss, calculateStopLosses } from "@/lib/calculations";
import { formatMoney } from "@/lib/profileUtils";

type Props = {
  holding: EnrichedHolding;
  targetPrice: number;
  settings: FeeSettings;
  currency: CurrencyCode;
};

export function ProfitLossChart({ holding, targetPrice, settings, currency }: Props) {
  if (!holding.quote) return null;
  const current = holding.quote.currentPrice;
  const low = Math.max(0.01, current * 0.55);
  const high = current * 1.55;
  const step = (high - low) / 18;
  const data = Array.from({ length: 19 }, (_, index) => {
    const price = low + step * index;
    return {
      price: Number(price.toFixed(2)),
      pl: calculateProfitLoss(holding.shares, holding.averageCost, price, settings).profitLoss
    };
  });
  const stopPrice = calculateStopLosses(holding, holding.quote)[holding.selectedStopStyle].price;

  return (
    <div className="h-64 min-w-0 overflow-hidden w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 12, bottom: 10, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#d8ded5" />
          <XAxis dataKey="price" tickFormatter={(value) => formatMoney(Number(value), currency)} />
          <YAxis tickFormatter={(value) => formatMoney(Number(value), currency)} />
          <Tooltip formatter={(value) => formatMoney(Number(value), currency)} labelFormatter={(value) => `Sell price ${formatMoney(Number(value), currency)}`} />
          <ReferenceLine x={current} stroke="#145c72" label="Current" />
          <ReferenceLine x={holding.averageCost} stroke="#17212b" label="Cost" />
          <ReferenceLine x={stopPrice} stroke="#ff7a68" label="Stop" />
          <ReferenceLine x={targetPrice} stroke="#38a169" label="Target" />
          <Line type="monotone" dataKey="pl" stroke="#145c72" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
