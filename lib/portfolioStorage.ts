import { sanitizeProfilesForPersistence } from "./quoteCacheMigration";
import { defaultProfiles } from "./profileUtils";
import { emptyPortfolioBootstrap, loadPortfolioState } from "./storageMigration";
import type { PortfolioProfile } from "./types";

export const LEGACY_PROFILES_KEY = "portfolio-exit-planner:profiles:v1";
export const LEGACY_STORAGE_KEY = "portfolio-exit-planner:v1";
export const LEGACY_SETTINGS_KEY = "portfolio-exit-planner:settings:v1";
export const LEGACY_ACTIVE_PROFILE_KEY = "portfolio-exit-planner:active-profile:v1";
export const LEGACY_LOCAL_UPDATED_AT_KEY = "portfolio-exit-planner:local-updated-at:v1";

export type PortfolioCacheSnapshot = {
  profiles: PortfolioProfile[];
  activeProfileId: string;
  cloudUpdatedAt: string | null;
};

export function portfolioCacheKeys(userId: string | "guest") {
  const suffix = userId === "guest" ? "guest" : `user:${userId}`;
  return {
    profiles: `portfolio-exit-planner:profiles:v2:${suffix}`,
    activeProfile: `portfolio-exit-planner:active-profile:v2:${suffix}`,
    cloudUpdatedAt: `portfolio-exit-planner:cloud-updated-at:v2:${suffix}`
  };
}

function readLegacyGuestPortfolio(): PortfolioCacheSnapshot {
  const restored = loadPortfolioState({
    storedProfiles: safeGetItem(LEGACY_PROFILES_KEY),
    storedHoldings: safeGetItem(LEGACY_STORAGE_KEY),
    storedSettings: safeGetItem(LEGACY_SETTINGS_KEY),
    storedActiveProfileId: safeGetItem(LEGACY_ACTIVE_PROFILE_KEY)
  });
  return {
    profiles: sanitizeProfilesForPersistence(restored.profiles),
    activeProfileId: restored.activeProfileId,
    cloudUpdatedAt: safeGetItem(LEGACY_LOCAL_UPDATED_AT_KEY)
  };
}

export function readPortfolioCache(userId: string | "guest"): PortfolioCacheSnapshot | null {
  const keys = portfolioCacheKeys(userId);
  const storedProfiles = safeGetItem(keys.profiles);
  const storedActiveProfileId = safeGetItem(keys.activeProfile);
  if (!storedProfiles) {
    if (userId !== "guest") return null;
    const legacy = readLegacyGuestPortfolio();
    const hasLegacyData = Boolean(
      safeGetItem(LEGACY_PROFILES_KEY)
      || safeGetItem(LEGACY_STORAGE_KEY)
    );
    return hasLegacyData ? legacy : null;
  }

  try {
    const profiles = JSON.parse(storedProfiles) as PortfolioProfile[];
    if (!Array.isArray(profiles) || !profiles.length) return null;
    const activeProfileId = storedActiveProfileId && profiles.some((profile) => profile.id === storedActiveProfileId)
      ? storedActiveProfileId
      : profiles[0].id;
    return {
      profiles: sanitizeProfilesForPersistence(profiles),
      activeProfileId,
      cloudUpdatedAt: safeGetItem(keys.cloudUpdatedAt)
    };
  } catch {
    return null;
  }
}

export function writePortfolioCache(userId: string | "guest", snapshot: PortfolioCacheSnapshot) {
  const keys = portfolioCacheKeys(userId);
  safeSetItem(keys.profiles, JSON.stringify(snapshot.profiles));
  safeSetItem(keys.activeProfile, snapshot.activeProfileId);
  if (snapshot.cloudUpdatedAt) safeSetItem(keys.cloudUpdatedAt, snapshot.cloudUpdatedAt);
  else safeRemoveItem(keys.cloudUpdatedAt);
}

export function clearPortfolioCache(userId: string | "guest") {
  const keys = portfolioCacheKeys(userId);
  safeRemoveItem(keys.profiles);
  safeRemoveItem(keys.activeProfile);
  safeRemoveItem(keys.cloudUpdatedAt);
}

export function clearLegacyPortfolioKeys() {
  safeRemoveItem(LEGACY_PROFILES_KEY);
  safeRemoveItem(LEGACY_STORAGE_KEY);
  safeRemoveItem(LEGACY_SETTINGS_KEY);
  safeRemoveItem(LEGACY_ACTIVE_PROFILE_KEY);
  safeRemoveItem(LEGACY_LOCAL_UPDATED_AT_KEY);
}

export function readGuestPortfolioState(): PortfolioCacheSnapshot {
  const cached = readPortfolioCache("guest");
  if (cached) return cached;
  const bootstrap = emptyPortfolioBootstrap();
  return {
    profiles: bootstrap.profiles,
    activeProfileId: bootstrap.activeProfileId,
    cloudUpdatedAt: null
  };
}

export function defaultPortfolioSnapshot(): PortfolioCacheSnapshot {
  const bootstrap = emptyPortfolioBootstrap();
  return {
    profiles: bootstrap.profiles,
    activeProfileId: bootstrap.activeProfileId,
    cloudUpdatedAt: null
  };
}

function safeGetItem(key: string) {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(key);
}

function safeSetItem(key: string, value: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, value);
}

function safeRemoveItem(key: string) {
  if (typeof window === "undefined") return;
  localStorage.removeItem(key);
}

export function portfolioSnapshotFromProfiles(profiles: PortfolioProfile[], activeProfileId: string, cloudUpdatedAt?: string | null): PortfolioCacheSnapshot {
  const resolvedActiveProfileId = profiles.some((profile) => profile.id === activeProfileId)
    ? activeProfileId
    : profiles[0]?.id || defaultProfiles()[0].id;
  return {
    profiles: sanitizeProfilesForPersistence(profiles),
    activeProfileId: resolvedActiveProfileId,
    cloudUpdatedAt: cloudUpdatedAt ?? null
  };
}
