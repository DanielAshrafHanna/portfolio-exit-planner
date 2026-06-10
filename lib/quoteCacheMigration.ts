import type { EnrichedHolding, PortfolioProfile } from "./types";

/** Market quotes and news are runtime-only; never trust values restored from storage or cloud. */
export function stripEphemeralHoldingFields(holding: EnrichedHolding): EnrichedHolding {
  return { ...holding, quote: undefined, news: [] };
}

export function sanitizeProfilesForPersistence(profiles: PortfolioProfile[]): PortfolioProfile[] {
  return profiles.map((profile) => ({
    ...profile,
    holdings: profile.holdings.map(stripEphemeralHoldingFields)
  }));
}
