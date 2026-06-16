import type { PortfolioCacheSnapshot } from "./portfolioStorage";
import type { PortfolioProfile } from "./types";

export function profileHoldingCount(profile: PortfolioProfile) {
  return profile.holdings.filter((holding) => holding.symbol.trim()).length;
}

export function portfolioHoldingSymbols(profiles: PortfolioProfile[]) {
  return profiles.flatMap((profile) => (
    profile.holdings.map((holding) => holding.symbol.trim().toUpperCase()).filter(Boolean)
  ));
}

export function portfolioHasUnsavedSymbols(local: PortfolioProfile[], cloud: PortfolioProfile[]) {
  const cloudSymbolSet = new Set(portfolioHoldingSymbols(cloud));
  return portfolioHoldingSymbols(local).some((symbol) => !cloudSymbolSet.has(symbol));
}

/** Keep local edits only during the active signed-in session before cloud catches up. */
export function shouldKeepSessionPortfolioEdits(
  local: PortfolioProfile[],
  cloud: PortfolioProfile[],
  sessionPortfolioEdited: boolean
) {
  if (!sessionPortfolioEdited) return false;
  return portfolioHasUnsavedSymbols(local, cloud) || portfolioHoldingSymbols(local).length > 0;
}

export function shouldSkipEmptyCloudOverwrite(
  local: PortfolioProfile[],
  cloudHoldingCount: number,
  sessionPortfolioEdited: boolean
) {
  return cloudHoldingCount > 0
    && portfolioHoldingSymbols(local).length === 0
    && !sessionPortfolioEdited;
}

export function shouldPreferLocalPortfolioCache(
  local: PortfolioCacheSnapshot,
  cloudProfiles: PortfolioProfile[],
  cloudUpdatedAt?: string | null
) {
  if (portfolioHasUnsavedSymbols(local.profiles, cloudProfiles)) return true;
  if (!local.localUpdatedAt) return false;
  if (!cloudUpdatedAt) return portfolioHoldingSymbols(local.profiles).length > 0;
  return new Date(local.localUpdatedAt) > new Date(cloudUpdatedAt);
}

function holdingSymbolKey(holding: PortfolioProfile["holdings"][number]) {
  return holding.symbol.trim().toUpperCase();
}

/**
 * Union holdings by symbol. `primary` takes precedence for shared symbols;
 * `secondary` contributes only symbols that `primary` does not already have.
 */
function unionHoldingsBySymbol(
  primary: PortfolioProfile["holdings"],
  secondary: PortfolioProfile["holdings"]
): PortfolioProfile["holdings"] {
  const seen = new Set(primary.map(holdingSymbolKey).filter(Boolean));
  const extras = secondary.filter((holding) => {
    const key = holdingSymbolKey(holding);
    return Boolean(key) && !seen.has(key);
  });
  return [...primary, ...extras];
}

/**
 * Prevent a stale device from clobbering newer cloud holdings on save.
 *
 * - A profile the user actually edited this session is authoritative locally,
 *   so intentional adds/edits/deletes on this device are honored.
 * - A profile that was NOT touched this session must never overwrite the cloud
 *   with stale local data. Cloud holdings win for shared symbols, and any
 *   local-only symbols (genuine unsynced additions) are preserved via union.
 */
export function mergeProfilesForCloudSave(
  local: PortfolioProfile[],
  cloud: PortfolioProfile[],
  editedHoldingsProfileIds: ReadonlySet<string>
): PortfolioProfile[] {
  const cloudById = new Map(cloud.map((profile) => [profile.id, profile]));
  const localIds = new Set(local.map((profile) => profile.id));
  const merged = local.map((localProfile) => {
    const cloudProfile = cloudById.get(localProfile.id);
    if (!cloudProfile) return localProfile;
    if (editedHoldingsProfileIds.has(localProfile.id)) return localProfile;
    return {
      ...cloudProfile,
      holdings: unionHoldingsBySymbol(cloudProfile.holdings, localProfile.holdings)
    };
  });

  cloud.forEach((cloudProfile) => {
    if (!localIds.has(cloudProfile.id)) merged.push(cloudProfile);
  });

  return merged;
}
