"use client";

import { ChevronDown, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import type { PortfolioProfile } from "@/lib/types";
import type { HoldingsViewOption } from "./HoldingsViewSelector";

type Props = {
  profiles: PortfolioProfile[];
  activeProfileId: string;
  onActiveChange: (id: string) => void;
  onAdd: () => void;
  onDelete: (id: string) => void;
  onUpdate: (profile: PortfolioProfile) => void;
  holdingsViewOptions: HoldingsViewOption[];
  selectedViewId: string;
  onViewChange: (id: string) => void;
};

export function MobileContextBar({
  profiles,
  activeProfileId,
  onActiveChange,
  onAdd,
  onDelete,
  onUpdate,
  holdingsViewOptions,
  selectedViewId,
  onViewChange
}: Props) {
  const [manageOpen, setManageOpen] = useState(false);
  const activeProfile = profiles.find((profile) => profile.id === activeProfileId) || profiles[0];
  if (!activeProfile) return null;

  return (
    <div className="space-y-2 md:hidden">
      <div>
        <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-ink/55">Profile</p>
        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
          {profiles.map((profile) => {
            const active = profile.id === activeProfile.id;
            return (
              <button
                className={`min-h-9 shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold ${active ? "border-marine bg-mint text-marine" : "border-ink/10 bg-white text-ink/70"}`}
                key={profile.id}
                type="button"
                onClick={() => onActiveChange(profile.id)}
              >
                {profile.name}
                <span className="ml-1 font-normal text-ink/55">{profile.region === "EG" ? "EG" : "US"}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-ink/55">View</p>
        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
          {holdingsViewOptions.map((option) => {
            const active = option.id === selectedViewId;
            return (
              <button
                className={`min-h-9 shrink-0 rounded-full border px-3 py-1.5 text-left text-xs font-semibold ${active ? "border-marine bg-mint text-marine" : "border-ink/10 bg-white text-ink/70"}`}
                key={option.id}
                type="button"
                aria-pressed={active}
                onClick={() => onViewChange(option.id)}
              >
                {option.label}
                <span className="ml-1 font-normal text-ink/55">{option.holdingsCount}</span>
              </button>
            );
          })}
        </div>
      </div>
      <button
        className="flex min-h-11 w-full items-center justify-between rounded-md border border-ink/10 bg-paper px-3 py-2 text-xs font-semibold text-ink/70"
        type="button"
        aria-expanded={manageOpen}
        onClick={() => setManageOpen((value) => !value)}
      >
        Manage profiles
        <ChevronDown className={`h-4 w-4 transition-transform ${manageOpen ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {manageOpen ? (
        <div className="space-y-3 rounded-md border border-ink/10 bg-paper p-3">
          <label className="block text-xs font-medium text-ink/70">
            Profile name
            <input
              className="mt-1 min-h-11 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-base"
              value={activeProfile.name}
              onChange={(event) => onUpdate({ ...activeProfile, name: event.target.value })}
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-md border border-ink/15 text-xs font-semibold" type="button" onClick={onAdd}>
              <Plus className="h-4 w-4" aria-hidden /> New
            </button>
            <button className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-md border border-coral text-xs font-semibold text-coral disabled:opacity-50" type="button" disabled={profiles.length <= 1} onClick={() => onDelete(activeProfile.id)}>
              <Trash2 className="h-4 w-4" aria-hidden /> Delete
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
