"use client";

import { Sparkles, AlertTriangle } from "lucide-react";
import { SectionCard } from "@/components/ui/SectionCard";

export type AiSummaryHolding = {
  symbol: string;
  action: "Keep" | "Watch" | "Trim" | "Sell";
  note: string;
};

export type AiSummaryEntry = {
  profileId: string;
  profileName: string;
  fallback: boolean;
  warning?: string;
  summary: {
    overview: string;
    marketContext: string;
    holdings: AiSummaryHolding[];
    watchItems: string[];
    sources: Array<{ title: string; publisher: string; url: string }>;
  };
};

type Props = {
  summaries: AiSummaryEntry[];
  isLoading: boolean;
  error: string | null;
  hasRun: boolean;
  onRun: () => void;
};

const actionTone: Record<AiSummaryHolding["action"], string> = {
  Keep: "bg-mint/30 text-marine",
  Watch: "bg-amber/15 text-ink/75",
  Trim: "bg-amber/25 text-ink/80",
  Sell: "bg-coral/15 text-coral"
};

export function ReportAiSummary({ summaries, isLoading, error, hasRun, onRun }: Props) {
  return (
    <SectionCard
      variant="secondary"
      icon={Sparkles}
      eyebrow="AI"
      title="AI market-close analysis"
      action={(
        <button
          className="inline-flex min-h-10 items-center gap-2 rounded-md border border-marine/25 bg-white px-3 py-2 text-sm font-semibold text-marine hover:border-marine/50 disabled:cursor-not-allowed disabled:opacity-60"
          type="button"
          onClick={onRun}
          disabled={isLoading}
        >
          <Sparkles className={`h-4 w-4 ${isLoading ? "animate-pulse" : ""}`} aria-hidden />
          {isLoading ? "Loading…" : hasRun ? "Reload cached" : "Load cached AI"}
        </button>
      )}
    >
      <div className="space-y-4 p-3 sm:p-4">
        <p className="text-xs text-ink/55">
          Daily AI runs automatically at market close (1 Gemini call per profile). Manual refresh is disabled to protect API limits.
        </p>

        {error ? (
          <div className="flex gap-2 rounded-md border border-coral/30 bg-coral/10 p-3 text-sm text-coral">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            {error}
          </div>
        ) : null}

        {!hasRun && !isLoading && !summaries.length ? (
          <p className="text-sm text-ink/60">Cached daily analysis loads automatically when available.</p>
        ) : null}

        {isLoading && !summaries.length ? (
          <div className="space-y-2">
            {[0, 1].map((item) => <div className="h-24 animate-pulse rounded-md bg-white" key={item} />)}
          </div>
        ) : null}

        {!summaries.length && hasRun && !isLoading && !error ? (
          <p className="text-sm text-ink/60">No daily AI cache yet for today. Check back after the automatic market-close run.</p>
        ) : null}

        {summaries.map((entry) => (
          <article className="rounded-md border border-ink/10 bg-white p-3" key={entry.profileId}>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-ink">{entry.profileName}</h3>
              {entry.fallback ? (
                <span className="rounded-full bg-amber/15 px-2 py-0.5 text-xs font-semibold text-ink/70">Data-only fallback</span>
              ) : null}
            </div>
            <p className="text-sm text-ink/80">{entry.summary.overview}</p>
            {entry.summary.marketContext ? (
              <p className="mt-2 text-xs text-ink/60">{entry.summary.marketContext}</p>
            ) : null}

            {entry.summary.holdings.length ? (
              <ul className="mt-3 space-y-1.5">
                {entry.summary.holdings.map((holding) => (
                  <li className="flex items-start gap-2 text-sm" key={holding.symbol}>
                    <span className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold ${actionTone[holding.action]}`}>
                      {holding.action}
                    </span>
                    <span className="text-ink/75"><span className="font-semibold text-ink">{holding.symbol}</span> — {holding.note}</span>
                  </li>
                ))}
              </ul>
            ) : null}

            {entry.summary.watchItems.length ? (
              <div className="mt-3 rounded-md bg-mint/15 px-3 py-2 text-xs text-ink/70">
                <span className="font-semibold text-ink/75">Watch:</span> {entry.summary.watchItems.join("; ")}
              </div>
            ) : null}

            {entry.summary.sources.length ? (
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink/50">
                <span className="font-semibold text-ink/60">Sources:</span>
                {entry.summary.sources.map((source) => (
                  <a className="text-marine hover:underline" href={source.url} key={source.url} target="_blank" rel="noopener noreferrer">
                    {source.title}
                  </a>
                ))}
              </div>
            ) : null}

            {entry.warning ? (
              <p className="mt-2 text-xs text-ink/50">{entry.warning}</p>
            ) : null}
          </article>
        ))}
      </div>
    </SectionCard>
  );
}
