"use client";

import { Eye, EyeOff, UsersRound } from "lucide-react";
import { useMemo } from "react";
import { calculateProfitLoss } from "@/lib/calculations";
import { formatMoney } from "@/lib/profileUtils";
import type { SharedPortfolioProfile } from "@/lib/types";

type Props = {
  entries: SharedPortfolioProfile[];
  selectedId: string;
  isLoading: boolean;
  shareHoldings: boolean;
  displayName: string;
  onSelectedIdChange: (id: string) => void;
  onShareHoldingsChange: (value: boolean) => void;
  onDisplayNameChange: (value: string) => void;
};

function regionLabel(region: string) {
  return region === "EG" ? "Egypt" : "US";
}

function updatedLabel(value?: string) {
  if (!value) return "";
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return "";
  return new Date(parsed).toLocaleDateString([], { month: "short", day: "numeric" });
}

export function SharedHoldingsViewer({
  entries,
  selectedId,
  isLoading,
  shareHoldings,
  displayName,
  onSelectedIdChange,
  onShareHoldingsChange,
  onDisplayNameChange
}: Props) {
  const selected = useMemo(() => entries.find((entry) => entry.id === selectedId) || entries[0], [entries, selectedId]);
  const holdings = selected?.profile.holdings || [];

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
              Select a shared user/profile to view their holdings. This is read-only and only shows portfolios where sharing is enabled.
            </p>
          </div>

          <div className="grid gap-3 rounded-md border border-ink/10 bg-paper p-3">
            <label className="text-xs font-semibold text-ink/65">
              Your friendly name
              <input
                className="mt-1 min-h-11 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-base sm:text-sm"
                maxLength={60}
                placeholder="Example: Daniel"
                value={displayName}
                onChange={(event) => onDisplayNameChange(event.target.value)}
              />
            </label>
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
          </div>
        </div>

        <div className="mt-4">
          <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
            {entries.map((entry) => {
              const active = entry.id === selected?.id;
              return (
                <button
                  className={`min-h-10 shrink-0 rounded-full border px-4 py-2 text-sm font-semibold ${active ? "border-marine bg-mint text-marine" : "border-ink/10 bg-white text-ink/70"}`}
                  key={entry.id}
                  type="button"
                  onClick={() => onSelectedIdChange(entry.id)}
                >
                  {entry.displayName} - {entry.profile.name} - {regionLabel(entry.profile.region)}
                  <span className="ml-2 text-xs font-normal text-ink/55">{entry.profile.holdings.length}</span>
                </button>
              );
            })}
          </div>

          {isLoading ? (
            <div className="grid gap-2 sm:grid-cols-3">
              {[0, 1, 2].map((item) => <div className="h-16 animate-pulse bg-paper" key={item} />)}
            </div>
          ) : null}

          {!isLoading && !entries.length ? (
            <div className="border border-dashed border-ink/15 bg-paper p-4 text-sm text-ink/60">
              No shared portfolios yet. Ask a signed-in user to enable sharing, or turn on your own sharing toggle.
            </div>
          ) : null}

          {selected ? (
            <div>
              <div className="mb-2 text-sm text-ink/65">
                Viewing <span className="font-semibold text-ink">{selected.displayName}</span> - {selected.profile.name} - {regionLabel(selected.profile.region)} - {selected.profile.currency}
              </div>
              <div className="table-scroll overflow-x-auto border-y border-ink/10">
                <table className="min-w-[900px] w-full text-left text-xs sm:text-sm">
                <thead className="bg-ink text-xs uppercase text-white">
                  <tr>
                    <th className="px-2 py-2">Symbol</th>
                    <th className="px-2 py-2">Company/ETF</th>
                    <th className="px-2 py-2">Shares</th>
                    <th className="px-2 py-2">Avg cost</th>
                    <th className="px-2 py-2">Total cost</th>
                    <th className="px-2 py-2">Current price</th>
                    <th className="px-2 py-2">Current P/L</th>
                    <th className="px-2 py-2">AI action</th>
                    <th className="px-2 py-2">Risk</th>
                    <th className="px-2 py-2">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {holdings.map((holding) => {
                    const current = holding.quote ? calculateProfitLoss(holding.shares, holding.averageCost, holding.quote.currentPrice, selected.profile.settings) : undefined;
                    return (
                      <tr className="border-t border-ink/10" key={holding.id}>
                        <td className="px-2 py-2 font-bold">{holding.symbol}</td>
                        <td className="px-2 py-2"><span className="block max-w-48 truncate">{holding.name || "N/A"}</span></td>
                        <td className="px-2 py-2">{holding.shares}</td>
                        <td className="px-2 py-2">{formatMoney(holding.averageCost, selected.profile.currency)}</td>
                        <td className="px-2 py-2">{formatMoney(holding.totalCost, selected.profile.currency)}</td>
                        <td className="bg-marine/5 px-2 py-2 font-semibold text-marine">{holding.quote ? formatMoney(holding.quote.currentPrice, selected.profile.currency) : "N/A"}</td>
                        <td className={`px-2 py-2 font-semibold ${current && current.profitLoss < 0 ? "text-coral" : "text-marine"}`}>{current ? `${formatMoney(current.profitLoss, selected.profile.currency)} (${current.profitLossPercent}%)` : "N/A"}</td>
                        <td className="px-2 py-2">{holding.analysis?.action || "N/A"}</td>
                        <td className="px-2 py-2">{holding.analysis?.riskLevel || "N/A"}</td>
                        <td className="px-2 py-2 text-ink/55">{updatedLabel(selected.updatedAt)}</td>
                      </tr>
                    );
                  })}
                  {!holdings.length ? (
                    <tr>
                      <td className="px-2 py-4 text-ink/55" colSpan={10}>This shared profile has no holdings yet.</td>
                    </tr>
                  ) : null}
                </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
