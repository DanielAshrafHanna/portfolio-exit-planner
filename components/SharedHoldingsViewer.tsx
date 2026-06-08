"use client";

import { Eye, EyeOff, UsersRound } from "lucide-react";

type Props = {
  isLoading: boolean;
  shareHoldings: boolean;
  syncHint?: string;
  onShareHoldingsChange: (value: boolean) => void;
};

export function SharedHoldingsViewer({
  isLoading,
  shareHoldings,
  syncHint,
  onShareHoldingsChange
}: Props) {
  return (
    <div className="rounded-md border border-ink/10 bg-surface-muted p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-marine">
        <UsersRound className="h-4 w-4" aria-hidden />
        Shared holdings
      </div>
      <p className="text-sm text-ink/65">
        Let signed-in friends view your US and Egypt profiles as read-only portfolios.
      </p>
      <label className="mt-3 flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-md border border-ink/10 bg-white px-3 py-2 text-sm font-semibold">
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
      {syncHint ? <p className="mt-2 text-xs text-marine">{syncHint}</p> : null}
      <p className={`mt-2 min-h-4 text-xs text-ink/55 ${isLoading ? "" : "invisible"}`} aria-hidden={!isLoading}>
        Refreshing shared profile list...
      </p>
    </div>
  );
}
