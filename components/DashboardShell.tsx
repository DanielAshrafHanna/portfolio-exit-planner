"use client";

import type { ReactNode } from "react";

type Props = {
  syncBadge?: ReactNode;
  children: ReactNode;
};

export function DashboardShell({ syncBadge, children }: Props) {
  return (
    <main className="min-h-screen bg-gradient-to-b from-paper via-paper to-white">
      <header className="sticky top-0 z-30 border-b border-ink/10 bg-white/95 px-4 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-normal text-ink md:text-4xl">Portfolio Exit Planner</h1>
            <p className="mt-1 max-w-2xl text-sm text-ink/65 md:text-base">Pick a profile, add holdings, and review exit scenarios for US and Egypt markets.</p>
          </div>
          {syncBadge ? <div className="shrink-0">{syncBadge}</div> : null}
        </div>
      </header>
      <div className="section-gap mx-auto max-w-7xl space-y-6 px-4 py-6">{children}</div>
    </main>
  );
}
