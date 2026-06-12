import { holdingDisplayName } from "./holdingNames";
import type { EnrichedHolding } from "./types";

export function holdingSearchHaystack(holding: EnrichedHolding) {
  return [
    holding.symbol,
    holding.name,
    holdingDisplayName(holding),
    holding.quote?.companyName
  ]
    .map((value) => value?.trim().toLowerCase())
    .filter(Boolean)
    .join(" ");
}

export function filterHoldingsBySearch(holdings: EnrichedHolding[], query: string) {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return holdings;
  const tokens = trimmed.split(/\s+/).filter(Boolean);
  return holdings.filter((holding) => {
    const haystack = holdingSearchHaystack(holding);
    return tokens.every((token) => haystack.includes(token));
  });
}
