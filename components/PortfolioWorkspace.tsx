"use client";

import { LineChart, Plus } from "lucide-react";
import type { ReactNode } from "react";
import { SectionCard } from "@/components/ui/SectionCard";

type Props = {
  profileBar: ReactNode;
  holdingsView: ReactNode;
  summary: ReactNode;
  quickAdd: ReactNode;
  emptyState?: ReactNode;
  holdingsTable: ReactNode;
  editHoldings: ReactNode;
  analyzing?: ReactNode;
  hasHoldings: boolean;
  onAddFirstHolding?: () => void;
  readOnly?: boolean;
};

export function PortfolioWorkspace({
  profileBar,
  holdingsView,
  summary,
  quickAdd,
  emptyState,
  holdingsTable,
  editHoldings,
  analyzing,
  hasHoldings,
  onAddFirstHolding,
  readOnly = false
}: Props) {
  return (
    <div className="space-y-6">
      <div className="sticky top-[88px] z-20 -mx-4 border-y border-ink/10 bg-white/95 px-4 py-3 backdrop-blur md:top-[92px]">
        <div className="space-y-3">
          {profileBar}
          {holdingsView}
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
        <div className={!readOnly && hasHoldings ? "mt-4" : readOnly ? "" : "mt-0"}>
          {holdingsTable}
        </div>
        {analyzing}
        {!readOnly ? <div className="mt-6">{editHoldings}</div> : null}
      </SectionCard>

      {!readOnly ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-ink/10 bg-white/95 p-3 backdrop-blur md:hidden">
          <button
            className="btn-primary min-h-11 w-full"
            type="button"
            onClick={() => {
              onAddFirstHolding?.();
              document.getElementById("portfolio-workspace")?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
          >
            <Plus className="h-4 w-4" aria-hidden />
            Add holding
          </button>
        </div>
      ) : null}
    </div>
  );
}
