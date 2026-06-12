"use client";

import { Calculator } from "lucide-react";
import { useState } from "react";
import type { CurrencyCode, EnrichedHolding, FeeSettings } from "@/lib/types";
import { calculateProfitLoss, calculateSellPriceForProfitLoss, defaultSellTargets } from "@/lib/calculations";
import { profitLossTone } from "@/lib/holdingDisplay";
import { formatMoney } from "@/lib/profileUtils";

type Props = {
  holding: EnrichedHolding;
  settings: FeeSettings;
  currency: CurrencyCode;
  onChange: (holding: EnrichedHolding) => void;
};

export function applyDesiredProfitLossTarget(
  holding: EnrichedHolding,
  desiredProfitLoss: number,
  settings: FeeSettings
): EnrichedHolding {
  const requiredSellPrice = calculateSellPriceForProfitLoss(
    holding.shares,
    holding.averageCost,
    desiredProfitLoss,
    settings
  );
  return { ...holding, selectedTargetPrice: requiredSellPrice, targetPriceEdited: true };
}

function plValueClass(value: number) {
  const tone = profitLossTone(value);
  return tone === "loss" ? "text-coral" : tone === "gain" ? "text-marine" : "text-ink";
}

export function TargetPlanner({ holding, settings, currency, onChange }: Props) {
  const [desiredProfitLoss, setDesiredProfitLoss] = useState("");

  if (!holding.quote) {
    return (
      <div className="border-b border-ink/10 bg-paper px-3 py-3 text-sm text-ink/65 sm:px-4">
        Loading quote before you can plan a target.
      </div>
    );
  }

  const targetPrice = holding.selectedTargetPrice
    || defaultSellTargets(holding.quote.currentPrice, holding.analysis?.suggestedActionPlan.suggestedTakeProfit)[1].price;
  const breakevenPrice = calculateSellPriceForProfitLoss(holding.shares, holding.averageCost, 0, settings);
  const targetPl = calculateProfitLoss(holding.shares, holding.averageCost, targetPrice, settings);
  const desiredValue = desiredProfitLoss === "" ? undefined : Number(desiredProfitLoss);
  const requiredSellPrice = desiredValue === undefined || Number.isNaN(desiredValue)
    ? undefined
    : calculateSellPriceForProfitLoss(holding.shares, holding.averageCost, desiredValue, settings);
  const requiredPl = requiredSellPrice
    ? calculateProfitLoss(holding.shares, holding.averageCost, requiredSellPrice, settings)
    : undefined;

  const applyTarget = () => {
    if (desiredValue === undefined || Number.isNaN(desiredValue)) return;
    onChange(applyDesiredProfitLossTarget(holding, desiredValue, settings));
  };

  return (
    <section className="border-b border-ink/10 bg-mint/20 px-3 py-3 sm:px-4 sm:py-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-marine">
        <Calculator className="h-4 w-4 shrink-0" aria-hidden />
        <span>Target planner</span>
        <span className="font-normal text-ink/55">· {holding.symbol}</span>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 min-[420px]:grid-cols-3 sm:gap-2">
        <div className="rounded-md border border-mint/50 bg-white px-3 py-2.5 min-[420px]:px-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink/55">Current target</p>
          <p className="mt-1 text-base font-bold text-marine min-[420px]:text-lg">{formatMoney(targetPrice, currency)}</p>
        </div>
        <div className="rounded-md border border-mint/50 bg-white px-3 py-2.5 min-[420px]:px-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink/55">Breakeven</p>
          <p className="mt-1 text-base font-bold text-ink min-[420px]:text-lg">{formatMoney(breakevenPrice, currency)}</p>
          <p className="mt-0.5 text-[11px] leading-snug text-ink/55">Sell price for {formatMoney(0, currency)} P/L after fees</p>
        </div>
        <div className="rounded-md border border-mint/50 bg-white px-3 py-2.5 min-[420px]:px-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink/55">P/L at target</p>
          <p className={`mt-1 text-base font-bold min-[420px]:text-lg ${plValueClass(targetPl.profitLoss)}`}>
            {formatMoney(targetPl.profitLoss, currency)}
          </p>
          <p className={`text-sm font-semibold ${plValueClass(targetPl.profitLoss)}`}>
            {targetPl.profitLossPercent}%
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="min-w-0 flex-1 sm:max-w-xs">
          <label className="text-xs font-semibold uppercase tracking-wide text-ink/55" htmlFor={`desired-pl-${holding.id}`}>
            Desired P/L
          </label>
          <input
            id={`desired-pl-${holding.id}`}
            className="mt-1.5 min-h-11 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-base"
            type="number"
            step="0.01"
            placeholder="Example: 500 or -100"
            value={desiredProfitLoss}
            onChange={(event) => setDesiredProfitLoss(event.target.value)}
          />
        </div>
        <button
          className="min-h-11 w-full shrink-0 rounded-md bg-marine px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 sm:w-auto sm:min-w-[9rem]"
          type="button"
          disabled={!requiredSellPrice}
          onClick={applyTarget}
        >
          Apply to target
        </button>
      </div>

      <p className="mt-3 text-sm text-ink/70">
        {requiredSellPrice ? (
          <>
            Sell at about <strong className="text-marine">{formatMoney(requiredSellPrice, currency)}</strong>
            {" "}to target <strong>{formatMoney(requiredPl?.profitLoss || 0, currency)}</strong> P/L after fees.
          </>
        ) : (
          "Enter the P/L you want and the app will calculate the required sell price."
        )}
      </p>
    </section>
  );
}
