"use client";

import { useState } from "react";
import { PortfolioReportChartsPanel } from "@/components/PortfolioReportChartsPanel";
import { PortfolioReportPanel } from "@/components/PortfolioReportPanel";
import { reportTabClass } from "@/components/reportTabs";

type ReportTab = "daily" | "charts";

export function ReportPageContent() {
  const [activeTab, setActiveTab] = useState<ReportTab>("daily");

  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto pb-1">
        <button
          className={reportTabClass(activeTab === "daily")}
          type="button"
          onClick={() => setActiveTab("daily")}
        >
          Daily report
        </button>
        <button
          className={reportTabClass(activeTab === "charts")}
          type="button"
          onClick={() => setActiveTab("charts")}
        >
          Charts
        </button>
      </div>

      {activeTab === "daily" ? <PortfolioReportPanel /> : <PortfolioReportChartsPanel />}
    </div>
  );
}
