"use client";

import { Sparkles } from "lucide-react";
import { SectionCard } from "@/components/ui/SectionCard";
import type { DailyPortfolioSummary } from "@/lib/validation";

export type AiBrief = {
  summary: DailyPortfolioSummary;
  generatedAt: string;
  fallback: boolean;
  runType: "automatic" | "manual";
};

type Props = {
  brief: AiBrief | null;
};

const actionTone: Record<DailyPortfolioSummary["holdings"][number]["action"], string> = {
  Keep: "bg-mint/30 text-marine",
  Watch: "bg-amber/15 text-ink/75",
  Trim: "bg-amber/25 text-ink/80",
  Sell: "bg-coral/15 text-coral"
};

export function AiBriefPanel({ brief }: Props) {
  if (!brief) return null;
  const { summary, generatedAt, fallback, runType } = brief;
  const stamp = (() => {
    const date = new Date(generatedAt);
    return Number.isNaN(date.getTime())
      ? ""
      : date.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  })();

  return (
    <SectionCard
      variant="secondary"
      icon={Sparkles}
      eyebrow="AI"
      title="Daily portfolio brief"
      description={stamp ? `${runType === "manual" ? "Manual refresh" : "Daily run"} · ${stamp}` : undefined}
      compactHeader
    >
      <div className="space-y-4 p-3 sm:p-4">
        {fallback ? (
          <p className="rounded-md border border-amber/40 bg-amber/15 px-3 py-2 text-xs text-ink/70">
            AI commentary is unavailable right now, so this is a data-only recap. The next full analysis runs automatically at market close.
          </p>
        ) : null}

        <p className="text-sm text-ink/85">{summary.overview}</p>
        {summary.marketContext ? (
          <p className="text-xs text-ink/60">{summary.marketContext}</p>
        ) : null}

        {summary.holdings.length ? (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink/50">What to do</p>
            <ul className="space-y-1.5">
              {summary.holdings.map((holding) => (
                <li className="flex items-start gap-2 text-sm" key={holding.symbol}>
                  <span className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold ${actionTone[holding.action]}`}>
                    {holding.action}
                  </span>
                  <span className="text-ink/75"><span className="font-semibold text-ink">{holding.symbol}</span> — {holding.note}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {summary.watchItems.length ? (
          <div className="rounded-md bg-mint/15 px-3 py-2 text-xs text-ink/70">
            <span className="font-semibold text-ink/75">Watch:</span> {summary.watchItems.join("; ")}
          </div>
        ) : null}

        {summary.sources.length ? (
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink/50">
            <span className="font-semibold text-ink/60">Sources:</span>
            {summary.sources.map((source) => (
              <a className="text-marine hover:underline" href={source.url} key={source.url} target="_blank" rel="noopener noreferrer">
                {source.title}
              </a>
            ))}
          </div>
        ) : null}

        <p className="text-[11px] text-ink/45">Educational summary only — not financial advice.</p>
      </div>
    </SectionCard>
  );
}
