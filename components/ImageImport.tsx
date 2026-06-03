"use client";

import { ImageUp, Wand2 } from "lucide-react";
import { useState } from "react";
import type { HoldingInput } from "@/lib/types";
import { totalCostFor } from "@/lib/calculations";

type Props = {
  onExtracted: (holdings: HoldingInput[]) => void;
  setWarning: (warning: string) => void;
};

export function ImageImport({ onExtracted, setWarning }: Props) {
  const [isExtracting, setIsExtracting] = useState(false);

  const extract = async (file?: File) => {
    if (!file) return;
    const form = new FormData();
    form.append("image", file);
    setIsExtracting(true);
    setWarning("Sending screenshot to external AI/OCR because you clicked Extract from image.");
    try {
      const response = await fetch("/api/extractImage", { method: "POST", body: form });
      const data = await response.json();
      if (data.warning) setWarning(data.warning);
      if (Array.isArray(data.warnings)) data.warnings.forEach((warning: string) => setWarning(warning));
      const rows = (data.rows || []).map((row: any) => {
        const shares = Number(row.shares || 0);
        const averageCost = Number(row.averageCost || 0);
        return {
          id: crypto.randomUUID(),
          symbol: String(row.symbol || "").toUpperCase(),
          name: String(row.name || ""),
          shares,
          averageCost,
          totalCost: Number(row.totalCost || totalCostFor(shares, averageCost)),
          brokerCurrentValue: row.brokerCurrentValue ? Number(row.brokerCurrentValue) : undefined,
          notes: String(row.notes || "Extracted from image; confirm fields before analysis.")
        };
      });
      if (rows.length) onExtracted(rows);
      else setWarning("No holdings were extracted. Try a sharper full-screen screenshot, or import CSV/manual rows.");
    } finally {
      setIsExtracting(false);
    }
  };

  return (
    <section className="mx-auto max-w-7xl px-4 pt-6">
      <div className="grid gap-3 border border-dashed border-marine/35 bg-white p-4 md:grid-cols-[1fr_auto] md:items-center">
        <div className="flex gap-3">
          <ImageUp className="mt-1 h-5 w-5 shrink-0 text-marine" aria-hidden />
          <div>
            <h2 className="font-semibold">Image upload</h2>
            <p className="text-sm text-ink/65">Choose a portfolio screenshot, then explicitly click extraction through the file picker. Extracted rows remain editable before analysis.</p>
          </div>
        </div>
        <label className={`inline-flex items-center justify-center gap-2 rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white ${isExtracting ? "cursor-wait opacity-70" : "cursor-pointer"}`}>
          <Wand2 className="h-4 w-4" aria-hidden /> {isExtracting ? "Extracting..." : "Extract from image"}
          <input className="sr-only" type="file" accept="image/*" disabled={isExtracting} onChange={(event) => extract(event.target.files?.[0])} />
        </label>
      </div>
    </section>
  );
}
