export const USER_PREFS_KEY = "portfolio-exit-planner:user-prefs:v1";

export type StoredUserPrefs = {
  displayName: string;
  shareHoldings: boolean;
};

export function parseStoredUserPrefs(raw: string | null): StoredUserPrefs | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredUserPrefs>;
    return {
      displayName: typeof parsed.displayName === "string" ? parsed.displayName : "Friend",
      shareHoldings: Boolean(parsed.shareHoldings)
    };
  } catch {
    return null;
  }
}

export function serializeUserPrefs(prefs: StoredUserPrefs) {
  return JSON.stringify({
    displayName: prefs.displayName,
    shareHoldings: prefs.shareHoldings
  });
}

export function resolveUserPrefsForSync(options: {
  local: StoredUserPrefs;
  cloudDisplayName?: string | null;
  cloudShareHoldings?: boolean | null;
  localIsNewer: boolean;
}): StoredUserPrefs {
  if (options.localIsNewer) return options.local;
  return {
    displayName: options.cloudDisplayName?.trim() || options.local.displayName,
    shareHoldings: options.cloudShareHoldings ?? options.local.shareHoldings
  };
}
