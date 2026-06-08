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
      <header ref={headerRef} className="sticky top-0 z-30 border-b border-ink/10 bg-white/95 px-3 py-2 backdrop-blur md:px-4 md:py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="truncate text-base font-bold text-ink md:text-4xl">Portfolio Exit Planner</h1>
            <p className="mt-1 hidden max-w-2xl text-sm text-ink/65 md:block md:text-base">Pick a profile, add holdings, and review exit scenarios for US and Egypt markets.</p>
          </div>
          {syncBadge ? <div className="shrink-0">{syncBadge}</div> : null}
        </div>
      </header>
      <div
        className={`section-gap mx-auto max-w-7xl space-y-3 px-3 py-3 md:space-y-6 md:px-4 md:py-6 ${mobileTabsActive ? "pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))] md:pb-6" : ""}`}
      >
        {children}
      </div>
    </main>
  );
}
