"use client";

import { Plus } from "lucide-react";
import { useCallback, useEffect, useImperativeHandle, useRef, useState, forwardRef } from "react";
import type { HoldingInput, MarketRegion } from "@/lib/types";
import { totalCostFor } from "@/lib/calculations";
import { getUnsupportedTickerMessage } from "@/lib/unsupportedTickers";

export type QuickAddHoldingHandle = {
  expand: () => void;
  focusSymbol: () => void;
};

type Props = {
  onAdd: (holding: HoldingInput) => void;
  region?: MarketRegion;
  disabled?: boolean;
  focusToken?: number;
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
};

export const QuickAddHolding = forwardRef<QuickAddHoldingHandle, Props>(function QuickAddHolding(
  { onAdd, region = "US", disabled = false, focusToken = 0, expanded: expandedProp, onExpandedChange },
  ref
) {
  const symbolRef = useRef<HTMLInputElement>(null);
  const [internalExpanded, setInternalExpanded] = useState(false);
  const [symbol, setSymbol] = useState("");
  const [shares, setShares] = useState("");
  const [averageCost, setAverageCost] = useState("");
  const [error, setError] = useState("");
  const expanded = expandedProp ?? internalExpanded;

  const setExpanded = useCallback((value: boolean) => {
    if (expandedProp === undefined) setInternalExpanded(value);
    onExpandedChange?.(value);
  }, [expandedProp, onExpandedChange]);

  useImperativeHandle(ref, () => ({
    expand: () => setExpanded(true),
    focusSymbol: () => symbolRef.current?.focus()
  }));

  useEffect(() => {
    if (focusToken > 0) {
      setExpanded(true);
      symbolRef.current?.focus();
    }
  }, [focusToken, setExpanded]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (disabled) return;
      if (event.key.toLowerCase() !== "n" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.tagName === "SELECT") return;
      event.preventDefault();
      setExpanded(true);
      symbolRef.current?.focus();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [disabled, setExpanded]);

  const submit = () => {
    const cleanSymbol = symbol.trim().toUpperCase();
    if (!cleanSymbol) {
      setError("");
      symbolRef.current?.focus();
      return;
    }
    const blockedMessage = getUnsupportedTickerMessage(cleanSymbol, region);
    if (blockedMessage) {
      setError(blockedMessage);
      return;
    }
    setError("");
    const shareCount = Number(shares) || 0;
    const avg = Number(averageCost) || 0;
    onAdd({
      id: crypto.randomUUID(),
      symbol: cleanSymbol,
      name: "",
      shares: shareCount,
      averageCost: avg,
      totalCost: totalCostFor(shareCount, avg),
      notes: ""
    });
    setSymbol("");
    setShares("");
    setAverageCost("");
    symbolRef.current?.focus();
  };

  return (
    <div>
      {!expanded ? (
        <button
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-marine/30 bg-mint/30 px-4 py-2 text-sm font-semibold text-marine md:hidden"
          type="button"
          disabled={disabled}
          onClick={() => setExpanded(true)}
        >
          <Plus className="h-4 w-4" aria-hidden />
          Add holding
        </button>
      ) : null}
      <form
        className={`gap-3 rounded-md border border-marine/20 bg-mint/25 p-4 md:grid md:grid-cols-[minmax(120px,1fr)_minmax(100px,0.6fr)_minmax(120px,0.7fr)_auto] ${expanded ? "grid" : "hidden md:grid"}`}
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <label className="text-xs font-medium text-ink/70">
          Symbol
          <input
            ref={symbolRef}
            className="mt-1 min-h-11 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-base font-semibold uppercase sm:text-sm"
            placeholder="e.g. AAPL"
            value={symbol}
            disabled={disabled}
            onChange={(event) => {
              setSymbol(event.target.value.toUpperCase());
              setError("");
            }}
          />
        </label>
        {error ? <p className="text-xs text-rose-700 md:col-span-4">{error}</p> : null}
        <label className="text-xs font-medium text-ink/70">
          Shares
          <input
            className="mt-1 min-h-11 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-base sm:text-sm"
            type="number"
            min="0"
            step="any"
            placeholder="100"
            value={shares}
            disabled={disabled}
            onChange={(event) => setShares(event.target.value)}
          />
        </label>
        <label className="text-xs font-medium text-ink/70">
          Avg cost
          <input
            className="mt-1 min-h-11 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-base sm:text-sm"
            type="number"
            min="0"
            step="any"
            placeholder="10.00"
            value={averageCost}
            disabled={disabled}
            onChange={(event) => setAverageCost(event.target.value)}
          />
        </label>
        <div className="flex items-end gap-2">
          <button
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-marine px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 md:w-auto"
            type="submit"
            disabled={disabled}
          >
            <Plus className="h-4 w-4" aria-hidden />
            Add holding
          </button>
          <button
            className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-md border border-ink/15 px-3 py-2 text-sm font-semibold text-ink/70 md:hidden"
            type="button"
            onClick={() => setExpanded(false)}
          >
            Cancel
          </button>
        </div>
        <p className="hidden text-xs text-ink/55 md:col-span-4 md:block">Tip: press <kbd className="rounded border border-ink/15 bg-white px-1.5 py-0.5 font-mono text-[11px]">N</kbd> to focus symbol.</p>
      </form>
    </div>
  );
});
