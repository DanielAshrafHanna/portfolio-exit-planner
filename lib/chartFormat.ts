import type { CurrencyCode } from "./types";
import { formatMoney, formatMoneyTable } from "./profileUtils";

export const CHART_MARGIN = { top: 8, right: 12, bottom: 4, left: 52 };

/** Shared visual theme so every report chart stays consistent (sourced from Tailwind brand tokens). */
export const CHART_THEME = {
  gain: "#145c72",
  loss: "#ff7a68",
  empty: "#d8ded5",
  grid: "#d8ded5",
  reference: "#17212b",
  axisTick: { fontSize: 10, fill: "#5b6b66" } as const,
  gridDash: "3 3",
  referenceDash: "4 4"
};

/** One height for every report chart card so the grid stays even and avoids layout shift. */
export const CHART_HEIGHT_CLASS = "h-64";

export function formatChartSignedAxis(value: number, currency: CurrencyCode) {
  const prefix = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${prefix}${formatMoneyTable(Math.abs(value), currency)}`;
}

export function formatChartSignedMoney(value: number, currency: CurrencyCode) {
  const prefix = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${prefix}${formatMoney(Math.abs(value), currency)}`;
}

export function plChartDomain(values: number[]): [number, number] {
  const finite = values.filter((value) => Number.isFinite(value));
  if (!finite.length) return [-1, 1];
  const max = Math.max(...finite, 0);
  const min = Math.min(...finite, 0);
  const padding = Math.max(Math.abs(max), Math.abs(min), 1) * 0.2;
  return [min - padding, max + padding];
}

/** Domain for absolute-value charts (portfolio value), floored at zero with light padding. */
export function valueChartDomain(values: number[]): [number, number] {
  const finite = values.filter((value) => Number.isFinite(value));
  if (!finite.length) return [0, 1];
  const min = Math.min(...finite);
  const max = Math.max(...finite);
  const span = Math.max(max - min, Math.abs(max) * 0.02, 1);
  return [Math.max(0, min - span * 0.1), max + span * 0.1];
}
