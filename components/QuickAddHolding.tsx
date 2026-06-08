"use client";

import { Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { HoldingInput } from "@/lib/types";
import { totalCostFor } from "@/lib/calculations";

type Props = {
  onAdd: (holding: HoldingInput) => void;
  disabled?: boolean;
  focusToken?: number;
};

export function QuickAddHolding({ onAdd, disabled = false, focusToken = 0 }: Props) {
  const symbolRef = useRef<HTMLInputElement>(null);
  const [symbol, setSymbol] = useState("");
  const [shares, setShares] = useState("");
  const [averageCost, setAverageCost] = useState("");

  useEffect(() => {
    if (focusToken > 0) symbolRef.current?.focus();
  }, [focusToken]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (disabled) return;
      if (event.key.toLowerCase() !== "n" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.tagName === "SELECT") return;
      event.preventDefault();
      symbolRef.current?.focus();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [disabled]);

  const submit = () => {
    const cleanSymbol = symbol.trim().toUpperCase();
    if (!cleanSymbol) {
      symbolRef.current?.focus();
      return;
    }
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
    <form
      className="grid gap-3 rounded-md border border-marine/20 bg-mint/25 p-4 md:grid-cols-[minmax(120px,1fr)_minmax(100px,0.6fr)_minmax(120px,0.7fr)_auto]"
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
          onChange={(event) => setSymbol(event.target.value.toUpperCase())}
        />
      </label>
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
      <div className="flex items-end">
        <button
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-marine px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 md:w-auto"
          type="submit"
          disabled={disabled}
        >
          <Plus className="h-4 w-4" aria-hidden />
          Add holding
        </button>
      </div>
      <p className="text-xs text-ink/55 md:col-span-4">Tip: press <kbd className="rounded border border-ink/15 bg-white px-1.5 py-0.5 font-mono text-[11px]">N</kbd> to focus symbol.</p>
    </form>
  );
}
