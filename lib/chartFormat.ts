import type { CurrencyCode } from "./types";
import { formatMoney, formatMoneyTable } from "./profileUtils";

export const CHART_MARGIN = { top: 8, right: 12, bottom: 4, left: 52 };

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
