"use client";

import type { PortfolioProfile } from "@/lib/types";
import type { HoldingsViewOption } from "./HoldingsViewSelector";

type Props = {
  profiles: PortfolioProfile[];
  activeProfileId: string;
  onActiveChange: (id: string) => void;
  holdingsViewOptions: HoldingsViewOption[];
  selectedViewId: string;
  onViewChange: (id: string) => void;
};

export function MobileContextBar({
  profiles,
  activeProfileId,
  onActiveChange,
  holdingsViewOptions,
  selectedViewId,
  onViewChange
}: Props) {
  const activeProfile = profiles.find((profile) => profile.id === activeProfileId) || profiles[0];
  if (!activeProfile) return null;

  return (
    <div className="flex gap-1.5 overflow-x-auto pb-0.5 md:hidden">
      {profiles.map((profile) => {
        const active = profile.id === activeProfile.id;
        return (
          <button
            className={`min-h-8 shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${active ? "border-marine bg-mint text-marine" : "border-ink/10 bg-white text-ink/70"}`}
            key={profile.id}
            type="button"
            onClick={() => onActiveChange(profile.id)}
          >
            {profile.region === "EG" ? "EG" : "US"}
          </button>
        );
      })}
      <span className="mx-0.5 w-px shrink-0 self-stretch bg-ink/15" aria-hidden />
      {holdingsViewOptions.map((option) => {
        const active = option.id === selectedViewId;
        return (
          <button
            className={`min-h-8 shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${active ? "border-marine bg-mint text-marine" : "border-ink/10 bg-white text-ink/70"}`}
            key={option.id}
            type="button"
            aria-pressed={active}
            onClick={() => onViewChange(option.id)}
          >
            {option.isMine ? "Mine" : option.label.split(" ")[0]}
            <span className="ml-1 font-normal text-ink/50">{option.holdingsCount}</span>
          </button>
        );
      })}
    </div>
  );
}
