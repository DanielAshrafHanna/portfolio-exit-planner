"use client";

import { Eye, EyeOff, UsersRound } from "lucide-react";

type Props = {
  isLoading: boolean;
  shareHoldings: boolean;
  onShareHoldingsChange: (value: boolean) => void;
};

export function SharedHoldingsViewer({
  isLoading,
  shareHoldings,
  onShareHoldingsChange
}: Props) {
  return (
    <section className="mx-auto max-w-7xl px-4 pb-6">
      <div className="border border-ink/10 bg-white p-4 shadow-soft">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
          <div className="min-w-0">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-marine">
              <UsersRound className="h-4 w-4" aria-hidden />
              Shared holdings
            </div>
            <h2 className="text-lg font-semibold">Friends portfolio view</h2>
            <p className="mt-1 text-sm text-ink/65">
              Decide whether signed-in friends can view your US and Egyptian portfolio profiles. Shared profiles appear as read-only choices above the holdings table.
            </p>
          </div>

          <div className="grid gap-3 rounded-md border border-ink/10 bg-paper p-3">
            <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-md border border-ink/10 bg-white px-3 py-2 text-sm font-semibold">
              <span className="inline-flex items-center gap-2">
                {shareHoldings ? <Eye className="h-4 w-4 text-marine" aria-hidden /> : <EyeOff className="h-4 w-4 text-ink/45" aria-hidden />}
                Share my holdings
              </span>
              <input
                className="h-5 w-5 accent-marine"
                type="checkbox"
                checked={shareHoldings}
                onChange={(event) => onShareHoldingsChange(event.target.checked)}
              />
            </label>
            <p className="text-xs text-ink/55">
              When enabled, signed-in users can see your US and Egypt profiles by this friendly name. Your email is not shown here.
            </p>
            <p className={`min-h-4 text-xs text-ink/55 ${isLoading ? "" : "invisible"}`} aria-hidden={!isLoading}>
              Refreshing shared profile list...
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
