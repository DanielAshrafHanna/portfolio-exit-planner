"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { useState, type ReactNode } from "react";
import type { CurrencyCode, EnrichedHolding, FeeSettings } from "@/lib/types";
import { computeHoldingRowMetrics, profitLossTone, badgeTone } from "@/lib/holdingDisplay";
import { formatMoney } from "@/lib/profileUtils";
import { ExtendedHoursPriceMarker } from "./ExtendedHoursPriceMarker";
import { StaleQuoteMarker } from "./StaleQuoteMarker";
import { HoldingDetails } from "./HoldingDetails";

type Props = {
  holdings: EnrichedHolding[];
  settings: FeeSettings;
  currency: CurrencyCode;
  onChange?: (holding: EnrichedHolding) => void;
  readOnly?: boolean;
};

function Badge({ value }: { value?: string }) {
  const tone = badgeTone(value);
  const color = tone === "danger" ? "bg-coral/15 text-coral" : tone === "warning" ? "bg-amber/20 text-ink" : "bg-mint text-marine";
  return <span className={`rounded px-2 py-1 text-xs font-semibold ${color}`}>{value || "N/A"}</span>;
}

function MetricCell({ label, value, tone }: { label: string; value: ReactNode; tone?: "loss" | "gain" | "neutral" }) {
  const color = tone === "loss" ? "text-coral" : tone === "gain" ? "text-marine" : "text-ink";
  return (
    <div className="min-w-0">
      <p className="text-[11px] uppercase text-ink/55">{label}</p>
      <p className={`mt-0.5 truncate text-sm font-semibold ${color}`}>{value}</p>
    </div>
  );
}

export function HoldingsCardList({ holdings, settings, currency, onChange, readOnly = false }: Props) {
  const [open, setOpen] = useState<Record<string, boolean>>({});

  if (!holdings.length) return null;

  return (
    <div className="space-y-3 md:hidden">
      {holdings.map((holding) => {
        const quote = holding.quote;
        const metrics = computeHoldingRowMetrics(holding, settings);
        const canExpand = !readOnly && Boolean(onChange);
        const isOpen = Boolean(open[holding.id]);
        const plTone = profitLossTone(metrics.current?.profitLoss);

        return (
          <article className="overflow-hidden rounded-lg border border-ink/10 bg-white shadow-soft" key={holding.id}>
            <button
              className="flex w-full items-start gap-2 p-3 text-left"
              type="button"
              disabled={!canExpand}
              aria-expanded={canExpand ? isOpen : undefined}
              onClick={() => {
                if (!canExpand) return;
                setOpen((prev) => ({ ...prev, [holding.id]: !prev[holding.id] }));
              }}
            >
              {canExpand ? (
                <span className="mt-0.5 shrink-0 text-ink/55">
                  {isOpen ? <ChevronDown className="h-5 w-5" aria-hidden /> : <ChevronRight className="h-5 w-5" aria-hidden />}
                </span>
              ) : null}
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="inline-flex items-center font-bold text-ink">
                      {holding.symbol}
                      {quote?.stale ? <StaleQuoteMarker /> : null}
                    </p>
                    {holding.name ? <p className="truncate text-xs text-ink/55">{holding.name}</p> : null}
                  </div>
                  {metrics.current ? (
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${plTone === "loss" ? "bg-coral/15 text-coral" : "bg-mint text-marine"}`}>
                      {formatMoney(metrics.current.profitLoss, currency)} ({metrics.current.profitLossPercent}%)
                    </span>
                  ) : (
                    <span className="shrink-0 text-xs text-ink/55">Loading</span>
                  )}
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <MetricCell
                    label="Price"
                    value={quote ? (
                      <span className="inline-flex items-center">
                        {formatMoney(quote.currentPrice, currency)}
                        <ExtendedHoursPriceMarker session={quote.priceSession} />
                      </span>
                    ) : "—"}
                  />
                  <MetricCell label="Value" value={metrics.current ? formatMoney(metrics.current.grossValue, currency) : "—"} />
                  <MetricCell
                    label="P/L %"
                    value={metrics.current ? `${metrics.current.profitLossPercent}%` : "—"}
                    tone={plTone === "neutral" ? "neutral" : plTone}
                  />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge value={holding.analysis?.action} />
                  <Badge value={holding.analysis?.confidence} />
                  <Badge value={holding.analysis?.riskLevel} />
                </div>
                {(metrics.stopPrice || metrics.targetPrice) ? (
                  <div className="mt-3 grid grid-cols-2 gap-2 border-t border-ink/8 pt-3 text-xs">
                    <div>
                      <span className="text-ink/55">Stop </span>
                      <span className="font-semibold">{metrics.stopPrice ? formatMoney(metrics.stopPrice, currency) : "—"}</span>
                    </div>
                    <div>
                      <span className="text-ink/55">Target </span>
                      <span className="font-semibold text-marine">{metrics.targetPrice ? formatMoney(metrics.targetPrice, currency) : "—"}</span>
                    </div>
                  </div>
                ) : null}
              </div>
            </button>
            {canExpand && onChange && isOpen ? (
              <div className="border-t border-ink/10">
                <HoldingDetails holding={holding} settings={settings} currency={currency} onChange={onChange} />
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
