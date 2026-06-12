import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { DashboardShell } from "@/components/DashboardShell";
import { PortfolioReportPanel } from "@/components/PortfolioReportPanel";

export const metadata: Metadata = {
  title: "Daily Report"
};

export default function ReportPage() {
  return (
    <DashboardShell
      headerActions={(
        <Link
          className="inline-flex min-h-10 items-center gap-2 rounded-md border border-ink/15 bg-white px-3 py-2 text-sm font-semibold text-ink hover:border-marine/35 hover:text-marine"
          href="/"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Portfolio
        </Link>
      )}
    >
      <PortfolioReportPanel />
    </DashboardShell>
  );
}
