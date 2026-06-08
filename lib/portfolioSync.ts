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

/** Prevent one device's empty US/Egypt profile from wiping another profile's cloud holdings on save. */
export function mergeProfilesForCloudSave(
  local: PortfolioProfile[],
  cloud: PortfolioProfile[],
  editedProfileIds: ReadonlySet<string>
): PortfolioProfile[] {
  const cloudById = new Map(cloud.map((profile) => [profile.id, profile]));
  const localIds = new Set(local.map((profile) => profile.id));
  const merged = local.map((localProfile) => {
    const cloudProfile = cloudById.get(localProfile.id);
    const preserveCloudHoldings = Boolean(
      cloudProfile
      && profileHoldingCount(localProfile) === 0
      && profileHoldingCount(cloudProfile) > 0
      && !editedProfileIds.has(localProfile.id)
    );
    return preserveCloudHoldings
      ? { ...localProfile, holdings: cloudProfile!.holdings }
      : localProfile;
  });

  cloud.forEach((cloudProfile) => {
    if (!localIds.has(cloudProfile.id)) merged.push(cloudProfile);
  });

  return merged;
}
