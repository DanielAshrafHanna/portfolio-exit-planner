"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PortfolioReportChartsPanel } from "@/components/PortfolioReportChartsPanel";
import { PortfolioReportPanel } from "@/components/PortfolioReportPanel";
import { ReportAiSummary, type AiSummaryEntry } from "@/components/ReportAiSummary";
import { reportTabClass } from "@/components/reportTabs";
import type { HoldingSnapshotDay } from "@/lib/holdingSnapshots";
import type { WeeklyChartSeries } from "@/lib/portfolioReportCharts";
import type { PortfolioReport } from "@/lib/portfolioReport";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";

type ReportTab = "daily" | "charts";

type ReportResponse = {
  report?: PortfolioReport;
  cloudUpdatedAt?: string | null;
  snapshotWarning?: string;
  error?: string;
};

type HistoryResponse = {
  days?: number;
  profileId?: string;
  series?: WeeklyChartSeries[];
  holdingSnapshots?: HoldingSnapshotDay[];
  warnings?: string[];
  error?: string;
};

type AiSummaryResponse = {
  generatedAt?: string;
  summaries?: AiSummaryEntry[];
  warnings?: string[];
  error?: string;
};

export function ReportPageContent() {
  const [activeTab, setActiveTab] = useState<ReportTab>("daily");
  const [hasViewedCharts, setHasViewedCharts] = useState(false);
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [report, setReport] = useState<PortfolioReport | null>(null);
  const [historySeries, setHistorySeries] = useState<WeeklyChartSeries[]>([]);
  const [holdingSnapshots, setHoldingSnapshots] = useState<HoldingSnapshotDay[]>([]);
  const [cloudUpdatedAt, setCloudUpdatedAt] = useState<string | null>(null);
  const [selectedProfileId, setSelectedProfileId] = useState("all");
  const [isLoadingReport, setIsLoadingReport] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [aiSummaries, setAiSummaries] = useState<AiSummaryEntry[]>([]);
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [hasRunAi, setHasRunAi] = useState(false);

  const loadReport = useCallback(async (fresh = false) => {
    if (!supabase) {
      setError("Supabase is not configured.");
      return;
    }
    setIsLoadingReport(true);
    setError(null);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Sign in again to refresh the report.");
      const response = await fetch(`/api/portfolio-report${fresh ? "?fresh=1" : ""}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store"
      });
      const payload = await response.json() as ReportResponse;
      if (!response.ok || !payload.report) throw new Error(payload.error || "Report failed to load.");
      setReport(payload.report);
      setCloudUpdatedAt(payload.cloudUpdatedAt || null);
      setWarnings((existing) => {
        const next = payload.snapshotWarning ? [payload.snapshotWarning] : [];
        return [...new Set([...existing.filter((warning) => !warning.includes("Portfolio history")), ...next])];
      });
      setSelectedProfileId((existing) => existing === "all" || payload.report?.profiles.some((profile) => profile.id === existing)
        ? existing
        : "all");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Report failed to load.");
    } finally {
      setIsLoadingReport(false);
    }
  }, [supabase]);

  const loadHistory = useCallback(async (profileId = selectedProfileId) => {
    if (!supabase) return;
    setIsLoadingHistory(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;
      const historyUrl = `/api/portfolio-report/history?days=7&profileId=${encodeURIComponent(profileId)}`;
      const response = await fetch(historyUrl, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store"
      });
      const payload = await response.json() as HistoryResponse;
      if (!response.ok) throw new Error(payload.error || "Report history failed to load.");
      setHistorySeries(payload.series || []);
      setHoldingSnapshots(payload.holdingSnapshots || []);
      if (payload.warnings?.length) {
        setWarnings((existing) => [...new Set([...existing, ...payload.warnings!])]);
      }
    } catch (loadError) {
      setError((existing) => existing || (loadError instanceof Error ? loadError.message : "Report history failed to load."));
    } finally {
      setIsLoadingHistory(false);
    }
  }, [selectedProfileId, supabase]);

  const loadAiSummary = useCallback(async () => {
    if (!supabase) {
      setAiError("Supabase is not configured.");
      return;
    }
    setIsLoadingAi(true);
    setHasRunAi(true);
    setAiError(null);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Sign in again to run AI analysis.");
      const response = await fetch("/api/portfolio-report/ai-summary", {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store"
      });
      const payload = await response.json() as AiSummaryResponse;
      if (!response.ok) throw new Error(payload.error || "AI analysis failed.");
      setAiSummaries(payload.summaries || []);
    } catch (loadError) {
      setAiError(loadError instanceof Error ? loadError.message : "AI analysis failed.");
    } finally {
      setIsLoadingAi(false);
    }
  }, [supabase]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  useEffect(() => {
    void loadAiSummary();
  }, [loadAiSummary]);

  useEffect(() => {
    void loadHistory(selectedProfileId);
  }, [loadHistory, selectedProfileId]);

  const refreshAll = useCallback((fresh = true) => {
    void loadReport(fresh);
    void loadHistory(selectedProfileId);
  }, [loadHistory, loadReport, selectedProfileId]);

  const showCharts = () => {
    setActiveTab("charts");
    setHasViewedCharts(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Report views">
        <button
          className={reportTabClass(activeTab === "daily")}
          type="button"
          role="tab"
          aria-selected={activeTab === "daily"}
          onClick={() => setActiveTab("daily")}
        >
          Daily report
        </button>
        <button
          className={reportTabClass(activeTab === "charts")}
          type="button"
          role="tab"
          aria-selected={activeTab === "charts"}
          onClick={showCharts}
        >
          Charts
        </button>
      </div>

      <div className={activeTab === "daily" ? "space-y-4" : "hidden"} role="tabpanel">
        <PortfolioReportPanel
          report={report}
          cloudUpdatedAt={cloudUpdatedAt}
          isLoading={isLoadingReport}
          error={error}
          warnings={warnings}
          selectedProfileId={selectedProfileId}
          onSelectedProfileIdChange={setSelectedProfileId}
          onRefresh={() => refreshAll(true)}
        />
        <ReportAiSummary
          summaries={aiSummaries}
          isLoading={isLoadingAi}
          error={aiError}
          hasRun={hasRunAi}
          onRun={() => void loadAiSummary()}
        />
      </div>
      {hasViewedCharts ? (
        <div className={activeTab === "charts" ? "" : "hidden"} role="tabpanel">
          <PortfolioReportChartsPanel
            report={report}
            historySeries={historySeries}
            holdingSnapshots={holdingSnapshots}
            selectedProfileId={selectedProfileId}
            onSelectedProfileIdChange={setSelectedProfileId}
            isLoadingReport={isLoadingReport}
            isLoadingHistory={isLoadingHistory}
            error={error}
            warnings={warnings}
            onRefresh={() => refreshAll(true)}
          />
        </div>
      ) : null}
    </div>
  );
}
