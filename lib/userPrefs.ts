export const USER_PREFS_KEY = "portfolio-exit-planner:user-prefs:v1";
export const LEGACY_USER_PREFS_KEY = USER_PREFS_KEY;

export function userPrefsStorageKey(userId: string | "guest") {
  return userId === "guest"
    ? "portfolio-exit-planner:user-prefs:guest:v1"
    : `portfolio-exit-planner:user-prefs:v2:user:${userId}`;
}

export type StoredUserPrefs = {
  displayName: string;
  shareHoldings: boolean;
  dailyReportEmail?: string;
  dailyReportEmailEnabled?: boolean;
};

export function parseStoredUserPrefs(raw: string | null): StoredUserPrefs | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredUserPrefs>;
    return {
      displayName: typeof parsed.displayName === "string" ? parsed.displayName : "Friend",
      shareHoldings: Boolean(parsed.shareHoldings),
      dailyReportEmail: typeof parsed.dailyReportEmail === "string" ? parsed.dailyReportEmail : "",
      dailyReportEmailEnabled: Boolean(parsed.dailyReportEmailEnabled)
    };
  } catch {
    return null;
  }
}

export function serializeUserPrefs(prefs: StoredUserPrefs) {
  return JSON.stringify({
    displayName: prefs.displayName,
    shareHoldings: prefs.shareHoldings,
    dailyReportEmail: prefs.dailyReportEmail || "",
    dailyReportEmailEnabled: Boolean(prefs.dailyReportEmailEnabled)
  });
}

export function resolveUserPrefsForSync(options: {
  local: StoredUserPrefs;
  cloudDisplayName?: string | null;
  cloudShareHoldings?: boolean | null;
  cloudDailyReportEmail?: string | null;
  cloudDailyReportEmailEnabled?: boolean | null;
  localIsNewer: boolean;
  /** When false, portfolio-only local edits must not downgrade cloud sharing. */
  shareHoldingsTouched?: boolean;
  dailyReportEmailTouched?: boolean;
}): StoredUserPrefs {
  if (options.localIsNewer) {
    const shareHoldings = options.shareHoldingsTouched
      ? options.local.shareHoldings
      : (options.cloudShareHoldings ?? options.local.shareHoldings);
    const dailyReportEmail = options.dailyReportEmailTouched
      ? (options.local.dailyReportEmail || "")
      : ((options.cloudDailyReportEmail ?? options.local.dailyReportEmail) || "");
    const dailyReportEmailEnabled = options.dailyReportEmailTouched
      ? Boolean(options.local.dailyReportEmailEnabled)
      : Boolean(options.cloudDailyReportEmailEnabled ?? options.local.dailyReportEmailEnabled);
    return {
      displayName: options.local.displayName,
      shareHoldings: Boolean(shareHoldings),
      dailyReportEmail,
      dailyReportEmailEnabled
    };
  }
  return {
    displayName: options.cloudDisplayName?.trim() || options.local.displayName,
    shareHoldings: Boolean(options.cloudShareHoldings ?? options.local.shareHoldings),
    dailyReportEmail: options.cloudDailyReportEmail ?? options.local.dailyReportEmail ?? "",
    dailyReportEmailEnabled: Boolean(options.cloudDailyReportEmailEnabled ?? options.local.dailyReportEmailEnabled)
  };
}
