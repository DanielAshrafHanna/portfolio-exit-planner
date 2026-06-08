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
  holdingsCards?: ReactNode;
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
  holdingsCards,
  editHoldings,
  analyzing,
  hasHoldings,
  onAddFirstHolding,
  onFabClick,
  showFab = false,
  readOnly = false
}: Props) {
  return (
    <div className="space-y-6">
      <div
        className="sticky z-20 -mx-4 border-y border-ink/10 bg-white/95 px-4 py-3 backdrop-blur"
        style={{ top: "var(--app-header-height, 88px)" }}
      >
        <div className="space-y-3">
          {compactProfileBar ? <div className="md:hidden">{compactProfileBar}</div> : null}
          <div className="hidden md:block">{profileBar}</div>
          <div className="hidden md:block">{holdingsView}</div>
        </div>
      </div>

      {summary}

      <SectionCard
        variant="primary"
        icon={LineChart}
        eyebrow="Holdings"
        title="Your portfolio"
        description={readOnly ? "Read-only view of a shared portfolio." : "Add holdings, review analysis, and adjust targets."}
        id="portfolio-workspace"
      >
        {!readOnly ? (
          <div className="space-y-4">
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
        <div className={!readOnly && hasHoldings ? "mt-4 space-y-4" : readOnly ? "" : "mt-0"}>
          {holdingsCards}
          {holdingsTable}
        </div>
        {analyzing}
        {!readOnly ? <div className="mt-6">{editHoldings}</div> : null}
      </SectionCard>

      {showFab && !readOnly ? (
        <button
          className="fixed right-4 z-30 inline-flex h-14 w-14 items-center justify-center rounded-full bg-marine text-white shadow-soft-lg md:hidden"
          style={{ bottom: "calc(4.5rem + env(safe-area-inset-bottom, 0px))" }}
          type="button"
          aria-label="Add holding"
          onClick={onFabClick}
        >
          <Plus className="h-6 w-6" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}
