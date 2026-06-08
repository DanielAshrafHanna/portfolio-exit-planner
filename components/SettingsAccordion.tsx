"use client";

import { ChevronDown, Settings2 } from "lucide-react";
import { useState, type ReactNode } from "react";

type Props = {
  account: ReactNode;
  sharing: ReactNode;
  fees: ReactNode;
  importTools: ReactNode;
};

export function SettingsAccordion({ account, sharing, fees, importTools }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <section className="pb-4">
      <div className="overflow-hidden rounded-lg border border-ink/10 bg-white shadow-soft">
        <button
          className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left sm:px-5"
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-marine">
            <Settings2 className="h-4 w-4" aria-hidden />
            Settings and tools
          </span>
          <ChevronDown className={`h-5 w-5 text-ink/55 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
        </button>
        {open ? (
          <div className="space-y-4 border-t border-ink/10 px-4 py-4 sm:px-5">
            {account}
            {sharing}
            {fees}
            {importTools}
          </div>
        ) : null}
      </div>
    </section>
  );
}
