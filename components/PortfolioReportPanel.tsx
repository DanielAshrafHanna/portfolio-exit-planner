"use client";

import { AlertTriangle, BarChart3, RefreshCw, TrendingDown, TrendingUp } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { DailyPlRangeBar } from "@/components/DailyPlRangeBar";
import { reportProfileTabClass } from "@/components/reportTabs";
import { SectionCard } from "@/components/ui/SectionCard";
import { aggregateDailyPlRangeFromHoldings, computeDailyPlRange } from "@/lib/dailyPlRange";
import { getDailyPlSessionInfo, regionFromCurrency } from "@/lib/marketSession";
import { formatMoney } from "@/lib/profileUtils";
import type { CurrencyCode } from "@/lib/types";
import { isEmailNoiseWarning } from "@/lib/reportEmailWarnings";
import type { PortfolioReport, PortfolioReportHolding, PortfolioReportTotals } from "@/lib/portfolioReport";

type Props = {
  report: PortfolioReport | null;
  cloudUpdatedAt: string | null;
  isLoading: boolean;
  error: string | null;
  warnings: string[];
  selectedProfileId: string;
  onSelectedProfileIdChange: (profileId: string) => void;
  onRefresh: () => void;
};

type SortKey = "profitLoss" | "dailyProfitLoss" | "profitLossPercent";

const sortLabels: Record<SortKey, string> = {
  profitLoss: "Total P/L",
  dailyProfitLoss: "Daily P/L",
  profitLossPercent: "Total %"
};

