import type { PortfolioProfile } from "./types";

export function portfolioHoldingSymbols(profiles: PortfolioProfile[]) {
  return profiles.flatMap((profile) => (
    profile.holdings.map((holding) => holding.symbol.trim().toUpperCase()).filter(Boolean)
  ));
}

export function shouldPreferLocalPortfolio(
  local: PortfolioProfile[],
  cloud: PortfolioProfile[],
  options: {
    localIsNewer: boolean;
    userEditedDuringLoad: boolean;
    localHasUnsavedHoldings: boolean;
  }
): boolean {
  const localHasHoldings = portfolioHoldingSymbols(local).length > 0;
  const cloudHasHoldings = portfolioHoldingSymbols(cloud).length > 0;

  if (options.localHasUnsavedHoldings) return true;
  if (options.userEditedDuringLoad) return true;
  if (cloudHasHoldings && !localHasHoldings) return false;
  if (options.localIsNewer && localHasHoldings) return true;
  return false;
}
