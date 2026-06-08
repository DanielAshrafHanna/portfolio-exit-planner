import type { PortfolioProfile } from "./types";

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
