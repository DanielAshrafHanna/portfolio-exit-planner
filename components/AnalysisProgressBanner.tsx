"use client";

import { CheckCircle2, CircleDashed, Loader2, MinusCircle, PauseCircle, Sparkles } from "lucide-react";
import type { AnalysisPhase } from "@/lib/analysisProgress";

type Props = {
  phase: AnalysisPhase;
  completed: number;
  total: number;
  currentSymbol: string | null;
  model: string;
  completedSymbols: string[];
  pendingSymbols: string[];
  skippedSymbols?: string[];
  isActive: boolean;
  onResume?: () => void;
};

function phaseLabel(
  phase: AnalysisPhase,
  completed: number,
  total: number,
  currentSymbol: string | null,
  model: string,
  skippedSymbols: string[]
) {
  if (phase === "market") return "Refreshing quotes and news before AI analysis…";
  if (phase === "analyzing" && currentSymbol) {
    return `Analyzing ${currentSymbol} with ${model} (${completed + 1} of ${total})`;
  }
  if (phase === "analyzing") return `Running AI analysis with ${model}…`;
  if (phase === "interrupted") return `${completed} of ${total} holdings analyzed — run was interrupted`;
  if ((phase === "complete" || completed >= total) && completed === total && skippedSymbols.length) {
    return "All analyzable holdings analyzed";
  }
  if (phase === "complete" && completed === total) return `All ${total} holdings analyzed`;
  if (completed < total) return `${completed} of ${total} holdings analyzed`;
  return "AI analysis";
}

function SymbolPill({
  symbol,
  status
}: {
  symbol: string;
  status: "done" | "active" | "pending" | "skipped";
}) {
  const classes = status === "done"
    ? "border-marine/25 bg-mint/50 text-marine"
    : status === "active"
      ? "border-marine bg-marine text-white shadow-sm"
      : status === "skipped"
        ? "border-ink/10 bg-ink/[0.03] text-ink/40"
        : "border-ink/12 bg-white text-ink/55";

  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${classes}`}>
      {status === "done" ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> : null}
      {status === "active" ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
      {status === "pending" ? <CircleDashed className="h-3.5 w-3.5 opacity-60" aria-hidden /> : null}
      {status === "skipped" ? <MinusCircle className="h-3.5 w-3.5 opacity-60" aria-hidden /> : null}
      {symbol}
    </span>
  );
}

export function AnalysisProgressBanner({
  phase,
  completed,
  total,
  currentSymbol,
  model,
  completedSymbols,
  pendingSymbols,
  skippedSymbols = [],
  isActive,
  onResume
}: Props) {
  if (!total && !skippedSymbols.length) return null;

  const percent = total ? Math.round((completed / total) * 100) : 0;
  const allDone = total > 0 && completed >= total;
  const showResume = phase === "interrupted" && pendingSymbols.length > 0 && onResume;
  const orderedSymbols = [
    ...completedSymbols,
    ...(currentSymbol ? [currentSymbol] : []),
    ...pendingSymbols.filter((symbol) => symbol !== currentSymbol),
    ...skippedSymbols
  ];
  const uniqueSymbols = [...new Set(orderedSymbols)];

  return (
    <div
      className={`mx-4 mb-4 mt-4 rounded-lg border bg-white p-4 shadow-soft md:mx-4 ${
        isActive ? "border-marine/35 ring-1 ring-marine/10" : allDone ? "border-mint/60" : "border-amber/35"
      }`}
      role="status"
      aria-live="polite"
      aria-busy={isActive}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
            isActive ? "bg-marine text-white" : allDone ? "bg-mint text-marine" : "bg-amber/15 text-amber"
          }`}>
            {isActive ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : allDone ? <CheckCircle2 className="h-5 w-5" aria-hidden /> : <PauseCircle className="h-5 w-5" aria-hidden />}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <p className="text-lg font-bold text-ink">
                <span className="text-marine">{completed}</span>
                <span className="text-ink/45"> / </span>
                <span>{total}</span>
              </p>
              <p className="text-sm font-semibold text-ink/70">holdings analyzed</p>
            </div>
            <p className="mt-1 text-sm text-ink/60">
              {phaseLabel(phase, completed, total, currentSymbol, model, skippedSymbols)}
            </p>
            {skippedSymbols.length && allDone && !isActive ? (
              <p className="mt-1 text-xs text-ink/50">
                Skipped (no live quote): {skippedSymbols.join(", ")}
              </p>
            ) : null}
          </div>
        </div>
        {showResume ? (
          <button
            className="btn-primary inline-flex min-h-10 shrink-0 items-center gap-2 px-4 py-2 text-sm"
            type="button"
            onClick={onResume}
          >
            <Sparkles className="h-4 w-4" aria-hidden />
            Resume analysis
          </button>
        ) : null}
      </div>

      <div className="mt-4">
        <div className="h-2.5 overflow-hidden rounded-full bg-ink/8">
          <div
            className={`h-full rounded-full transition-all duration-500 ease-out ${
              allDone && !isActive ? "bg-marine" : isActive ? "bg-marine animate-pulse" : "bg-amber"
            }`}
            style={{ width: `${Math.max(percent, isActive && completed === 0 ? 8 : 0)}%` }}
          />
        </div>
        <p className="mt-1.5 text-xs font-medium text-ink/50">{percent}% complete</p>
      </div>

      {uniqueSymbols.length ? (
        <div className="mt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink/45">By holding</p>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {uniqueSymbols.map((symbol) => {
              const status = skippedSymbols.includes(symbol)
                ? "skipped"
                : completedSymbols.includes(symbol)
                  ? "done"
                  : currentSymbol === symbol && isActive
                    ? "active"
                    : "pending";
              return <SymbolPill key={symbol} symbol={symbol} status={status} />;
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
