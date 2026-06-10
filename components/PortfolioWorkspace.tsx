"use client";

import { LineChart, Plus } from "lucide-react";
import type { ReactNode } from "react";
import { SectionCard } from "@/components/ui/SectionCard";

type Props = {
  profileBar: ReactNode;
  compactProfileBar?: ReactNode;
  holdingsView: ReactNode;
  summary: ReactNode;
  quickAdd: ReactNode;
  emptyState?: ReactNode;
  holdingsTable: ReactNode;
  editHoldings: ReactNode;
  analyzing?: ReactNode;
  hasHoldings: boolean;
  onAddFirstHolding?: () => void;
  onFabClick?: () => void;
  showFab?: boolean;
  readOnly?: boolean;
};

export function PortfolioWorkspace({
  profileBar,
  compactProfileBar,
  holdingsView,
  summary,
  quickAdd,
  emptyState,
  holdingsTable,
  editHoldings,
  analyzing,
  hasHoldings,
  onAddFirstHolding,
  onFabClick,
  showFab = false,
  readOnly = false
}: Props) {
  return (
    <div className="space-y-2 md:space-y-6">
      {compactProfileBar ? (
        <div className="md:hidden">{compactProfileBar}</div>
      ) : null}
      <div className="hidden space-y-3 border-b border-ink/10 pb-3 md:block">
        {profileBar}
        {holdingsView}
      </div>

      {summary}

      <SectionCard
        variant="primary"
        icon={LineChart}
        eyebrow="Holdings"
        title="Your portfolio"
        description={readOnly ? "Read-only view of a shared portfolio." : "Add holdings, review analysis, and adjust targets."}
        id="portfolio-workspace"
        compactHeader
        flushContent
      >
        {!readOnly ? (
          <div className="hidden space-y-4 px-4 pt-4 md:block md:px-4">
            {quickAdd}
            {!hasHoldings ? (
              emptyState ?? (
                <div className="rounded-md border border-dashed border-marine/30 bg-mint/20 p-6 text-center">
                  <p className="text-sm text-ink/70">No holdings yet. Add your first stock to start tracking exits.</p>
                  {onAddFirstHolding ? (
                    <button
                      className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-md bg-marine px-4 py-2 text-sm font-semibold text-white"
                      type="button"
                      onClick={onAddFirstHolding}
                    >
                      <Plus className="h-4 w-4" aria-hidden />
                      Add your first holding
                    </button>
                  ) : null}
                </div>
              )
            ) : null}
          </div>
        ) : null}
        <div className={hasHoldings ? "md:mt-4" : ""}>
          {holdingsTable}
        </div>
        {analyzing}
        {!readOnly ? <div className="mt-4 px-4 md:mt-6 md:px-4">{editHoldings}</div> : null}
      </SectionCard>

      {showFab && !readOnly ? (
        <button
          className="fixed right-3 z-30 inline-flex h-12 w-12 items-center justify-center rounded-full bg-marine text-white shadow-soft-lg md:hidden"
          style={{ bottom: "calc(4rem + env(safe-area-inset-bottom, 0px))" }}
          type="button"
          aria-label="Add holding"
          onClick={onFabClick}
        >
          <Plus className="h-5 w-5" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}
