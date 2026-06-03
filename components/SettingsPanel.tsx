"use client";

import { SlidersHorizontal, Trash2 } from "lucide-react";
import type { FeeSettings } from "@/lib/types";

type Props = {
  settings: FeeSettings;
  onChange: (settings: FeeSettings) => void;
  onClear: () => void;
};

export function SettingsPanel({ settings, onChange, onClear }: Props) {
  const update = (key: keyof FeeSettings, value: string) => {
    onChange({ ...settings, [key]: Number(value) || 0 });
  };

  return (
    <section className="border-b border-ink/10 bg-white px-4 py-4">
      <div className="mx-auto grid max-w-7xl gap-3 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-marine">
            <SlidersHorizontal className="h-4 w-4" aria-hidden />
            Fees and privacy
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-xs font-medium text-ink/70">
              Fixed trading fee
              <input className="mt-1 w-full rounded-md border border-ink/15 px-3 py-2 text-sm" type="number" min="0" step="0.01" value={settings.fixedTradingFee} onChange={(event) => update("fixedTradingFee", event.target.value)} />
            </label>
            <label className="text-xs font-medium text-ink/70">
              Trading fee %
              <input className="mt-1 w-full rounded-md border border-ink/15 px-3 py-2 text-sm" type="number" min="0" step="0.01" value={settings.percentTradingFee} onChange={(event) => update("percentTradingFee", event.target.value)} />
            </label>
            <label className="text-xs font-medium text-ink/70">
              FX fee %
              <input className="mt-1 w-full rounded-md border border-ink/15 px-3 py-2 text-sm" type="number" min="0" step="0.01" value={settings.fxFeePercent} onChange={(event) => update("fxFeePercent", event.target.value)} />
            </label>
          </div>
        </div>
        <button className="inline-flex items-center justify-center gap-2 rounded-md border border-coral px-4 py-2 text-sm font-semibold text-coral hover:bg-coral hover:text-white" onClick={onClear} type="button">
          <Trash2 className="h-4 w-4" aria-hidden />
          Clear stored portfolio
        </button>
      </div>
    </section>
  );
}
