"use client";

import { Plus, Trash2, UserRoundCog } from "lucide-react";
import type { MarketRegion, PortfolioProfile } from "@/lib/types";

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

  const updateRegion = (region: MarketRegion) => {
    onUpdate({
      ...activeProfile,
      region,
      currency: region === "EG" ? "EGP" : "USD"
    });
  };

  return (
    <section className="border-b border-ink/10 bg-white px-4 py-4">
      <div className="mx-auto grid max-w-7xl gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-marine">
            <UserRoundCog className="h-4 w-4" aria-hidden />
            Portfolio profile
          </div>
          <div className="grid gap-3 md:grid-cols-[minmax(180px,260px)_minmax(180px,1fr)_180px]">
            <label className="text-xs font-medium text-ink/70">
              Active profile
              <select className="mt-1 w-full rounded-md border border-ink/15 px-3 py-2 text-sm" value={activeProfile.id} onChange={(event) => onActiveChange(event.target.value)}>
                {profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>{profile.name}</option>
                ))}
              </select>
            </label>
            <label className="text-xs font-medium text-ink/70">
              Profile name
              <input className="mt-1 w-full rounded-md border border-ink/15 px-3 py-2 text-sm" value={activeProfile.name} onChange={(event) => onUpdate({ ...activeProfile, name: event.target.value })} />
            </label>
            <label className="text-xs font-medium text-ink/70">
              Market
              <select className="mt-1 w-full rounded-md border border-ink/15 px-3 py-2 text-sm" value={activeProfile.region} onChange={(event) => updateRegion(event.target.value as MarketRegion)}>
                <option value="US">US market</option>
                <option value="EG">Egypt market</option>
              </select>
            </label>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="inline-flex items-center justify-center gap-2 rounded-md border border-ink/15 px-3 py-2 text-sm font-semibold" type="button" onClick={onAdd}>
            <Plus className="h-4 w-4" aria-hidden />
            New profile
          </button>
          <button className="inline-flex items-center justify-center gap-2 rounded-md border border-coral px-3 py-2 text-sm font-semibold text-coral disabled:opacity-50" type="button" disabled={profiles.length <= 1} onClick={() => onDelete(activeProfile.id)}>
            <Trash2 className="h-4 w-4" aria-hidden />
            Delete profile
          </button>
        </div>
      </div>
    </section>
  );
}
