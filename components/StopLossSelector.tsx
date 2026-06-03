"use client";

import type { StopStyle } from "@/lib/calculations";

type Props = {
  stops: Record<StopStyle, { price: number; explanation: string }>;
  selected: StopStyle;
  onChange: (style: StopStyle) => void;
};

export function StopLossSelector({ stops, selected, onChange }: Props) {
  const copy: Record<StopStyle, { title: string; subtitle: string; when: string }> = {
    tight: {
      title: "Protect Quickly",
      subtitle: "Smallest allowed drop",
      when: "Use when you want to protect gains quickly or you may sell soon."
    },
    balanced: {
      title: "Balanced",
      subtitle: "Recommended default",
      when: "Use when you want a middle option between protection and patience."
    },
    loose: {
      title: "Give More Room",
      subtitle: "Largest allowed drop",
      when: "Use when you are willing to wait through bigger price swings."
    }
  };

  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold">Choose your stop-loss style</h3>
        <p className="text-sm text-ink/65">A stop-loss is the price where you would consider exiting to limit downside. The app does not place trades.</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {(["tight", "balanced", "loose"] as StopStyle[]).map((style) => (
          <button
            className={`rounded-md border p-3 text-left text-sm ${selected === style ? "border-marine bg-mint" : "border-ink/10 bg-white"}`}
            key={style}
            onClick={() => onChange(style)}
            type="button"
          >
            <span className="block text-xs font-semibold uppercase text-marine">{copy[style].subtitle}</span>
            <span className="mt-1 block font-semibold">{copy[style].title}</span>
            <span className="block text-xl font-bold">${stops[style].price.toLocaleString()}</span>
            <span className="mt-1 block text-xs text-ink/70">{copy[style].when}</span>
            <span className="mt-2 block border-t border-ink/10 pt-2 text-xs text-ink/55">{stops[style].explanation}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
