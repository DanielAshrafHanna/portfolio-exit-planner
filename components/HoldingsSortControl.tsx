"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import {
  HOLDING_SORT_OPTIONS,
  type HoldingSortKey,
  type SortDirection
} from "@/lib/holdingSort";

type Props = {
  sortKey: HoldingSortKey;
  sortDirection: SortDirection;
  onSortKeyChange: (key: HoldingSortKey) => void;
  onSortDirectionToggle: () => void;
  variant: "mobile" | "desktop";
};

function DirectionIcon({ direction, active }: { direction: SortDirection; active: boolean }) {
  if (!active) return <ArrowUpDown className="h-3.5 w-3.5 opacity-45" aria-hidden />;
  return direction === "asc"
    ? <ArrowUp className="h-3.5 w-3.5" aria-hidden />
    : <ArrowDown className="h-3.5 w-3.5" aria-hidden />;
}

export function HoldingsSortControl({
  sortKey,
  sortDirection,
  onSortKeyChange,
  onSortDirectionToggle,
  variant
}: Props) {
  const options = HOLDING_SORT_OPTIONS.filter((option) => (variant === "mobile" ? option.mobile : option.desktop));
  const activeLabel = options.find((option) => option.key === sortKey)?.label || "Symbol";

  return (
    <div className={`flex items-center gap-2 ${variant === "mobile" ? "justify-end" : ""}`}>
      <label className={`flex items-center gap-2 text-xs text-ink/65 ${variant === "desktop" ? "sr-only" : ""}`}>
        <span className={variant === "mobile" ? "" : "sr-only"}>Sort by</span>
        <select
          className="min-h-9 rounded-md border border-ink/15 bg-white px-2 py-1.5 text-sm text-ink"
          value={sortKey}
          aria-label="Sort holdings by"
          onChange={(event) => onSortKeyChange(event.target.value as HoldingSortKey)}
        >
          {options.map((option) => (
            <option key={option.key} value={option.key}>{option.label}</option>
          ))}
        </select>
      </label>
      <button
        className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-md border border-ink/15 bg-white text-ink/70"
        type="button"
        aria-label={`Sort ${activeLabel} ${sortDirection === "asc" ? "ascending" : "descending"}`}
        onClick={onSortDirectionToggle}
      >
        <DirectionIcon direction={sortDirection} active />
      </button>
    </div>
  );
}

type SortHeaderProps = {
  label: string;
  sortKey: HoldingSortKey;
  activeKey: HoldingSortKey;
  direction: SortDirection;
  onSort: (key: HoldingSortKey) => void;
  className?: string;
};

export function HoldingsSortHeader({
  label,
  sortKey,
  activeKey,
  direction,
  onSort,
  className = ""
}: SortHeaderProps) {
  const active = activeKey === sortKey;
  return (
    <th className={className}>
      <button
        className="group inline-flex w-full min-w-0 items-center gap-1 text-left font-inherit uppercase tracking-wide text-white hover:text-white/85"
        type="button"
        aria-label={`Sort by ${label}`}
        onClick={() => onSort(sortKey)}
      >
        <span className="min-w-0 truncate">{label}</span>
        <span
          className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-sm ${active ? "bg-white/15" : "bg-transparent"}`}
          aria-hidden
        >
          <DirectionIcon direction={direction} active={active} />
        </span>
      </button>
    </th>
  );
}

export function HoldingsMobileHeader({ label, className = "" }: { label: string; className?: string }) {
  return (
    <th className={`text-[10px] font-semibold uppercase tracking-wide text-white/95 ${className}`}>
      {label}
    </th>
  );
}
