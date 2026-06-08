"use client";

export type HoldingsViewOption = {
  id: string;
  label: string;
  sublabel: string;
  holdingsCount: number;
  isMine?: boolean;
};

type Props = {
  options: HoldingsViewOption[];
  selectedId: string;
  onChange: (id: string) => void;
};

export function HoldingsViewSelector({ options, selectedId, onChange }: Props) {
  if (!options.length) return null;

  return (
    <div>
      <p className="mb-1 text-xs font-medium text-ink/70">Holdings view</p>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {options.map((option) => {
          const active = option.id === selectedId;
          return (
            <button
              className={`min-h-11 shrink-0 rounded-full border px-4 py-2 text-left text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marine ${
                active ? "border-marine bg-mint text-marine" : "border-ink/10 bg-white text-ink/70 hover:border-marine/35"
              }`}
              key={option.id}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(option.id)}
            >
              <span className="block font-semibold">{option.label}</span>
              <span className="block text-xs text-ink/55">
                {option.sublabel} - {option.holdingsCount} holding{option.holdingsCount === 1 ? "" : "s"}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
