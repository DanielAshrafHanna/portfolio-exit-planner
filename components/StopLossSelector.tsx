"use client";

import type { StopStyle } from "@/lib/calculations";

type Props = {
  stops: Record<StopStyle, { price: number; explanation: string }>;
  selected: StopStyle;
  onChange: (style: StopStyle) => void;
};

export function StopLossSelector({ stops, selected, onChange }: Props) {
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {(["tight", "balanced", "loose"] as StopStyle[]).map((style) => (
        <button
          className={`rounded-md border p-3 text-left text-sm ${selected === style ? "border-marine bg-mint" : "border-ink/10 bg-white"}`}
          key={style}
          onClick={() => onChange(style)}
          type="button"
        >
          <span className="block font-semibold capitalize">{style} stop</span>
          <span className="block text-lg font-bold">${stops[style].price.toLocaleString()}</span>
          <span className="block text-xs text-ink/65">{stops[style].explanation}</span>
        </button>
      ))}
    </div>
  );
}
