"use client";

import { useEffect, useRef, type ReactNode } from "react";

type Props = {
  syncBadge?: ReactNode;
  children: ReactNode;
  mobileTabsActive?: boolean;
};

export function DashboardShell({ syncBadge, children, mobileTabsActive = false }: Props) {
  const headerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;

    const updateHeight = () => {
      document.documentElement.style.setProperty("--app-header-height", `${header.offsetHeight}px`);
    };

    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(header);
    window.addEventListener("resize", updateHeight);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateHeight);
    };
  }, []);

  return (
    <main className="min-h-screen bg-gradient-to-b from-paper via-paper to-white">
      <header ref={headerRef} className="sticky top-0 z-30 border-b border-ink/10 bg-white/95 px-4 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-normal text-ink md:text-4xl">Portfolio Exit Planner</h1>
            <p className="mt-1 max-w-2xl text-sm text-ink/65 md:text-base">Pick a profile, add holdings, and review exit scenarios for US and Egypt markets.</p>
          </div>
          {syncBadge ? <div className="shrink-0">{syncBadge}</div> : null}
        </div>
      </header>
      <div
        className={`section-gap mx-auto max-w-7xl space-y-6 px-4 py-6 ${mobileTabsActive ? "pb-[calc(5rem+env(safe-area-inset-bottom,0px))] md:pb-6" : ""}`}
      >
        {children}
      </div>
    </main>
  );
}
