import type { EnrichedHolding } from "./types";

export function filterHoldingsBySearch(holdings: EnrichedHolding[], query: string) {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return holdings;
  return holdings.filter((holding) => {
    const symbol = holding.symbol.trim().toLowerCase();
    const name = holding.name.trim().toLowerCase();
    return symbol.includes(trimmed) || name.includes(trimmed);
  });
}