export function PortfolioReportPanel({
  report,
  cloudUpdatedAt,
  isLoading,
  error,
  warnings,
  selectedProfileId,
  onSelectedProfileIdChange,
  onRefresh
}: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("profitLoss");

  const selectedProfile = useMemo(() => (
    report?.profiles.find((profile) => profile.id === selectedProfileId)
  ), [report, selectedProfileId]);

  const displayedHoldings = useMemo(() => {
    const rows = selectedProfile ? selectedProfile.holdings : report?.holdings || [];
    return [...rows].sort((a, b) => b[sortKey] - a[sortKey]);
  }, [report?.holdings, selectedProfile, sortKey]);

  const totals = selectedProfile ? [selectedProfile.totals] : report?.totalsByCurrency || [];
  const dailySortLabel = useMemo(() => {
    if (selectedProfile) {
      const info = getDailyPlSessionInfo(selectedProfile.region);
      return info.isMarketClosed ? info.sessionLabel : "Today";
    }
    return "Session";
  }, [selectedProfile]);
  const generatedLabel = report ? formatDateTime(report.generatedAt) : "Not loaded";
  const cloudLabel = cloudUpdatedAt ? formatDateTime(cloudUpdatedAt) : undefined;
  const visibleWarnings = useMemo(
    () => [...new Set([...warnings, ...(report?.warnings || [])].filter((warning) => !isEmailNoiseWarning(warning)))],
    [report?.warnings, warnings]
  );

  return (
    <SectionCard
      variant="secondary"
      icon={BarChart3}
      eyebrow="Report"
      title="Daily report"
      action={(
        <button
          className="inline-flex min-h-10 items-center gap-2 rounded-md border border-marine/25 bg-white px-3 py-2 text-sm font-semibold text-marine hover:border-marine/50 disabled:cursor-not-allowed disabled:opacity-60"
          type="button"
          onClick={onRefresh}
          disabled={isLoading}
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} aria-hidden />
          Refresh
        </button>
      )}
    >
      <div className="space-y-4 p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-2 text-xs text-ink/55">
          <span>{generatedLabel}</span>
          {cloudLabel ? <span>Cloud {cloudLabel}</span> : null}
        </div>

        {error ? (
          <div className="flex gap-2 rounded-md border border-coral/30 bg-coral/10 p-3 text-sm text-coral">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            {error}
          </div>
        ) : null}

        {report ? (
          <>
            <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Filter report by portfolio">
              <button className={reportProfileTabClass(selectedProfileId === "all")} type="button" aria-pressed={selectedProfileId === "all"} onClick={() => onSelectedProfileIdChange("all")}>All</button>
              {report.profiles.map((profile) => (
                <button className={reportProfileTabClass(selectedProfileId === profile.id)} type="button" key={profile.id} aria-pressed={selectedProfileId === profile.id} onClick={() => onSelectedProfileIdChange(profile.id)}>
                  {profile.name}
                </button>
              ))}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {totals.map((item) => (
                <TotalsBlock
                  totals={item}
                  dailyRange={aggregateDailyPlRangeFromHoldings(
                    (selectedProfile ? selectedProfile.holdings : report.holdings)
                      .filter((holding) => holding.currency === item.currency && holding.currentPrice)
                      .map((holding) => ({
                        shares: holding.shares,
                        previousClose: holding.previousClose || 0,
                        dayLow: holding.dayLow,
                        dayHigh: holding.dayHigh,
                        currentPrice: holding.currentPrice || 0
                      }))
                  )}
                  key={item.currency}
                />
              ))}
            </div>

            <div className="rounded-md border border-ink/10 bg-mint/15 px-3 py-2 text-xs text-ink/65">
              <span className="font-semibold text-ink/75">How to read this:</span>{" "}
              <span className="text-ink/60">Total P/L</span> is your overall gain or loss since purchase (after fees).{" "}
              <span className="text-ink/60">Daily P/L</span> is how much your cost-basis P/L changed since the last saved snapshot (so buys and average-cost updates are included). With no prior snapshot it falls back to the session move vs prior close.
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-semibold text-ink">Holdings</div>
              <div className="flex gap-1 rounded-md border border-ink/10 bg-white p-1">
                {(["profitLoss", "dailyProfitLoss", "profitLossPercent"] as SortKey[]).map((key) => (
                  <button
                    className={`min-h-8 rounded px-2 text-xs font-semibold ${sortKey === key ? "bg-marine text-white" : "text-ink/65 hover:bg-mint/30"}`}
                    type="button"
                    key={key}
                    onClick={() => setSortKey(key)}
                  >
                    {key === "dailyProfitLoss" ? (dailySortLabel === "Session" ? "Daily P/L" : `${dailySortLabel} P/L`) : sortLabels[key]}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto rounded-md border border-ink/10 bg-white">
              <table className="min-w-[720px] w-full text-sm">
                <thead className="bg-surface-muted text-left text-xs text-ink/55">
                  <tr>
                    <th className="px-3 py-2 font-semibold uppercase tracking-wide">Holding</th>
                    <th className="px-3 py-2">
                      <div className="font-semibold uppercase tracking-wide">Market value</div>
                      <div className="font-normal normal-case text-ink/45">shares × price</div>
                    </th>
                    <th className="px-3 py-2">
                      <div className="font-semibold uppercase tracking-wide">Total P/L</div>
                      <div className="font-normal normal-case text-ink/45">vs cost · after fees</div>
                    </th>
                    <th className="px-3 py-2">
                      <div className="font-semibold uppercase tracking-wide">Daily P/L</div>
                      <div className="font-normal normal-case text-ink/45">vs last snapshot</div>
                    </th>
                    <th className="px-3 py-2">
                      <div className="font-semibold uppercase tracking-wide">Stop-loss</div>
                      <div className="font-normal normal-case text-ink/45">if triggered</div>
                    </th>
                    <th className="px-3 py-2">
                      <div className="font-semibold uppercase tracking-wide">Take-profit</div>
                      <div className="font-normal normal-case text-ink/45">target price</div>
                    </th>
                    <th className="px-3 py-2 font-semibold uppercase tracking-wide">AI view</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedHoldings.map((holding) => <HoldingRow holding={holding} key={`${holding.profileId}:${holding.id}`} />)}
                </tbody>
              </table>
            </div>

            {visibleWarnings.length ? (
              <div className="rounded-md border border-amber/35 bg-amber/10 p-3 text-sm text-ink/75">
                <div className="mb-1 flex items-center gap-2 font-semibold text-ink">
                  <AlertTriangle className="h-4 w-4 text-amber" aria-hidden />
                  Warnings
                </div>
                <ul className="space-y-1">
                  {visibleWarnings.map((warning) => <li key={warning}>{warning}</li>)}
                </ul>
              </div>
            ) : null}
          </>
        ) : (
          <div className="grid gap-2 md:grid-cols-4">
            {[0, 1, 2, 3].map((item) => <div className="h-20 animate-pulse rounded-md bg-white" key={item} />)}
          </div>
        )}
      </div>
    </SectionCard>
  );
}

function TotalsBlock({
  totals,
  dailyRange
}: {
  totals: PortfolioReportTotals;
  dailyRange?: ReturnType<typeof aggregateDailyPlRangeFromHoldings>;
}) {
  const session = getDailyPlSessionInfo(regionFromCurrency(totals.currency));

  return (
    <div className="rounded-md border border-ink/10 bg-white p-3">
      <div className="mb-3 flex items-center justify-between gap-2 border-b border-ink/8 pb-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-ink/55">{totals.currency} portfolio</span>
        {totals.profitLoss >= 0 ? <TrendingUp className="h-4 w-4 text-marine" aria-hidden /> : <TrendingDown className="h-4 w-4 text-coral" aria-hidden />}
      </div>

      <dl className="space-y-3 text-sm">
        <MetricRow
          label="Portfolio value"
          hint="current market price"
          value={formatMoney(totals.currentValue, totals.currency)}
        />
        <MetricRow
          label="Total P/L"
          hint="since purchase · after fees"
          value={formatSignedMoney(totals.profitLoss, totals.currency)}
          subValue={formatPercent(totals.profitLossPercent)}
          tone={totals.profitLoss}
        />
        <MetricRow
          label="Daily P/L"
          hint={`${session.sessionLabel} · change vs last snapshot`}
          value={formatSignedMoney(totals.dailyProfitLoss, totals.currency)}
          subValue={formatPercent(totals.dailyProfitLossPercent)}
          tone={totals.dailyProfitLoss}
          rangeBar={dailyRange ? (
            <DailyPlRangeBar range={dailyRange} currency={totals.currency} />
          ) : undefined}
        />
      </dl>

      <div className="mt-3 grid grid-cols-2 gap-2 border-t border-ink/8 pt-3 text-xs">
        <div className="rounded-md bg-mint/20 px-2 py-1.5">
          <div className="text-ink/55">Winning positions</div>
          <div className="font-semibold text-marine">{formatSignedMoney(totals.totalGains, totals.currency)}</div>
        </div>
        <div className="rounded-md bg-coral/10 px-2 py-1.5">
          <div className="text-ink/55">Losing positions</div>
          <div className="font-semibold text-coral">{formatSignedMoney(totals.totalLosses, totals.currency)}</div>
        </div>
      </div>
    </div>
  );
}

function MetricRow({
  label,
  hint,
  value,
  subValue,
  tone,
  rangeBar
}: {
  label: string;
  hint: string;
  value: string;
  subValue?: string;
  tone?: number;
  rangeBar?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="min-w-0">
        <div className="font-semibold text-ink">{label}</div>
        <div className="text-xs text-ink/50">{hint}</div>
      </dt>
      <dd className={`shrink-0 text-right font-semibold ${tone !== undefined ? toneClass(tone) : "text-ink"}`}>
        <div>{value}</div>
        {subValue ? <div className="text-xs font-medium opacity-80">{subValue}</div> : null}
        {rangeBar}
      </dd>
    </div>
  );
}

function HoldingRow({ holding }: { holding: PortfolioReportHolding }) {
  const dailyRange = holding.currentPrice
    ? computeDailyPlRange({
      shares: holding.shares,
      previousClose: holding.previousClose || 0,
      dayLow: holding.dayLow,
      dayHigh: holding.dayHigh,
      currentPrice: holding.currentPrice
    })
    : undefined;

  return (
    <tr className="border-t border-ink/8">
      <td className="px-3 py-2">
        <div className="font-semibold text-ink">{holding.symbol}</div>
        <div className="text-xs text-ink/55">{holding.name || holding.profileName}</div>
      </td>
      <td className="px-3 py-2">{holding.currentPrice ? formatMoney(holding.currentValue, holding.currency) : "N/A"}</td>
      <td className={`px-3 py-2 font-semibold ${toneClass(holding.profitLoss)}`}>
        {holding.currentPrice ? formatSignedMoney(holding.profitLoss, holding.currency) : "N/A"}
        <div className="text-xs">{holding.currentPrice ? formatPercent(holding.profitLossPercent) : ""}</div>
      </td>
      <td className={`px-3 py-2 font-semibold ${toneClass(holding.dailyProfitLoss)}`}>
        {holding.currentPrice ? formatSignedMoney(holding.dailyProfitLoss, holding.currency) : "N/A"}
        <div className="text-xs font-normal">{holding.currentPrice ? formatPercent(holding.dailyProfitLossPercent) : ""}</div>
        {dailyRange ? (
          <DailyPlRangeBar range={dailyRange} currency={holding.currency} variant="table" />
        ) : null}
      </td>
      <td className="px-3 py-2 text-ink/70">{holding.stopPrice ? formatMoney(holding.stopPrice, holding.currency) : "-"}</td>
      <td className="px-3 py-2 text-ink/70">{holding.targetPrice ? formatMoney(holding.targetPrice, holding.currency) : "-"}</td>
      <td className="px-3 py-2">{holding.action || "-"}</td>
    </tr>
  );
}

function toneClass(value: number) {
  return value > 0 ? "text-marine" : value < 0 ? "text-coral" : "text-ink";
}

function formatSignedMoney(value: number, currency: CurrencyCode) {
  const prefix = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${prefix}${formatMoney(Math.abs(value), currency)}`;
}

function formatPercent(value: number) {
  return `${value > 0 ? "+" : ""}${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}%`;
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}
