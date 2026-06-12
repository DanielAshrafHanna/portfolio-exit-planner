import { DEFAULT_SETTINGS } from "./profileUtils";
import { coerceFeeSettings, coerceHoldings, coerceProfiles, migrateSinglePortfolio } from "./storageMigration";
import type { FeeSettings, PortfolioProfile } from "./types";

type CloudSettings = { activeProfileId?: string; displayName?: string; shareHoldings?: boolean } & Partial<FeeSettings>;

export type CloudPortfolioRow = {
  holdings: unknown;
  settings: unknown;
  display_name?: string | null;
  share_holdings?: boolean | null;
  updated_at?: string | null;
  user_id?: string | null;
};

export function cloudSettingsFromRow(row: CloudPortfolioRow): CloudSettings {
  return row.settings && typeof row.settings === "object" && !Array.isArray(row.settings)
    ? row.settings as CloudSettings
    : {};
}

export function profilesFromCloudPortfolioRow(row: CloudPortfolioRow): PortfolioProfile[] {
  const cloudSettings = cloudSettingsFromRow(row);
  const loadedProfiles = coerceProfiles(row.holdings, DEFAULT_SETTINGS);
  if (loadedProfiles.length) return loadedProfiles;

  return migrateSinglePortfolio(
    coerceHoldings(row.holdings),
    coerceFeeSettings(cloudSettings, DEFAULT_SETTINGS)
  );
}

export function activeProfileIdFromCloudPortfolioRow(row: CloudPortfolioRow, profiles: PortfolioProfile[]) {
  const cloudSettings = cloudSettingsFromRow(row);
  if (cloudSettings.activeProfileId && profiles.some((profile) => profile.id === cloudSettings.activeProfileId)) {
    return cloudSettings.activeProfileId;
  }
  return profiles[0]?.id || "us-portfolio";
}
