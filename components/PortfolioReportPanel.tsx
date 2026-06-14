"use client";

import { AlertTriangle, BarChart3, RefreshCw, TrendingDown, TrendingUp } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { reportProfileTabClass } from "@/components/reportTabs";
import { SectionCard } from "@/components/ui/SectionCard";
import { formatMoney } from "@/lib/profileUtils";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";
import type { CurrencyCode } from "@/lib/types";
import type { PortfolioReport, PortfolioReportHolding, PortfolioReportTotals } from "@/lib/portfolioReport";

type ReportResponse = {
  report?: PortfolioReport;
  cloudUpdatedAt?: string | null;
  snapshotWarning?: string;
  error?: string;
};

type SortKey = "profitLoss" | "dailyProfitLoss" | "profitLossPercent";

const sortLabels: Record<SortKey, string> = {
  profitLoss: "P/L",
  dailyProfitLoss: "Today",
  profitLossPercent: "%"
};

export function PortfolioReportPanel() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [report, setReport] = useState<PortfolioReport | null>(null);
  const [cloudUpdatedAt, setCloudUpdatedAt] = useState<string | null>(null);
  const [selectedProfileId, setSelectedProfileId] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("profitLoss");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const loadReport = useCallback(async () => {
    if (!supabase) {
      setError("Supabase is not configured.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Sign in again to refresh the report.");
      const response = await fetch("/api/portfolio-report", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store"
      });
      const payload = await response.json() as ReportResponse;
      if (!response.ok || !payload.report) throw new Error(payload.error || "Report failed to load.");
      setReport(payload.report);
      setCloudUpdatedAt(payload.cloudUpdatedAt || null);
      setWarnings(payload.snapshotWarning ? [payload.snapshotWarning] : []);
      setSelectedProfileId((existing) => existing === "all" || payload.report?.profiles.some((profile) => profile.id === existing)
        ? existing
        : "all");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Report failed to load.");
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  const selectedProfile = useMemo(() => (
    report?.profiles.find((profile) => profile.id === selectedProfileId)
  ), [report, selectedProfileId]);

  const displayedHoldings = useMemo(() => {
    const rows = selectedProfile ? selectedProfile.holdings : report?.holdings || [];
    return [...rows].sort((a, b) => b[sortKey] - a[sortKey]);
  }, [report?.holdings, selectedProfile, sortKey]);

  const totals = selectedProfile ? [selectedProfile.totals] : report?.totalsByCurrency || [];
  const generatedLabel = report ? formatDateTime(report.generatedAt) : "Not loaded";
  const cloudLabel = cloudUpdatedAt ? formatDateTime(cloudUpdatedAt) : undefined;

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
          onClick={() => void loadReport()}
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
            <div className="flex gap-2 overflow-x-auto pb-1">
              <button className={reportProfileTabClass(selectedProfileId === "all")} type="button" onClick={() => setSelectedProfileId("all")}>All</button>
              {report.profiles.map((profile) => (
                <button className={reportProfileTabClass(selectedProfileId === profile.id)} type="button" key={profile.id} onClick={() => setSelectedProfileId(profile.id)}>
                  {profile.name}
                </button>
              ))}
            </div>

            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
              {totals.map((item) => <TotalsBlock totals={item} key={item.currency} />)}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-semibold text-ink">Holdings</div>
              <div className="flex gap-1 rounded-md border border-ink/10 bg-white p-1">
                {(Object.keys(sortLabels) as SortKey[]).map((key) => (
                  <button
                    className={`min-h-8 rounded px-2 text-xs font-semibold ${sortKey === key ? "bg-marine text-white" : "text-ink/65 hover:bg-mint/30"}`}
                    type="button"
                    key={key}
                    onClick={() => setSortKey(key)}
                  >
                    {sortLabels[key]}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto rounded-md border border-ink/10 bg-white">
              <table className="min-w-[720px] w-full text-sm">
                <thead className="bg-surface-muted text-left text-xs uppercase text-ink/55">
                  <tr>
                    <th className="px-3 py-2">Symbol</th>
                    <th className="px-3 py-2">Value</th>
                    <th className="px-3 py-2">P/L</th>
                    <th className="px-3 py-2">Today</th>
                    <th className="px-3 py-2">Stop</th>
                    <th className="px-3 py-2">Target</th>
                    <th className="px-3 py-2">AI</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedHoldings.map((holding) => <HoldingRow holding={holding} key={`${holding.profileId}:${holding.id}`} />)}
                </tbody>
              </table>
            </div>

            {report.warnings.length || warnings.length ? (
              <div className="rounded-md border border-amber/35 bg-amber/10 p-3 text-sm text-ink/75">
                <div className="mb-1 flex items-center gap-2 font-semibold text-ink">
                  <AlertTriangle className="h-4 w-4 text-amber" aria-hidden />
                  Warnings
                </div>
                <ul className="space-y-1">
                  {[...new Set([...warnings, ...report.warnings])].map((warning) => <li key={warning}>{warning}</li>)}
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

function TotalsBlock({ totals }: { totals: PortfolioReportTotals }) {
  return (
    <div className="rounded-md border border-ink/10 bg-white p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-xs font-semibold uppercase text-ink/50">{totals.currency}</div>
        {totals.profitLoss >= 0 ? <TrendingUp className="h-4 w-4 text-marine" aria-hidden /> : <TrendingDown className="h-4 w-4 text-coral" aria-hidden />}
      </div>
      <div className="text-lg font-semibold text-ink">{formatMoney(totals.currentValue, totals.currency)}</div>
      <div className={toneClass(totals.profitLoss)}>{formatSignedMoney(totals.profitLoss, totals.currency)} ({formatPercent(totals.profitLossPercent)})</div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-ink/60">
        <span>Today</span><span className={`text-right font-semibold ${toneClass(totals.dailyProfitLoss)}`}>{formatSignedMoney(totals.dailyProfitLoss, totals.currency)}</span>
        <span>Gains</span><span className="text-right font-semibold text-marine">{formatSignedMoney(totals.totalGains, totals.currency)}</span>
        <span>Losses</span><span className="text-right font-semibold text-coral">{formatSignedMoney(totals.totalLosses, totals.currency)}</span>
      </div>
    </div>
  );
}

function HoldingRow({ holding }: { holding: PortfolioReportHolding }) {
  return (
    <tr className="border-t border-ink/8">
      <td className="px-3 py-2">
        <div className="font-semibold text-ink">{holding.symbol}</div>
        <div className="max-w-36 truncate text-xs text-ink/50">{holding.name || holding.profileName}</div>
      </td>
      <td className="px-3 py-2 font-semibold">{formatMoney(holding.currentValue, holding.currency)}</td>
      <td className={`px-3 py-2 font-semibold ${toneClass(holding.profitLoss)}`}>
        {formatSignedMoney(holding.profitLoss, holding.currency)}
        <div className="text-xs">{formatPercent(holding.profitLossPercent)}</div>
      </td>
      <td className={`px-3 py-2 font-semibold ${toneClass(holding.dailyProfitLoss)}`}>
        {formatSignedMoney(holding.dailyProfitLoss, holding.currency)}
        <div className="text-xs">{formatPercent(holding.dailyProfitLossPercent)}</div>
      </td>
      <td className="px-3 py-2 text-ink/70">{holding.stopPrice ? formatMoney(holding.stopPrice, holding.currency) : "-"}</td>
      <td className="px-3 py-2 text-ink/70">{holding.targetPrice ? formatMoney(holding.targetPrice, holding.currency) : "-"}</td>
      <td className="px-3 py-2">
        <div className="inline-flex rounded border border-ink/10 px-2 py-1 text-xs font-semibold text-ink/70">{holding.action || "-"}</div>
      </td>
    </tr>
  );
}

function toneClass(value: number) {
  if (value > 0) return "text-marine";
  if (value < 0) return "text-coral";
  return "text-ink/60";
}

function formatPercent(value: number) {
  return `${value > 0 ? "+" : ""}${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}%`;
}

function formatSignedMoney(value: number, currency: CurrencyCode) {
  const prefix = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${prefix}${formatMoney(Math.abs(value), currency)}`;
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}
