"use client";

import { LineChart, Settings2 } from "lucide-react";
import { useState, type ReactNode } from "react";

type Tab = "portfolio" | "settings";

type Props = {
  portfolio: ReactNode;
  settings: ReactNode;
};

export function MobileTabShell({ portfolio, settings }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("portfolio");

  return (
    <div className="md:contents">
      <div className="md:hidden">
        {activeTab === "portfolio" ? portfolio : settings}
      </div>
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-ink/10 bg-white/95 backdrop-blur md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        aria-label="Main navigation"
      >
        <div className="mx-auto grid max-w-7xl grid-cols-2">
          <button
            className={`inline-flex min-h-11 flex-col items-center justify-center gap-0.5 px-3 py-2 text-xs font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marine ${activeTab === "portfolio" ? "text-marine" : "text-ink/55"}`}
            type="button"
            aria-current={activeTab === "portfolio" ? "page" : undefined}
            onClick={() => setActiveTab("portfolio")}
          >
            <LineChart className="h-5 w-5" aria-hidden />
            Portfolio
          </button>
          <button
            className={`inline-flex min-h-11 flex-col items-center justify-center gap-0.5 px-3 py-2 text-xs font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marine ${activeTab === "settings" ? "text-marine" : "text-ink/55"}`}
            type="button"
            aria-current={activeTab === "settings" ? "page" : undefined}
            onClick={() => setActiveTab("settings")}
          >
            <Settings2 className="h-5 w-5" aria-hidden />
            Settings
          </button>
        </div>
      </nav>
    </div>
  );
}
