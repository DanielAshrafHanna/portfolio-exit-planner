"use client";

import { Plus, Trash2, UserRoundCog } from "lucide-react";
import type { PortfolioProfile } from "@/lib/types";

type Props = {
  profiles: PortfolioProfile[];
  activeProfileId: string;
  onActiveChange: (id: string) => void;
  onAdd: () => void;
  onDelete: (id: string) => void;
  onUpdate: (profile: PortfolioProfile) => void;
};

export function ProfileSelector({ profiles, activeProfileId, onActiveChange, onAdd, onDelete, onUpdate }: Props) {
  const activeProfile = profiles.find((profile) => profile.id === activeProfileId) || profiles[0];
  if (!activeProfile) return null;

  return (
    <section className="mx-auto max-w-7xl px-4 pb-4">
      <div className="grid gap-3 border border-ink/10 bg-white p-4 shadow-soft lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-marine">
            <UserRoundCog className="h-4 w-4" aria-hidden />
            Portfolio profile
          </div>
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(220px,360px)]">
            <div>
              <p className="mb-1 text-xs font-medium text-ink/70">Active profile</p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {profiles.map((profile) => {
                  const active = profile.id === activeProfile.id;
                  return (
                    <button
                      className={`min-h-11 shrink-0 rounded-full border px-4 py-2 text-sm font-semibold ${active ? "border-marine bg-mint text-marine" : "border-ink/10 bg-white text-ink/70"}`}
                      key={profile.id}
                      type="button"
                      onClick={() => onActiveChange(profile.id)}
                    >
                      {profile.name}
                      <span className="ml-2 text-xs font-normal text-ink/55">{profile.region === "EG" ? "Egypt" : "US"}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <label className="text-xs font-medium text-ink/70">
              Profile name
              <input className="mt-1 min-h-11 w-full rounded-md border border-ink/15 px-3 py-2 text-base sm:text-sm" value={activeProfile.name} onChange={(event) => onUpdate({ ...activeProfile, name: event.target.value })} />
            </label>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-ink/15 px-3 py-2 text-sm font-semibold" type="button" onClick={onAdd}>
            <Plus className="h-4 w-4" aria-hidden />
            New profile
          </button>
          <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-coral px-3 py-2 text-sm font-semibold text-coral disabled:opacity-50" type="button" disabled={profiles.length <= 1} onClick={() => onDelete(activeProfile.id)}>
            <Trash2 className="h-4 w-4" aria-hidden />
            Delete profile
          </button>
        </div>
      </div>
    </section>
  );
}
