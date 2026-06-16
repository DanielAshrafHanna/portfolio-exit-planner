"use client";

import { AlertCircle, CheckCircle2, Cloud, CloudOff, Loader2, Settings2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import type { CloudSyncStatus } from "@/components/AuthPanel";
import { AnalysisProgressBanner } from "@/components/AnalysisProgressBanner";
import { AuthPanel } from "@/components/AuthPanel";
import { DashboardShell } from "@/components/DashboardShell";
import { HoldingsTable } from "@/components/HoldingsTable";
import { HoldingsViewSelector, type HoldingsViewOption } from "@/components/HoldingsViewSelector";
import { MobileContextBar } from "@/components/MobileContextBar";
import { MobileTabShell } from "@/components/MobileTabShell";
import { ImageImport } from "@/components/ImageImport";
import { PortfolioInput } from "@/components/PortfolioInput";
import { PortfolioWorkspace } from "@/components/PortfolioWorkspace";
import { AiBriefPanel, type AiBrief } from "@/components/AiBriefPanel";
import { ProfileSelector } from "@/components/ProfileSelector";
import { PortfolioSummary } from "@/components/PortfolioSummary";
import { QuickAddHolding, type QuickAddHoldingHandle } from "@/components/QuickAddHolding";
import { SettingsDialog } from "@/components/SettingsDialog";
import { SettingsPanel } from "@/components/SettingsPanel";
import { DailyReportEmailSettings } from "@/components/DailyReportEmailSettings";
import { SharedHoldingsViewer } from "@/components/SharedHoldingsViewer";
import { defaultSellTargets } from "@/lib/calculations";
import {
  applySaleToHolding,
  mergeBuyIntoHolding,
  reconcileHolding
} from "@/lib/positionMath";
import {
  analysisCoverage,
  buildAnalysisSession,
  clearAnalysisSession,
  readAnalysisSession,
  reconcileAnalysisSession,
  writeAnalysisSession,
  type AnalysisSession
} from "@/lib/analysisProgress";
import { geminiModelName } from "@/lib/geminiClient";
import { applyCompanyNameToHolding } from "@/lib/holdingNames";
import { applyAnalyzedHoldingResults, type AnalyzedHoldingResult } from "@/lib/holdingMerge";
import { applyLiveQuotes, getQuoteRefreshIntervalMs, isQuotableQuote, liveQuoteKey } from "@/lib/marketRefresh";
import { sanitizeProfilesForPersistence } from "@/lib/quoteCacheMigration";
import { DEFAULT_SETTINGS, defaultProfiles, displayMarketSymbol } from "@/lib/profileUtils";
import { filterUnsupportedHoldings, getUnsupportedTickerMessage, isUnsupportedTicker } from "@/lib/unsupportedTickers";
import {
  clearLegacyPortfolioKeys,
  clearPortfolioCache,
  defaultPortfolioSnapshot,
  portfolioSnapshotFromProfiles,
  readGuestPortfolioState,
  readPortfolioCache,
  writePortfolioCache,
  type PortfolioCacheSnapshot
} from "@/lib/portfolioStorage";
import { activeProfileIdFromCloudPortfolioRow, cloudSettingsFromRow, profilesFromCloudPortfolioRow, type CloudSettings } from "@/lib/cloudPortfolio";
import {
  applyDailyAiCacheToHoldings,
  buildDailyAiUsageSummary,
  parseDailyAiCache,
  upsertDailyAiCacheEntry,
  type DailyAiCacheState
} from "@/lib/dailyAiCache";
import { cacheEntryForProfile, mergeProfilesWithDailyAiCache } from "@/lib/dailyAiPersistence";
import { readLocalDailyAiCache, writeLocalDailyAiCache } from "@/lib/dailyAiLocalStorage";
import { dailyReportEmailPrefsFromSettings } from "@/lib/dailyReportEmailPrefs";
import { coerceProfiles, emptyPortfolioBootstrap, enrichHolding } from "@/lib/storageMigration";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";
import {
  mergeProfilesForCloudSave,
  portfolioHoldingSymbols,
  shouldKeepSessionPortfolioEdits,
  shouldPreferLocalPortfolioCache,
  shouldSkipEmptyCloudOverwrite
} from "@/lib/portfolioSync";
import {
  LEGACY_USER_PREFS_KEY,
  parseStoredUserPrefs,
  resolveUserPrefsForSync,
  serializeUserPrefs,
  userPrefsStorageKey
} from "@/lib/userPrefs";
import type { AiAnalysis, EnrichedHolding, FeeSettings, HoldingInput, MarketQuote, NewsItem, PortfolioProfile, SharedPortfolioProfile } from "@/lib/types";

const EMPTY_HOLDINGS: EnrichedHolding[] = [];
const ADMIN_EMAIL = "danielhanna0001@gmail.com";
const OWN_HOLDINGS_VIEW_ID = "mine";

function sameSymbol(a?: string, b?: string) {
  return (a || "").trim().toUpperCase() === (b || "").trim().toUpperCase();
}

function portfolioFieldsChanged(existing: EnrichedHolding | undefined, row: HoldingInput) {
  if (!existing) return false;
  return existing.shares !== row.shares || existing.averageCost !== row.averageCost || existing.totalCost !== row.totalCost;
}

function normalizeWarning(warning: string) {
  if (warning.includes("GEMINI_API_KEY")) {
    return "GEMINI_API_KEY is missing. AI/OCR features are using deterministic fallback analysis until the secret is added.";
  }
  if (warning.includes("Gemini daily quota")) {
    return warning;
  }
  if (warning.includes("Yahoo Finance's public chart feed")) {
    return "Market API key is missing. Quotes are currently fetched from Yahoo Finance's public chart feed.";
  }
  return warning;
}

function warningForAudience(warning: string, isAdmin: boolean) {
  if (isAdmin) return warning;
  if (warning.includes("Supabase SQL") || warning.includes("schema cache") || warning.includes("display_name") || warning.includes("share_holdings")) {
    return null;
  }
  if (warning.includes("GEMINI_API_KEY")) {
    return "AI/OCR features are unavailable right now. Ask the admin to check setup.";
  }
  if (warning.includes("MARKET_DATA_API_KEY")) {
    return "Some market data may be delayed or using a fallback provider.";
  }
  if (warning.startsWith("Cloud save failed:") || warning.startsWith("Cloud load failed:")) {
    return "Cloud sync had a problem. Your local portfolio is still available.";
  }
  return warning;
}

function mergeExtractedRows(existingRows: EnrichedHolding[], extractedRows: HoldingInput[], region: "US" | "EG" = "US") {
  const bySymbol = new Map(existingRows.map((holding) => [holding.symbol.trim().toUpperCase(), holding]));
  const merged = [...existingRows];

  extractedRows.forEach((row) => {
    const symbol = row.symbol.trim().toUpperCase();
    if (!symbol || isUnsupportedTicker(symbol, region)) return;
    const existing = bySymbol.get(symbol);
    if (existing) {
      const mergedPosition = mergeBuyIntoHolding(existing, row.shares, row.averageCost);
      const next = reconcileHolding({
        ...existing,
        ...row,
        id: existing.id,
        symbol,
        shares: mergedPosition.shares,
        averageCost: mergedPosition.averageCost,
        totalCost: mergedPosition.totalCost,
        name: existing.name || row.name
      });
      const index = merged.findIndex((holding) => holding.id === existing.id);
      merged[index] = {
        ...enrichHolding(next),
        quote: undefined,
        news: [],
        analysis: undefined,
        selectedStopStyle: existing.selectedStopStyle || "balanced",
        sellPercent: existing.sellPercent || 100
      };
      return;
    }
    merged.push(enrichHolding({ ...row, symbol }));
  });

  return merged;
}

function profileNameForCount(count: number) {
  return `Portfolio ${count + 1}`;
}

function toHoldingInput(holding: EnrichedHolding): HoldingInput {
  return {
    id: holding.id,
    symbol: holding.symbol,
    name: holding.name,
    shares: holding.shares,
    averageCost: holding.averageCost,
    totalCost: holding.totalCost,
    brokerCurrentValue: holding.brokerCurrentValue,
    notes: holding.notes
  };
}

type MarketApiRow = {
  symbol: string;
  quote?: MarketQuote;
  news?: NewsItem[];
  warnings?: string[];
};

type MarketApiResponse = {
  rows?: MarketApiRow[];
  error?: string;
};

type PortfolioAnalysisApiResponse = {
  results?: Array<{ id: string; analysis?: AiAnalysis; fallback?: boolean }>;
  warning?: string;
  error?: string;
  cached?: boolean;
  cacheEntry?: DailyAiCacheState["entries"][string];
  usage?: { marketDate?: string; runType?: "automatic" | "manual"; generatedAt?: string };
};

type LoginIdentifierResponse = {
  email?: string;
  error?: string;
};

type CloudPortfolioPayload = {
  profiles: PortfolioProfile[];
  activeProfileId: string;
  displayName?: string;
  shareHoldings?: boolean;
  dailyReportEmail?: string;
  dailyReportEmailEnabled?: boolean;
};

type CloudPortfolioRow = {
  holdings: unknown;
  settings: unknown;
  display_name?: string | null;
  share_holdings?: boolean | null;
  updated_at?: string | null;
  user_id?: string | null;
};

async function readJsonResponse<T>(response: Response): Promise<T> {
  try {
    return await response.json() as T;
  } catch {
    throw new Error(`Server returned an unreadable response (${response.status}).`);
  }
}

function friendlyNameForUser(user: User | null) {
  const metadataName = user?.user_metadata?.full_name || user?.user_metadata?.name;
  if (typeof metadataName === "string" && metadataName.trim()) return metadataName.trim();
  return friendlyNameFromEmail(user?.email);
}

function friendlyNameFromEmail(email?: string) {
  const emailName = email?.split("@")[0]?.replace(/[._-]+/g, " ").trim();
  if (emailName) return emailName.replace(/\b\w/g, (letter) => letter.toUpperCase());
  return "Friend";
}

function normalizeDisplayName(value: string) {
  const trimmed = value.trim();
  return trimmed || "Friend";
}

function isAdminUser(user: User | null) {
  if (!user) return false;
  return user.email?.toLowerCase() === ADMIN_EMAIL || user.app_metadata?.is_admin === true || user.app_metadata?.role === "admin";
}

function isMissingSharedColumnsError(error?: { message?: string } | null) {
  const message = error?.message || "";
  return message.includes("display_name") || message.includes("share_holdings") || message.includes("schema cache");
}

function sharedUserViewId(entry: SharedPortfolioProfile) {
  return `shared:${entry.userId || entry.displayName}`;
}

function readStoredUserPrefs(userId: string | "guest") {
  const keyed = parseStoredUserPrefs(localStorage.getItem(userPrefsStorageKey(userId)));
  if (keyed) return keyed;
  if (userId !== "guest") return parseStoredUserPrefs(localStorage.getItem(LEGACY_USER_PREFS_KEY));
  return null;
}

function profilesSyncKey(profiles: PortfolioProfile[], activeProfileId: string, displayName: string, shareHoldings: boolean) {
  return JSON.stringify({
    activeProfileId,
    displayName: normalizeDisplayName(displayName),
    shareHoldings: Boolean(shareHoldings),
    profiles: profiles.map((profile) => ({
      id: profile.id,
      name: profile.name,
      region: profile.region,
      currency: profile.currency,
      settings: profile.settings,
      holdings: profile.holdings.map((holding) => ({
        id: holding.id,
        symbol: holding.symbol,
        name: holding.name,
        shares: holding.shares,
        averageCost: holding.averageCost,
        totalCost: holding.totalCost,
        brokerCurrentValue: holding.brokerCurrentValue,
        notes: holding.notes,
        selectedStopStyle: holding.selectedStopStyle,
        selectedTargetPrice: holding.selectedTargetPrice,
        targetPriceEdited: holding.targetPriceEdited,
        sellPercent: holding.sellPercent
      }))
    }))
  });
}

function buildCloudPayload(
  profiles: PortfolioProfile[],
  activeProfileId: string,
  displayName: string,
  shareHoldings: boolean,
  dailyReportEmail = "",
  dailyReportEmailEnabled = false
) {
  return JSON.stringify({
    profiles: sanitizeProfilesForPersistence(profiles),
    activeProfileId,
    displayName,
    shareHoldings,
    dailyReportEmail,
    dailyReportEmailEnabled
  });
}

function syncBadgeClass(status: CloudSyncStatus) {
  if (status === "error") return "border-coral/35 bg-coral/10 text-coral";
  if (status === "saved") return "border-marine/20 bg-mint text-marine";
  return "border-ink/15 bg-paper text-ink/70";
}

function syncBadgeIcon(status: CloudSyncStatus) {
  if (status === "loading" || status === "saving") return <Loader2 className="h-4 w-4 animate-spin" aria-hidden />;
  if (status === "saved") return <CheckCircle2 className="h-4 w-4" aria-hidden />;
  if (status === "error") return <CloudOff className="h-4 w-4" aria-hidden />;
  return <Cloud className="h-4 w-4" aria-hidden />;
}

export default function Home() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [profiles, setProfiles] = useState<PortfolioProfile[]>(() => defaultProfiles());
  const [activeProfileId, setActiveProfileId] = useState("us-portfolio");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [dailyAiCache, setDailyAiCache] = useState<DailyAiCacheState>({ entries: {}, usageByMarketDate: {} });
  const dailyAiCacheRef = useRef<DailyAiCacheState>({ entries: {}, usageByMarketDate: {} });
  const [analysisSession, setAnalysisSession] = useState<AnalysisSession | null>(null);
  const [isRefreshingMarket, setIsRefreshingMarket] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [cloudSyncStatus, setCloudSyncStatus] = useState<CloudSyncStatus>("signed-out");
  const [cloudSyncMessage, setCloudSyncMessage] = useState("Sign in to enable cloud sync.");
  const [cloudLoadedUserId, setCloudLoadedUserId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("Friend");
  const [shareHoldings, setShareHoldings] = useState(false);
  const [dailyReportEmail, setDailyReportEmail] = useState("");
  const [dailyReportEmailEnabled, setDailyReportEmailEnabled] = useState(false);
  const [sharedProfiles, setSharedProfiles] = useState<SharedPortfolioProfile[]>([]);
  const [selectedSharedProfileId, setSelectedSharedProfileId] = useState(OWN_HOLDINGS_VIEW_ID);
  const [isLoadingSharedProfiles, setIsLoadingSharedProfiles] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [quickAddFocusToken, setQuickAddFocusToken] = useState(0);
  const [quickAddExpanded, setQuickAddExpanded] = useState(false);
  const [desktopSettingsOpen, setDesktopSettingsOpen] = useState(false);
  const quickAddRef = useRef<QuickAddHoldingHandle>(null);
  const hydratedPrefsUserId = useRef<string | null>(null);
  const displayNameSaveTimeout = useRef<number | null>(null);
  const cloudSaveTimeout = useRef<number | null>(null);
  const pushCloudPortfolioNowRef = useRef<(override?: {
    displayName?: string;
    shareHoldings?: boolean;
    dailyReportEmail?: string;
    dailyReportEmailEnabled?: boolean;
  }) => Promise<void>>(async () => {});
  const latestSyncKey = useRef("");
  const userEditRevision = useRef(0);
  const profilesRef = useRef(profiles);
  const displayNameRef = useRef(displayName);
  const shareHoldingsRef = useRef(shareHoldings);
  const dailyReportEmailRef = useRef(dailyReportEmail);
  const dailyReportEmailEnabledRef = useRef(dailyReportEmailEnabled);
  const cloudShareHoldingsRef = useRef(false);
  const cloudDailyReportEmailRef = useRef("");
  const cloudDailyReportEmailEnabledRef = useRef(false);
  const shareHoldingsTouchedRef = useRef(false);
  const dailyReportEmailTouchedRef = useRef(false);
  const sessionPortfolioEditedRef = useRef(false);
  const sessionEditedHoldingsProfileIdsRef = useRef<Set<string>>(new Set());
  const lastCloudProfilesRef = useRef<PortfolioProfile[]>(defaultProfiles());
  const cloudPortfolioUpdatedAtRef = useRef<string | null>(null);
  const cloudHoldingCountRef = useRef(0);
  const signedInUserIdRef = useRef<string | null>(null);
  const cloudLoadInFlightRef = useRef(false);
  const [liveQuotes, setLiveQuotes] = useState<Record<string, MarketQuote>>({});
  const [sharedLiveQuotes, setSharedLiveQuotes] = useState<Record<string, MarketQuote>>({});
  const marketRequestId = useRef(0);
  const liveQuoteRequestId = useRef(0);
  const sharedLiveQuoteRequestId = useRef(0);
  const analysisRequestId = useRef(0);
  const activeProfileIdRef = useRef(activeProfileId);
  const holdingInputKeyRef = useRef("");

  profilesRef.current = profiles;
  displayNameRef.current = displayName;
  shareHoldingsRef.current = shareHoldings;
  dailyReportEmailRef.current = dailyReportEmail;
  dailyReportEmailEnabledRef.current = dailyReportEmailEnabled;

  const shareHoldingsForCloudSave = () => (
    shareHoldingsTouchedRef.current ? shareHoldingsRef.current : cloudShareHoldingsRef.current
  );

  const dailyReportEmailForCloudSave = () => (
    dailyReportEmailTouchedRef.current ? dailyReportEmailRef.current : cloudDailyReportEmailRef.current
  );

  const dailyReportEmailEnabledForCloudSave = () => (
    dailyReportEmailTouchedRef.current ? dailyReportEmailEnabledRef.current : cloudDailyReportEmailEnabledRef.current
  );

  const applyDailyReportEmailFromCloud = (email: string, enabled: boolean) => {
    cloudDailyReportEmailRef.current = email;
    cloudDailyReportEmailEnabledRef.current = enabled;
    dailyReportEmailTouchedRef.current = false;
    setDailyReportEmail(email);
    setDailyReportEmailEnabled(enabled);
  };

  const applyShareHoldingsFromCloud = (nextShareHoldings: boolean) => {
    cloudShareHoldingsRef.current = nextShareHoldings;
    shareHoldingsTouchedRef.current = false;
    setShareHoldings(nextShareHoldings);
  };

  const touchPortfolioSave = () => {
    userEditRevision.current += 1;
    sessionPortfolioEditedRef.current = true;
    persistLocalPortfolioBackup();
    schedulePortfolioCloudSave();
  };

  const touchHoldingsEdit = () => {
    touchPortfolioSave();
    const profileId = activeProfileIdRef.current;
    if (profileId) sessionEditedHoldingsProfileIdsRef.current.add(profileId);
  };

  const applyEmptyPortfolioBootstrap = () => {
    const bootstrap = emptyPortfolioBootstrap();
    userEditRevision.current = 0;
    sessionPortfolioEditedRef.current = false;
    sessionEditedHoldingsProfileIdsRef.current = new Set();
    latestSyncKey.current = "";
    cloudPortfolioUpdatedAtRef.current = null;
    cloudHoldingCountRef.current = 0;
    lastCloudProfilesRef.current = defaultProfiles();
    setProfiles(bootstrap.profiles);
    setActiveProfileId(bootstrap.activeProfileId);
    return bootstrap;
  };

  const persistSignedInPortfolioCache = (snapshot: PortfolioCacheSnapshot) => {
    if (!user) return;
    writePortfolioCache(user.id, snapshot);
  };

  const persistLocalPortfolioBackup = (nextProfiles = profiles, nextActiveProfileId = activeProfileId) => {
    if (!user) return;
    writePortfolioCache(user.id, portfolioSnapshotFromProfiles(
      nextProfiles,
      nextActiveProfileId,
      cloudPortfolioUpdatedAtRef.current,
      new Date().toISOString()
    ));
  };

  const schedulePortfolioCloudSave = () => {
    if (!supabase || !user || cloudLoadedUserId !== user.id) return;
    if (cloudSaveTimeout.current) window.clearTimeout(cloudSaveTimeout.current);
    cloudSaveTimeout.current = window.setTimeout(() => {
      void pushCloudPortfolioNowRef.current();
    }, 400);
  };

  const applyCloudPortfolioSnapshot = (
    snapshot: PortfolioCacheSnapshot,
    options: {
      displayName: string;
      shareHoldings: boolean;
      cloudUpdatedAt?: string | null;
    }
  ) => {
    const resolvedUpdatedAt = options.cloudUpdatedAt ?? snapshot.cloudUpdatedAt ?? null;
    sessionPortfolioEditedRef.current = false;
    sessionEditedHoldingsProfileIdsRef.current = new Set();
    cloudPortfolioUpdatedAtRef.current = resolvedUpdatedAt;
    const sanitizedProfiles = sanitizeProfilesForPersistence(snapshot.profiles);
    cloudHoldingCountRef.current = portfolioHoldingSymbols(sanitizedProfiles).length;
    lastCloudProfilesRef.current = sanitizedProfiles;
    setProfiles(sanitizedProfiles);
    setActiveProfileId(snapshot.activeProfileId);
    setDisplayName(options.displayName);
    applyShareHoldingsFromCloud(options.shareHoldings);
    latestSyncKey.current = profilesSyncKey(
      snapshot.profiles,
      snapshot.activeProfileId,
      options.displayName,
      options.shareHoldings
    );
    persistSignedInPortfolioCache(portfolioSnapshotFromProfiles(
      sanitizedProfiles,
      snapshot.activeProfileId,
      resolvedUpdatedAt
    ));
  };

  useEffect(() => {
    if (!supabase) {
      setIsAuthReady(true);
      return;
    }
    setIsAuthLoading(true);
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setIsAuthLoading(false);
      setIsAuthReady(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => listener.subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    if (!isAuthReady) return;
    if (!user) {
      signedInUserIdRef.current = null;
      sessionPortfolioEditedRef.current = false;
      sessionEditedHoldingsProfileIdsRef.current = new Set();
      cloudPortfolioUpdatedAtRef.current = null;
      cloudHoldingCountRef.current = 0;
      lastCloudProfilesRef.current = defaultProfiles();
      latestSyncKey.current = "";
      setCloudLoadedUserId(null);
      const guest = readGuestPortfolioState();
      const guestCache = readLocalDailyAiCache("guest");
      setDailyAiCache(guestCache);
      setProfiles(mergeProfilesWithDailyAiCache(guest.profiles, guestCache));
      setActiveProfileId(guest.activeProfileId);
      const guestPrefs = readStoredUserPrefs("guest");
      if (guestPrefs) {
        setDisplayName(guestPrefs.displayName);
        setShareHoldings(guestPrefs.shareHoldings);
        setDailyReportEmail(guestPrefs.dailyReportEmail || "");
        setDailyReportEmailEnabled(Boolean(guestPrefs.dailyReportEmailEnabled));
      }
      setIsHydrated(true);
      return;
    }

    if (signedInUserIdRef.current === user.id && isHydrated) return;

    signedInUserIdRef.current = user.id;
    sessionPortfolioEditedRef.current = false;
    sessionEditedHoldingsProfileIdsRef.current = new Set();
    cloudPortfolioUpdatedAtRef.current = null;
    cloudHoldingCountRef.current = 0;
    lastCloudProfilesRef.current = defaultProfiles();
    latestSyncKey.current = "";
    setCloudLoadedUserId(null);
    const cached = readPortfolioCache(user.id);
    const bootstrap = cached ?? defaultPortfolioSnapshot();
    setProfiles(bootstrap.profiles);
    setActiveProfileId(bootstrap.activeProfileId);
    const storedPrefs = readStoredUserPrefs(user.id);
    if (storedPrefs) {
      setDisplayName(storedPrefs.displayName);
      setShareHoldings(storedPrefs.shareHoldings);
      setDailyReportEmail(storedPrefs.dailyReportEmail || "");
      setDailyReportEmailEnabled(Boolean(storedPrefs.dailyReportEmailEnabled));
    } else {
      setDisplayName((existing) => existing === "Friend" ? friendlyNameForUser(user) : existing);
    }
    setIsHydrated(true);
    // Intentionally keyed by user id so token refresh does not reset the signed-in portfolio.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthReady, user?.id, isHydrated]);

  useEffect(() => {
    if (!isHydrated || user) return;
    writePortfolioCache("guest", portfolioSnapshotFromProfiles(profiles, activeProfileId, null, new Date().toISOString()));
  }, [profiles, activeProfileId, isHydrated, user]);

  useEffect(() => {
    if (!isHydrated || !user) return;
    persistLocalPortfolioBackup();
    // Backup signed-in edits locally on every portfolio change, even before cloud save completes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profiles, activeProfileId, isHydrated, user?.id]);

  useEffect(() => {
    if (!isHydrated) return;
    const prefsKey = user ? userPrefsStorageKey(user.id) : userPrefsStorageKey("guest");
    localStorage.setItem(prefsKey, serializeUserPrefs({
      displayName: normalizeDisplayName(displayName),
      shareHoldings,
      dailyReportEmail,
      dailyReportEmailEnabled
    }));
  }, [displayName, shareHoldings, dailyReportEmail, dailyReportEmailEnabled, isHydrated, user]);

  const currentProfilesSyncKey = useMemo(
    () => profilesSyncKey(profiles, activeProfileId, displayName, shareHoldings),
    [profiles, activeProfileId, displayName, shareHoldings]
  );

  useEffect(() => {
    if (!user) {
      hydratedPrefsUserId.current = null;
      cloudShareHoldingsRef.current = false;
      cloudDailyReportEmailRef.current = "";
      cloudDailyReportEmailEnabledRef.current = false;
      shareHoldingsTouchedRef.current = false;
      dailyReportEmailTouchedRef.current = false;
      sessionPortfolioEditedRef.current = false;
      setCloudSyncStatus("signed-out");
      setCloudSyncMessage("Sign in to enable cloud sync.");
      setSharedProfiles([]);
      setSelectedSharedProfileId(OWN_HOLDINGS_VIEW_ID);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const activeProfile = useMemo(() => profiles.find((profile) => profile.id === activeProfileId) || profiles[0], [profiles, activeProfileId]);
  const holdings = activeProfile?.holdings ?? EMPTY_HOLDINGS;
  const settings = activeProfile?.settings || DEFAULT_SETTINGS;
  const currency = activeProfile?.currency || "USD";
  const region = activeProfile?.region || "US";
  const isAdmin = isAdminUser(user);
  const visibleWarnings = useMemo(() => (
    [...new Set(warnings.map((warning) => warningForAudience(warning, isAdmin)).filter((warning): warning is string => Boolean(warning)))]
  ), [warnings, isAdmin]);
  const sharedProfilesForRegion = useMemo(() => {
    const byUser = new Map<string, SharedPortfolioProfile>();
    sharedProfiles.forEach((entry) => {
      if (entry.profile.region !== region) return;
      const viewId = sharedUserViewId(entry);
      if (!byUser.has(viewId)) byUser.set(viewId, entry);
    });
    return [...byUser.values()];
  }, [region, sharedProfiles]);
  const selectedSharedProfile = useMemo(() => (
    sharedProfilesForRegion.find((entry) => sharedUserViewId(entry) === selectedSharedProfileId)
  ), [selectedSharedProfileId, sharedProfilesForRegion]);
  const holdingsViewOptions = useMemo<HoldingsViewOption[]>(() => {
    const ownRegion = region === "EG" ? "Egypt" : "US";
    return [
      {
        id: OWN_HOLDINGS_VIEW_ID,
        label: "My portfolio",
        sublabel: `${activeProfile?.name || "Portfolio"} - ${ownRegion}`,
        holdingsCount: holdings.length,
        isMine: true
      },
      ...sharedProfilesForRegion.map((entry) => ({
        id: sharedUserViewId(entry),
        label: entry.displayName,
        sublabel: `${entry.profile.name} - ${ownRegion}`,
        holdingsCount: entry.profile.holdings.length
      }))
    ];
  }, [activeProfile?.name, holdings.length, region, sharedProfilesForRegion]);
  const holdingsWithLiveQuotes = useMemo(
    () => applyLiveQuotes(holdings, liveQuotes, region),
    [holdings, liveQuotes, region]
  );
  const sharedMarketSymbolKey = useMemo(() => {
    if (!selectedSharedProfile) return "";
    const sharedRegion = selectedSharedProfile.profile.region;
    return selectedSharedProfile.profile.holdings
      .map((holding) => `${holding.id}:${displayMarketSymbol(holding.symbol, sharedRegion)}`)
      .join("|");
  }, [selectedSharedProfile]);
  const sharedHoldingsWithQuotes = useMemo(() => {
    if (!selectedSharedProfile) return [];
    return applyLiveQuotes(
      selectedSharedProfile.profile.holdings,
      sharedLiveQuotes,
      selectedSharedProfile.profile.region
    );
  }, [selectedSharedProfile, sharedLiveQuotes]);
  const displayedHoldings = useMemo(() => {
    const source = selectedSharedProfile ? sharedHoldingsWithQuotes : holdingsWithLiveQuotes;
    const sourceRegion = selectedSharedProfile?.profile.region || region;
    return filterUnsupportedHoldings(source, sourceRegion);
  }, [holdingsWithLiveQuotes, sharedHoldingsWithQuotes, region, selectedSharedProfile]);
  const displayedSettings = selectedSharedProfile?.profile.settings || settings;
  const displayedCurrency = selectedSharedProfile?.profile.currency || currency;
  const marketSymbolKey = useMemo(() => (
    holdings.map((holding) => `${holding.id}:${displayMarketSymbol(holding.symbol, region)}`).join("|")
  ), [holdings, region]);
  const holdingInputKey = useMemo(() => (
    holdings.map((holding) => [
      holding.id,
      holding.symbol,
      holding.name,
      holding.shares,
      holding.averageCost,
      holding.totalCost,
      holding.brokerCurrentValue,
      holding.notes
    ].join(":")).join("|")
  ), [holdings]);
  const holdingsAnalysisKey = useMemo(
    () => holdings.map((holding) => `${holding.id}:${holding.symbol}:${holding.analysis ? 1 : 0}`).join("|"),
    [holdings]
  );
  useEffect(() => {
    dailyAiCacheRef.current = dailyAiCache;
  }, [dailyAiCache]);

  const aiUsageSummary = useMemo(
    () => buildDailyAiUsageSummary(dailyAiCache, region, activeProfile?.id || activeProfileId),
    [dailyAiCache, region, activeProfile?.id, activeProfileId]
  );
  const aiBrief = useMemo<AiBrief | null>(() => {
    const entry = aiUsageSummary.profileEntry;
    if (!entry) return null;
    return {
      summary: entry.summary,
      generatedAt: entry.generatedAt,
      fallback: entry.fallback,
      runType: entry.runType
    };
  }, [aiUsageSummary.profileEntry]);
  const portfolioAnalysisCoverage = useMemo(() => analysisCoverage(holdingsWithLiveQuotes), [holdingsWithLiveQuotes]);

  useEffect(() => {
    activeProfileIdRef.current = activeProfile?.id || activeProfileId;
    holdingInputKeyRef.current = holdingInputKey;
  }, [activeProfile?.id, activeProfileId, holdingInputKey]);

  useEffect(() => {
    if (!isHydrated || isAnalyzing || selectedSharedProfileId !== OWN_HOLDINGS_VIEW_ID) return;
    const userId = user?.id ?? "guest";
    const stored = readAnalysisSession(userId);
    const reconciled = reconcileAnalysisSession(
      stored,
      activeProfileId,
      holdingInputKey,
      portfolioAnalysisCoverage
    );
    setAnalysisSession(reconciled);
  }, [
    isHydrated,
    isAnalyzing,
    user?.id,
    activeProfileId,
    holdingInputKey,
    holdingsAnalysisKey,
    portfolioAnalysisCoverage,
    selectedSharedProfileId
  ]);

  useEffect(() => {
    if (!holdingsViewOptions.some((option) => option.id === selectedSharedProfileId)) {
      setSelectedSharedProfileId(OWN_HOLDINGS_VIEW_ID);
    }
  }, [holdingsViewOptions, selectedSharedProfileId]);

  useEffect(() => {
    setSelectedSharedProfileId(OWN_HOLDINGS_VIEW_ID);
  }, [activeProfileId]);

  const updateActiveProfile = (updater: (profile: PortfolioProfile) => PortfolioProfile) => {
    setProfiles((items) => items.map((profile) => profile.id === activeProfile?.id ? updater(profile) : profile));
  };

  const setHoldings = (nextHoldings: EnrichedHolding[] | ((existing: EnrichedHolding[]) => EnrichedHolding[])) => {
    updateActiveProfile((profile) => {
      const resolved = typeof nextHoldings === "function" ? nextHoldings(profile.holdings) : nextHoldings;
      return { ...profile, holdings: filterUnsupportedHoldings(resolved, profile.region) };
    });
  };

  const setSettings = (nextSettings: FeeSettings) => {
    touchPortfolioSave();
    updateActiveProfile((profile) => ({ ...profile, settings: nextSettings }));
  };

  const inputRows = useMemo(() => holdings.map(toHoldingInput), [holdings]);

  const setInputRows = (rows: HoldingInput[]) => {
    touchHoldingsEdit();
    setHoldings(rows.map((row) => {
      const existing = holdings.find((holding) => holding.id === row.id);
      const symbolUnchanged = sameSymbol(existing?.symbol, row.symbol);
      const costOrShareChanged = portfolioFieldsChanged(existing, row);
      const quote = symbolUnchanged ? existing?.quote : undefined;
      const selectedTargetPrice = existing?.targetPriceEdited
        ? existing.selectedTargetPrice
        : quote ? defaultSellTargets(quote.currentPrice)[1].price : undefined;
      return {
        ...enrichHolding(row),
        quote,
        news: symbolUnchanged ? existing?.news || [] : [],
        analysis: symbolUnchanged && !costOrShareChanged ? existing?.analysis : undefined,
        selectedStopStyle: existing?.selectedStopStyle || "balanced",
        selectedTargetPrice,
        targetPriceEdited: symbolUnchanged ? existing?.targetPriceEdited : false,
        sellPercent: existing?.sellPercent || 100
      };
    }));
  };

  const updateHolding = (next: EnrichedHolding) => {
    touchHoldingsEdit();
    setHoldings((items) => items.map((item) => item.id === next.id ? next : item));
  };

  const handleApplySale = (holding: EnrichedHolding) => {
    if (!holding.quote) return null;
    touchHoldingsEdit();
    const sellPrice = holding.selectedTargetPrice || holding.quote.currentPrice;
    const result = applySaleToHolding(holding, sellPrice, holding.sellPercent, settings);
    if (result.closed) {
      setHoldings((items) => items.filter((item) => item.id !== holding.id));
    } else if (result.holding) {
      updateHolding({
        ...holding,
        shares: result.holding.shares,
        averageCost: result.holding.averageCost,
        totalCost: result.holding.totalCost,
        sellPercent: 100,
        analysis: undefined
      });
    }
    return result;
  };

  const syncLiveQuotesFromRows = (
    rows: MarketApiRow[],
    regionAtStart: typeof region,
    isLatest: () => boolean
  ) => {
    if (!isLatest()) return;
    setLiveQuotes((existing) => {
      const next = { ...existing };
      rows.forEach((row) => {
        if (!row.quote) return;
        next[liveQuoteKey(regionAtStart, row.symbol)] = row.quote;
      });
      return next;
    });
  };

  const syncSharedLiveQuotesFromRows = (
    rows: MarketApiRow[],
    regionAtStart: typeof region,
    isLatest: () => boolean
  ) => {
    if (!isLatest()) return;
    setSharedLiveQuotes((existing) => {
      const next = { ...existing };
      rows.forEach((row) => {
        if (!row.quote) return;
        next[liveQuoteKey(regionAtStart, row.symbol)] = row.quote;
      });
      return next;
    });
  };

  const refreshLiveQuotes = async () => {
    const requestId = liveQuoteRequestId.current + 1;
    liveQuoteRequestId.current = requestId;
    const profileIdAtStart = activeProfile?.id || activeProfileId;
    const regionAtStart = region;
    const holdingsSnapshot = holdings;
    const isLatestRequest = () => (
      liveQuoteRequestId.current === requestId && activeProfileIdRef.current === profileIdAtStart
    );
    const symbols = holdingsSnapshot
      .map((holding) => displayMarketSymbol(holding.symbol, regionAtStart))
      .filter(Boolean);
    if (!symbols.length) return;

    try {
      const marketResponse = await fetch("/api/market", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          holdings: holdingsSnapshot.map((holding) => ({
            symbol: displayMarketSymbol(holding.symbol, regionAtStart),
            region: regionAtStart
          })),
          region: regionAtStart,
          quotesOnly: true
        })
      });
      const marketData = await readJsonResponse<MarketApiResponse>(marketResponse);
      if (!marketResponse.ok || marketData.error || !isLatestRequest()) return;
      syncLiveQuotesFromRows(marketData.rows || [], regionAtStart, isLatestRequest);
    } catch {
      // Quote polls fail quietly so the rest of the UI stays stable.
    }
  };

  const refreshSharedLiveQuotes = async (options: { showWarnings?: boolean } = {}) => {
    if (!selectedSharedProfile) return;
    const requestId = sharedLiveQuoteRequestId.current + 1;
    sharedLiveQuoteRequestId.current = requestId;
    const sharedRegion = selectedSharedProfile.profile.region;
    const holdingsSnapshot = selectedSharedProfile.profile.holdings;
    const viewIdAtStart = selectedSharedProfileId;
    const isLatestRequest = () => (
      sharedLiveQuoteRequestId.current === requestId && selectedSharedProfileId === viewIdAtStart
    );
    const symbols = holdingsSnapshot
      .map((holding) => displayMarketSymbol(holding.symbol, sharedRegion))
      .filter(Boolean);
    if (!symbols.length) return;

    try {
      const marketResponse = await fetch("/api/market", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          holdings: holdingsSnapshot.map((holding) => ({
            symbol: displayMarketSymbol(holding.symbol, sharedRegion),
            region: sharedRegion
          })),
          region: sharedRegion,
          quotesOnly: true
        })
      });
      const marketData = await readJsonResponse<MarketApiResponse>(marketResponse);
      if (!marketResponse.ok || marketData.error || !isLatestRequest()) return;
      if (options.showWarnings && isLatestRequest()) {
        setWarnings((existing) => [
          ...existing,
          ...(marketData.rows || []).flatMap((row) => row.warnings || []).map(normalizeWarning)
        ]);
      }
      syncSharedLiveQuotesFromRows(marketData.rows || [], sharedRegion, isLatestRequest);
    } catch {
      // Shared quote polls fail quietly so the read-only view stays stable.
    }
  };

  const refreshMarketData = async (options: { showLoading?: boolean; showWarnings?: boolean; quotesOnly?: boolean } = {}) => {
    const requestId = marketRequestId.current + 1;
    marketRequestId.current = requestId;
    const profileIdAtStart = activeProfile?.id || activeProfileId;
    const holdingsSnapshot = holdings;
    const regionAtStart = region;
    const isLatestRequest = () => marketRequestId.current === requestId && activeProfileIdRef.current === profileIdAtStart;
    const symbols = holdingsSnapshot.map((holding) => displayMarketSymbol(holding.symbol, regionAtStart)).filter(Boolean);
    if (!symbols.length) return holdings;
    if (options.showLoading) setIsRefreshingMarket(true);
    try {
      const analysisHoldings = holdingsSnapshot.map((holding) => ({ symbol: displayMarketSymbol(holding.symbol, regionAtStart), region: regionAtStart })).filter((holding) => holding.symbol);
      const marketResponse = await fetch("/api/market", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ holdings: analysisHoldings, region: regionAtStart, quotesOnly: options.quotesOnly === true })
      });
      const marketData = await readJsonResponse<MarketApiResponse>(marketResponse);
      if (!marketResponse.ok) throw new Error(marketData.error || "Market refresh failed");
      if (marketData.error) throw new Error(marketData.error);
      const bySymbol = new Map<string, { quote: MarketQuote; news: NewsItem[]; warnings: string[] }>();
      (marketData.rows || []).forEach((row) => {
        if (row.quote) bySymbol.set(row.symbol.trim().toUpperCase(), { quote: row.quote, news: row.news || [], warnings: row.warnings || [] });
      });
      const withMarket = holdingsSnapshot.map((holding) => {
        const row = bySymbol.get(displayMarketSymbol(holding.symbol, regionAtStart).toUpperCase());
        const quote = row?.quote;
        const selectedTargetPrice = quote && !holding.targetPriceEdited ? defaultSellTargets(quote.currentPrice)[1].price : holding.selectedTargetPrice;
        return { ...holding, quote, news: row?.news || holding.news || [], selectedTargetPrice };
      });
      if (options.showWarnings && isLatestRequest()) {
        setWarnings((existing) => [...existing, ...(marketData.rows || []).flatMap((row) => row.warnings || []).map(normalizeWarning)]);
      }
      if (!isLatestRequest()) return undefined;
      setHoldings((currentItems) => currentItems.map((holding) => {
        const row = bySymbol.get(displayMarketSymbol(holding.symbol, regionAtStart).toUpperCase());
        if (!row) return holding;
        const selectedTargetPrice = !holding.targetPriceEdited ? defaultSellTargets(row.quote.currentPrice)[1].price : holding.selectedTargetPrice;
        return applyCompanyNameToHolding({
          ...holding,
          quote: row.quote,
          news: row.news,
          selectedTargetPrice
        }, row.quote);
      }));
      syncLiveQuotesFromRows(marketData.rows || [], regionAtStart, isLatestRequest);
      return withMarket;
    } catch (error) {
      if (options.showWarnings && isLatestRequest()) {
        setWarnings((existing) => [...existing, error instanceof Error ? error.message : "Market refresh failed"]);
      }
      return holdingsSnapshot;
    } finally {
      if (options.showLoading && marketRequestId.current === requestId) setIsRefreshingMarket(false);
    }
  };

  useEffect(() => {
    setLiveQuotes({});
  }, [activeProfileId, marketSymbolKey]);

  useEffect(() => {
    setSharedLiveQuotes({});
  }, [selectedSharedProfileId, sharedMarketSymbolKey]);

  useEffect(() => {
    if (!isHydrated || !holdings.some((holding) => holding.symbol)) return;
    void refreshLiveQuotes();
    void refreshMarketData({ showLoading: false, showWarnings: false, quotesOnly: true });
    // Keyed by symbol/profile fingerprint so quote-only updates do not trigger another refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHydrated, activeProfileId, region, marketSymbolKey]);

  useEffect(() => {
    if (!isHydrated || !selectedSharedProfile || !sharedMarketSymbolKey) return;
    void refreshSharedLiveQuotes({ showWarnings: true });
    // Keyed by shared holdings fingerprint so quote-only updates do not trigger another refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHydrated, selectedSharedProfileId, sharedMarketSymbolKey]);

  useEffect(() => {
    if (!isHydrated || !holdings.some((holding) => holding.symbol)) return;
    let cancelled = false;
    let timeoutId = 0;

    const scheduleNext = () => {
      if (cancelled) return;
      const hidden = document.visibilityState === "hidden";
      const delay = getQuoteRefreshIntervalMs(region, { hidden });
      timeoutId = window.setTimeout(async () => {
        if (cancelled) return;
        if (document.visibilityState === "visible") {
          await refreshLiveQuotes();
        }
        scheduleNext();
      }, delay);
    };

    scheduleNext();
    const onVisible = () => {
      if (document.visibilityState === "visible") void refreshLiveQuotes();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      document.removeEventListener("visibilitychange", onVisible);
    };
    // Keyed by holdings fingerprint, not live quote updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHydrated, activeProfileId, region, marketSymbolKey, holdingInputKey]);

  useEffect(() => {
    if (!isHydrated || !selectedSharedProfile || !sharedMarketSymbolKey) return;
    let cancelled = false;
    let timeoutId = 0;
    const sharedRegion = selectedSharedProfile.profile.region;

    const scheduleNext = () => {
      if (cancelled) return;
      const hidden = document.visibilityState === "hidden";
      const delay = getQuoteRefreshIntervalMs(sharedRegion, { hidden });
      timeoutId = window.setTimeout(async () => {
        if (cancelled) return;
        if (document.visibilityState === "visible") {
          await refreshSharedLiveQuotes();
        }
        scheduleNext();
      }, delay);
    };

    scheduleNext();
    const onVisible = () => {
      if (document.visibilityState === "visible") void refreshSharedLiveQuotes();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      document.removeEventListener("visibilitychange", onVisible);
    };
    // Keyed by shared holdings fingerprint, not live quote updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHydrated, selectedSharedProfileId, sharedMarketSymbolKey]);

  const storeAnalysisSession = (session: AnalysisSession) => {
    setAnalysisSession(session);
    writeAnalysisSession(user?.id ?? "guest", session);
  };

  const analyze = async (options?: { resume?: boolean; force?: boolean }) => {
    const requestId = analysisRequestId.current + 1;
    analysisRequestId.current = requestId;
    const profileIdAtStart = activeProfile?.id || activeProfileId;
    const inputKeyAtStart = holdingInputKeyRef.current;
    const isLatestAnalysis = () => analysisRequestId.current === requestId && activeProfileIdRef.current === profileIdAtStart && holdingInputKeyRef.current === inputKeyAtStart;
    setIsAnalyzing(true);
    const userId = user?.id ?? "guest";
    const cachedEntry = cacheEntryForProfile(dailyAiCacheRef.current, profileIdAtStart, region);

    if (!options?.force && !options?.resume && cachedEntry) {
      setHoldings((currentItems) => applyDailyAiCacheToHoldings(currentItems, cachedEntry));
      setWarnings([
        `Applied today's cached AI analysis (${cachedEntry.runType} run at ${new Date(cachedEntry.generatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}). Use Refresh AI for a new manual Gemini call.`
      ]);
      setIsAnalyzing(false);
      return;
    }

    setWarnings([
      options?.force
        ? "Running a manual AI refresh (uses an extra Gemini call for this profile)."
        : "Refreshing quotes before AI analysis. News comes from the grounded AI run, not Alpha Vantage."
    ]);
    try {
      const withMarket = await refreshMarketData({ showLoading: true, showWarnings: true, quotesOnly: true });
      if (!withMarket || !isLatestAnalysis()) return;
      const aiConfig = await fetch("/api/aiConfig")
        .then((response) => response.json() as Promise<{ requestGapMs?: number; model?: string }>)
        .catch(() => null);
      const analyzeModel = aiConfig?.model ?? geminiModelName();
      const initialCoverage = analysisCoverage(withMarket);
      const holdingsToAnalyze = withMarket.filter((holding) => isQuotableQuote(holding.quote) && (!options?.resume || !holding.analysis));
      const skippedHoldings = withMarket.filter((holding) => holding.quote !== undefined && !isQuotableQuote(holding.quote));
      const startingCompleted = options?.resume ? initialCoverage.analyzed : 0;
      const completedSymbols = options?.resume ? [...initialCoverage.analyzedSymbols] : [];
      const pendingSymbols = holdingsToAnalyze.map((holding) => holding.symbol.trim().toUpperCase());

      if (skippedHoldings.length) {
        const skipWarnings = skippedHoldings.map((holding) => (
          `${holding.symbol.trim().toUpperCase()} skipped — no live quote available for AI analysis.`
        ));
        setWarnings((existing) => [...existing, ...skipWarnings]);
      }

      storeAnalysisSession(buildAnalysisSession({
        profileId: profileIdAtStart,
        inputKey: inputKeyAtStart,
        phase: "market",
        completed: startingCompleted,
        total: initialCoverage.total,
        currentSymbol: null,
        model: analyzeModel,
        completedSymbols,
        pendingSymbols
      }));

      storeAnalysisSession(buildAnalysisSession({
        profileId: profileIdAtStart,
        inputKey: inputKeyAtStart,
        phase: "analyzing",
        completed: startingCompleted,
        total: initialCoverage.total,
        currentSymbol: holdingsToAnalyze[0]?.symbol.trim().toUpperCase() || null,
        model: analyzeModel,
        completedSymbols,
        pendingSymbols
      }));

      const warningsToAdd: string[] = [];

      if (holdingsToAnalyze.length) {
        storeAnalysisSession(buildAnalysisSession({
          profileId: profileIdAtStart,
          inputKey: inputKeyAtStart,
          phase: "analyzing",
          completed: startingCompleted,
          total: initialCoverage.total,
          currentSymbol: pendingSymbols[0] || null,
          model: analyzeModel,
          completedSymbols: [...completedSymbols],
          pendingSymbols: [...pendingSymbols]
        }));

        const authHeaders: Record<string, string> = { "Content-Type": "application/json" };
        if (supabase) {
          const { data: sessionData } = await supabase.auth.getSession();
          const token = sessionData.session?.access_token;
          if (token) authHeaders.Authorization = `Bearer ${token}`;
        }

        const response = await fetch("/api/analyzePortfolio", {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({
            region,
            currency,
            profileId: profileIdAtStart,
            force: options?.force === true,
            clientDailyAiCache: dailyAiCacheRef.current,
            items: holdingsToAnalyze.map((holding) => ({
              holding: toHoldingInput(holding),
              quote: holding.quote,
              news: holding.news.slice(0, 12)
            }))
          })
        });
        const data = await readJsonResponse<PortfolioAnalysisApiResponse>(response);
        if (!response.ok) throw new Error(data.error || "Portfolio analysis failed");
        if (!isLatestAnalysis()) return;

        if (data.cacheEntry) {
          const nextCache = upsertDailyAiCacheEntry(dailyAiCacheRef.current, data.cacheEntry);
          setDailyAiCache(nextCache);
          writeLocalDailyAiCache(userId, nextCache);
        }

        const analysisById = new Map((data.results ?? []).map((item) => [item.id, item.analysis]));
        const merged: AnalyzedHoldingResult[] = holdingsToAnalyze.map((holding) => ({
          id: holding.id,
          quote: holding.quote,
          news: holding.news,
          analysis: analysisById.get(holding.id) ?? holding.analysis
        }));
        setHoldings((currentItems) => applyAnalyzedHoldingResults(currentItems, merged));
        if (data.warning) warningsToAdd.push(data.warning);
      }

      if (!isLatestAnalysis()) return;
      const normalizedWarnings = warningsToAdd.filter(Boolean).map(normalizeWarning);
      if (normalizedWarnings.length) setWarnings((existing) => [...existing, ...normalizedWarnings]);
      clearAnalysisSession(userId);
      setAnalysisSession(null);
    } catch (error) {
      const coverage = analysisCoverage(holdings);
      storeAnalysisSession(buildAnalysisSession({
        profileId: profileIdAtStart,
        inputKey: inputKeyAtStart,
        phase: "interrupted",
        completed: coverage.analyzed,
        total: coverage.total,
        currentSymbol: null,
        model: analysisSession?.model ?? geminiModelName(),
        completedSymbols: coverage.analyzedSymbols,
        pendingSymbols: coverage.pendingSymbols
      }));
      setWarnings((existing) => [...existing, error instanceof Error ? error.message : "Analysis failed"]);
    } finally {
      if (analysisRequestId.current === requestId) setIsAnalyzing(false);
    }
  };

  const clearStored = () => {
    clearLegacyPortfolioKeys();
    clearPortfolioCache("guest");
    if (user) clearPortfolioCache(user.id);
    localStorage.removeItem(LEGACY_USER_PREFS_KEY);
    localStorage.removeItem(userPrefsStorageKey("guest"));
    if (user) localStorage.removeItem(userPrefsStorageKey(user.id));
    sessionPortfolioEditedRef.current = false;
    cloudPortfolioUpdatedAtRef.current = null;
    cloudHoldingCountRef.current = 0;
    latestSyncKey.current = "";
    const nextProfiles = defaultProfiles();
    setProfiles(nextProfiles);
    setActiveProfileId(nextProfiles[0].id);
    setDisplayName("Friend");
    setShareHoldings(false);
    setWarnings(["Stored portfolio data cleared."]);
  };

  const signIn = async (identifier: string, password: string, mode: "signin" | "signup", signupDisplayName?: string) => {
    if (!supabase) return;
    setIsAuthLoading(true);
    const emailRedirectTo = typeof window !== "undefined" ? window.location.origin : "https://portfolio-exit-planner.vercel.app";
    const trimmedIdentifier = identifier.trim();
    if (mode === "signup" && !trimmedIdentifier.includes("@")) {
      setIsAuthLoading(false);
      setWarnings((existing) => [...existing, "Create an account with an email address. You can choose a display name separately."]);
      return;
    }
    let authEmail = trimmedIdentifier;
    if (mode === "signin" && !trimmedIdentifier.includes("@")) {
      try {
        const response = await fetch("/api/resolveLoginIdentifier", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ identifier: trimmedIdentifier })
        });
        const data = await readJsonResponse<LoginIdentifierResponse>(response);
        if (!response.ok || !data.email) throw new Error(data.error || "Display name login failed");
        authEmail = data.email;
      } catch (error) {
        setIsAuthLoading(false);
        setWarnings((existing) => [...existing, error instanceof Error ? error.message : "Display name login failed"]);
        return;
      }
    }
    const normalizedSignupName = normalizeDisplayName(signupDisplayName || friendlyNameFromEmail(authEmail));
    const result = mode === "signin"
      ? await supabase.auth.signInWithPassword({ email: authEmail, password })
      : await supabase.auth.signUp({
        email: authEmail,
        password,
        options: {
          emailRedirectTo,
          data: { full_name: normalizedSignupName, name: normalizedSignupName }
        }
      });
    setIsAuthLoading(false);
    if (result.error) {
      setWarnings((existing) => [...existing, result.error.message]);
      return;
    }
    if (mode === "signup" && !result.data.session) {
      setDisplayName(normalizedSignupName);
      setWarnings((existing) => [...existing, "Account created. Check your email to confirm before signing in."]);
    } else {
      if (mode === "signup") applyEmptyPortfolioBootstrap();
      setWarnings((existing) => [...existing, "Signed in. Cloud sync will load once and then save changes automatically."]);
    }
  };

  const signOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
    setWarnings((existing) => [...existing, "Signed out. Local portfolio data remains on this device."]);
  };

  const saveCloudPortfolio = async (payload: string) => {
    if (!supabase || !user) return false;
    setCloudSyncStatus("saving");
    setCloudSyncMessage("Saving changes to cloud...");
    let parsedPayload: CloudPortfolioPayload;
    try {
      parsedPayload = JSON.parse(payload) as CloudPortfolioPayload;
    } catch {
      setCloudSyncStatus("error");
      setCloudSyncMessage("Cloud save failed: portfolio payload could not be serialized.");
      return false;
    }
    let cloudProfilesForMerge = lastCloudProfilesRef.current;
    const cloudSnapshot = await supabase
      .from("user_portfolios")
      .select("holdings")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!cloudSnapshot.error && cloudSnapshot.data?.holdings) {
      const loadedCloudProfiles = profilesFromCloudPortfolioRow({ holdings: cloudSnapshot.data.holdings, settings: {} });
      if (loadedCloudProfiles.length) cloudProfilesForMerge = sanitizeProfilesForPersistence(loadedCloudProfiles);
    }
    const mergedProfiles = sanitizeProfilesForPersistence(mergeProfilesForCloudSave(
      parsedPayload.profiles,
      cloudProfilesForMerge,
      sessionEditedHoldingsProfileIdsRef.current
    ));
    const cloudSettings = {
      activeProfileId: parsedPayload.activeProfileId,
      profilesVersion: 2,
      displayName: normalizeDisplayName(parsedPayload.displayName || displayName),
      shareHoldings: Boolean(parsedPayload.shareHoldings),
      dailyReportEmail: parsedPayload.dailyReportEmail || "",
      dailyReportEmailEnabled: Boolean(parsedPayload.dailyReportEmailEnabled),
      dailyAiCache: dailyAiCacheRef.current
    };
    const { error } = await supabase.from("user_portfolios").upsert({
      user_id: user.id,
      holdings: mergedProfiles,
      settings: cloudSettings,
      display_name: cloudSettings.displayName,
      share_holdings: cloudSettings.shareHoldings,
      updated_at: new Date().toISOString()
    });
    if (error) {
      if (isMissingSharedColumnsError(error)) {
        const { error: legacyError } = await supabase.from("user_portfolios").upsert({
          user_id: user.id,
          holdings: mergedProfiles,
          settings: cloudSettings,
          updated_at: new Date().toISOString()
        });
        if (!legacyError) {
          setCloudSyncStatus("saved");
          setCloudSyncMessage("Saved to cloud. Shared holdings need the updated Supabase SQL/schema cache before friends can view them.");
          return true;
        }
      }
      setCloudSyncStatus("error");
      setCloudSyncMessage(`Cloud save failed: ${error.message}`);
      return false;
    }
    const savedAt = new Date().toISOString();
    cloudShareHoldingsRef.current = cloudSettings.shareHoldings;
    cloudDailyReportEmailRef.current = cloudSettings.dailyReportEmail || "";
    cloudDailyReportEmailEnabledRef.current = Boolean(cloudSettings.dailyReportEmailEnabled);
    cloudPortfolioUpdatedAtRef.current = savedAt;
    cloudHoldingCountRef.current = portfolioHoldingSymbols(mergedProfiles).length;
    lastCloudProfilesRef.current = mergedProfiles;
    sessionPortfolioEditedRef.current = false;
    sessionEditedHoldingsProfileIdsRef.current = new Set();
    latestSyncKey.current = profilesSyncKey(
      mergedProfiles,
      parsedPayload.activeProfileId,
      cloudSettings.displayName,
      cloudSettings.shareHoldings
    );
    persistSignedInPortfolioCache(portfolioSnapshotFromProfiles(
      mergedProfiles,
      parsedPayload.activeProfileId,
      savedAt,
      null
    ));
    setCloudSyncStatus("saved");
    setCloudSyncMessage(`Saved to cloud at ${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.`);
    void loadSharedProfiles();
    return true;
  };

  const loadSharedProfiles = async () => {
    if (!supabase || !user) return;
    setIsLoadingSharedProfiles(true);
    const { data, error } = await supabase
      .from("user_portfolios")
      .select("user_id, display_name, holdings, settings, updated_at")
      .eq("share_holdings", true)
      .order("updated_at", { ascending: false });
    setIsLoadingSharedProfiles(false);
    if (error) {
      setWarnings((existing) => [
        ...existing,
        isMissingSharedColumnsError(error)
          ? "Shared holdings are not active yet. Run the updated Supabase SQL, then reload the schema cache."
          : `Shared portfolios failed to load: ${error.message}`
      ]);
      return;
    }
    const entries = ((data || []) as CloudPortfolioRow[]).filter((row) => row.user_id !== user.id).flatMap((row) => {
      const display = normalizeDisplayName(row.display_name || "Friend");
      const loadedProfiles = coerceProfiles(row.holdings, DEFAULT_SETTINGS);
      return loadedProfiles.map((profile) => ({
        id: `${row.user_id || display}:${profile.id}`,
        userId: row.user_id || "",
        displayName: display,
        profile,
        updatedAt: row.updated_at || undefined
      }));
    });
    setSharedProfiles(entries);
    setSelectedSharedProfileId((existing) => existing === OWN_HOLDINGS_VIEW_ID || entries.some((entry) => sharedUserViewId(entry) === existing) ? existing : OWN_HOLDINGS_VIEW_ID);
  };

  const resolveCloudPortfolioRow = (row: CloudPortfolioRow) => {
    const cloudSettings: CloudSettings = cloudSettingsFromRow(row);
    const resolvedProfiles = sanitizeProfilesForPersistence(profilesFromCloudPortfolioRow(row));
    const resolvedActiveProfileId = activeProfileIdFromCloudPortfolioRow(row, resolvedProfiles);
    const resolvedDisplayName = normalizeDisplayName(row.display_name || cloudSettings.displayName || friendlyNameForUser(user!));
    const resolvedShareHoldings = Boolean(row.share_holdings ?? cloudSettings.shareHoldings);
    const resolvedDailyReportEmail = dailyReportEmailPrefsFromSettings(cloudSettings);
    return {
      snapshot: portfolioSnapshotFromProfiles(resolvedProfiles, resolvedActiveProfileId, row.updated_at || null),
      resolvedDisplayName,
      resolvedShareHoldings,
      resolvedDailyReportEmail,
      cloudSettings
    };
  };

  const loadCloudPortfolio = async (options?: { force?: boolean }) => {
    if (!supabase || !user) return;
    if (!options?.force && cloudLoadedUserId === user.id) return;
    if (cloudLoadInFlightRef.current) return;
    cloudLoadInFlightRef.current = true;
    setIsAuthLoading(true);
    setCloudSyncStatus("loading");
    setCloudSyncMessage("Loading cloud portfolio...");
    try {
      const initialResult = await supabase.from("user_portfolios").select("holdings, settings, display_name, share_holdings, updated_at").eq("user_id", user.id).maybeSingle();
      let data = initialResult.data as CloudPortfolioRow | null;
      let error = initialResult.error;
      if (isMissingSharedColumnsError(error)) {
        const fallback = await supabase.from("user_portfolios").select("holdings, settings, updated_at").eq("user_id", user.id).maybeSingle();
        data = fallback.data as CloudPortfolioRow | null;
        error = fallback.error;
        setWarnings((existing) => [...existing, "Shared holdings need the updated Supabase SQL/schema cache. Cloud sync will keep working privately for now."]);
      }
      if (error) {
        setCloudLoadedUserId(user.id);
        setCloudSyncStatus("error");
        setCloudSyncMessage(isAdmin ? `Cloud load failed: ${error.message}` : "Cloud load failed. Ask the admin to check setup.");
        return;
      }
      if (!data) {
        const bootstrap = applyEmptyPortfolioBootstrap();
        const resolvedName = normalizeDisplayName(friendlyNameForUser(user));
        setCloudLoadedUserId(user.id);
        setDisplayName(resolvedName);
        applyShareHoldingsFromCloud(false);
        latestSyncKey.current = profilesSyncKey(bootstrap.profiles, bootstrap.activeProfileId, resolvedName, false);
        persistSignedInPortfolioCache(portfolioSnapshotFromProfiles(bootstrap.profiles, bootstrap.activeProfileId, null));
        setCloudSyncStatus("saved");
        setCloudSyncMessage("New account started with empty portfolios. Add holdings to begin.");
        void loadSharedProfiles();
        return;
      }

      const { snapshot, resolvedDisplayName, resolvedShareHoldings, resolvedDailyReportEmail, cloudSettings } = resolveCloudPortfolioRow(data);
      const localCache = readPortfolioCache(user.id);
      const resolvedPrefs = resolveUserPrefsForSync({
        local: {
          displayName: normalizeDisplayName(displayNameRef.current),
          shareHoldings: shareHoldingsRef.current,
          dailyReportEmail: dailyReportEmailRef.current,
          dailyReportEmailEnabled: dailyReportEmailEnabledRef.current
        },
        cloudDisplayName: data.display_name ?? cloudSettings.displayName,
        cloudShareHoldings: data.share_holdings ?? cloudSettings.shareHoldings,
        cloudDailyReportEmail: resolvedDailyReportEmail.dailyReportEmail,
        cloudDailyReportEmailEnabled: resolvedDailyReportEmail.dailyReportEmailEnabled,
        localIsNewer: Boolean(localCache?.localUpdatedAt && data.updated_at && new Date(localCache.localUpdatedAt) > new Date(data.updated_at)),
        shareHoldingsTouched: shareHoldingsTouchedRef.current,
        dailyReportEmailTouched: dailyReportEmailTouchedRef.current
      });
      if (localCache && shouldPreferLocalPortfolioCache(localCache, snapshot.profiles, data.updated_at)) {
        cloudShareHoldingsRef.current = resolvedPrefs.shareHoldings;
        if (!shareHoldingsTouchedRef.current) setShareHoldings(resolvedPrefs.shareHoldings);
        if (!dailyReportEmailTouchedRef.current) applyDailyReportEmailFromCloud(
          resolvedPrefs.dailyReportEmail || "",
          Boolean(resolvedPrefs.dailyReportEmailEnabled)
        );
        setDisplayName(resolvedPrefs.displayName);
        setCloudLoadedUserId(user.id);
        setProfiles(localCache.profiles);
        setActiveProfileId(localCache.activeProfileId);
        sessionPortfolioEditedRef.current = true;
        setCloudSyncStatus("saving");
        setCloudSyncMessage("Restoring newer local portfolio changes to cloud...");
        void pushCloudPortfolioNowRef.current({
          displayName: resolvedPrefs.displayName,
          shareHoldings: resolvedPrefs.shareHoldings
        });
        void loadSharedProfiles();
        return;
      }
      const keepLocalPortfolio = shouldKeepSessionPortfolioEdits(
        profilesRef.current,
        snapshot.profiles,
        sessionPortfolioEditedRef.current
      );

      if (keepLocalPortfolio) {
        cloudShareHoldingsRef.current = resolvedPrefs.shareHoldings;
        if (!shareHoldingsTouchedRef.current) setShareHoldings(resolvedPrefs.shareHoldings);
        if (!dailyReportEmailTouchedRef.current) applyDailyReportEmailFromCloud(
          resolvedPrefs.dailyReportEmail || "",
          Boolean(resolvedPrefs.dailyReportEmailEnabled)
        );
        setDisplayName(resolvedPrefs.displayName);
        setCloudLoadedUserId(user.id);
        setCloudSyncStatus("saving");
        setCloudSyncMessage("Saving your portfolio changes to cloud...");
        const payload = buildCloudPayload(
          profilesRef.current,
          activeProfileIdRef.current,
          resolvedPrefs.displayName,
          resolvedPrefs.shareHoldings,
          resolvedPrefs.dailyReportEmail || "",
          Boolean(resolvedPrefs.dailyReportEmailEnabled)
        );
        const syncKey = profilesSyncKey(
          profilesRef.current,
          activeProfileIdRef.current,
          resolvedPrefs.displayName,
          resolvedPrefs.shareHoldings
        );
        void saveCloudPortfolio(payload).then((saved) => {
          if (saved) latestSyncKey.current = syncKey;
        });
        void loadSharedProfiles();
        return;
      }

      applyCloudPortfolioSnapshot({
        ...snapshot,
        profiles: mergeProfilesWithDailyAiCache(snapshot.profiles, parseDailyAiCache(cloudSettings.dailyAiCache))
      }, {
        displayName: resolvedDisplayName,
        shareHoldings: resolvedShareHoldings,
        cloudUpdatedAt: data.updated_at || null
      });
      setDailyAiCache(parseDailyAiCache(cloudSettings.dailyAiCache));
      if (!shareHoldingsTouchedRef.current) {
        setDisplayName(resolvedPrefs.displayName);
        applyShareHoldingsFromCloud(resolvedPrefs.shareHoldings);
        cloudShareHoldingsRef.current = resolvedPrefs.shareHoldings;
      }
      if (!dailyReportEmailTouchedRef.current) {
        applyDailyReportEmailFromCloud(
          resolvedPrefs.dailyReportEmail || "",
          Boolean(resolvedPrefs.dailyReportEmailEnabled)
        );
      }
      clearLegacyPortfolioKeys();
      setCloudLoadedUserId(user.id);
      setCloudSyncStatus("saved");
      setCloudSyncMessage("Cloud portfolio loaded. Changes save automatically.");
      void loadSharedProfiles();
    } finally {
      cloudLoadInFlightRef.current = false;
      setIsAuthLoading(false);
    }
  };

  const pullCloudPortfolioIfNewer = async () => {
    if (!supabase || !user || cloudLoadedUserId !== user.id || sessionPortfolioEditedRef.current) return;
    const { data, error } = await supabase
      .from("user_portfolios")
      .select("holdings, settings, display_name, share_holdings, updated_at")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error || !data?.updated_at) return;
    if (cloudPortfolioUpdatedAtRef.current && new Date(data.updated_at) <= new Date(cloudPortfolioUpdatedAtRef.current)) return;

    const { snapshot, resolvedDisplayName, resolvedShareHoldings } = resolveCloudPortfolioRow(data as CloudPortfolioRow);
    if (shouldKeepSessionPortfolioEdits(profilesRef.current, snapshot.profiles, sessionPortfolioEditedRef.current)) return;

    applyCloudPortfolioSnapshot(snapshot, {
      displayName: resolvedDisplayName,
      shareHoldings: resolvedShareHoldings,
      cloudUpdatedAt: data.updated_at
    });
    setCloudSyncMessage("Loaded newer cloud portfolio.");
  };

  useEffect(() => {
    if (!supabase || !user || !isHydrated) return;
    void loadCloudPortfolio();
    // loadCloudPortfolio is guarded by cloudLoadedUserId and should run once per signed-in user.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, user, isHydrated, cloudLoadedUserId]);

  useEffect(() => {
    if (!user || cloudLoadedUserId !== user.id) return;
    const refresh = () => {
      if (document.visibilityState === "visible") void pullCloudPortfolioIfNewer();
    };
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, cloudLoadedUserId]);

  useEffect(() => {
    if (!supabase || !user || !isHydrated || cloudLoadedUserId !== user.id) return;
    if (currentProfilesSyncKey === latestSyncKey.current) return;
    if (shouldSkipEmptyCloudOverwrite(profilesRef.current, cloudHoldingCountRef.current, sessionPortfolioEditedRef.current)) {
      return;
    }
    const timeout = window.setTimeout(() => {
      if (shouldSkipEmptyCloudOverwrite(profilesRef.current, cloudHoldingCountRef.current, sessionPortfolioEditedRef.current)) {
        return;
      }
      const resolvedShareHoldings = shareHoldingsForCloudSave();
      const payload = buildCloudPayload(
        profilesRef.current,
        activeProfileIdRef.current,
        displayNameRef.current,
        resolvedShareHoldings,
        dailyReportEmailForCloudSave(),
        dailyReportEmailEnabledForCloudSave()
      );
      const syncKey = profilesSyncKey(
        profilesRef.current,
        activeProfileIdRef.current,
        displayNameRef.current,
        resolvedShareHoldings
      );
      void saveCloudPortfolio(payload).then((saved) => {
        if (saved) latestSyncKey.current = syncKey;
      });
    }, 500);
    return () => window.clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, user, isHydrated, cloudLoadedUserId, currentProfilesSyncKey]);

  const addProfile = () => {
    touchPortfolioSave();
    const id = crypto.randomUUID();
    const nextProfile: PortfolioProfile = {
      id,
      name: profileNameForCount(profiles.length),
      region,
      currency,
      holdings: [],
      settings: DEFAULT_SETTINGS
    };
    setProfiles((items) => [...items, nextProfile]);
    setActiveProfileId(id);
  };

  const deleteProfile = (id: string) => {
    touchPortfolioSave();
    setProfiles((items) => {
      if (items.length <= 1) return items;
      const nextProfiles = items.filter((profile) => profile.id !== id);
      if (activeProfileId === id) setActiveProfileId(nextProfiles[0].id);
      return nextProfiles;
    });
  };

  const updateProfile = (nextProfile: PortfolioProfile) => {
    touchPortfolioSave();
    setProfiles((items) => items.map((profile) => profile.id === nextProfile.id ? nextProfile : profile));
  };

  const pushCloudPortfolioNow = async (override?: {
    displayName?: string;
    shareHoldings?: boolean;
    dailyReportEmail?: string;
    dailyReportEmailEnabled?: boolean;
  }) => {
    if (!supabase || !user || cloudLoadedUserId !== user.id) return;
    const resolvedDisplayName = normalizeDisplayName(override?.displayName ?? displayNameRef.current);
    const resolvedShareHoldings = override?.shareHoldings ?? shareHoldingsForCloudSave();
    const resolvedDailyReportEmail = override?.dailyReportEmail ?? dailyReportEmailForCloudSave();
    const resolvedDailyReportEmailEnabled = override?.dailyReportEmailEnabled ?? dailyReportEmailEnabledForCloudSave();
    const payload = buildCloudPayload(
      profilesRef.current,
      activeProfileIdRef.current,
      resolvedDisplayName,
      resolvedShareHoldings,
      resolvedDailyReportEmail,
      resolvedDailyReportEmailEnabled
    );
    const syncKey = profilesSyncKey(
      profilesRef.current,
      activeProfileIdRef.current,
      resolvedDisplayName,
      resolvedShareHoldings
    );
    const saved = await saveCloudPortfolio(payload);
    if (saved) latestSyncKey.current = syncKey;
  };
  pushCloudPortfolioNowRef.current = pushCloudPortfolioNow;

  useEffect(() => {
    if (!user) return;
    const flushPendingCloudSave = () => {
      if (!sessionPortfolioEditedRef.current) return;
      persistLocalPortfolioBackup();
      if (cloudLoadedUserId !== user.id) return;
      if (cloudSaveTimeout.current) window.clearTimeout(cloudSaveTimeout.current);
      void pushCloudPortfolioNowRef.current();
    };
    window.addEventListener("pagehide", flushPendingCloudSave);
    return () => window.removeEventListener("pagehide", flushPendingCloudSave);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, cloudLoadedUserId]);

  const handleDisplayNameChange = (nextDisplayName: string) => {
    setDisplayName(nextDisplayName);
  };

  const handleDisplayNameCommit = (nextDisplayName: string) => {
    const normalized = normalizeDisplayName(nextDisplayName);
    setDisplayName(normalized);
    if (displayNameSaveTimeout.current) window.clearTimeout(displayNameSaveTimeout.current);
    displayNameSaveTimeout.current = window.setTimeout(() => {
      void pushCloudPortfolioNow({ displayName: normalized });
    }, 400);
  };

  const handleShareHoldingsChange = (nextShareHoldings: boolean) => {
    shareHoldingsTouchedRef.current = true;
    cloudShareHoldingsRef.current = nextShareHoldings;
    setShareHoldings(nextShareHoldings);
    void pushCloudPortfolioNow({ shareHoldings: nextShareHoldings });
  };

  const handleDailyReportEmailChange = (next: { email: string; enabled: boolean }) => {
    dailyReportEmailTouchedRef.current = true;
    cloudDailyReportEmailRef.current = next.email;
    cloudDailyReportEmailEnabledRef.current = next.enabled;
    setDailyReportEmail(next.email);
    setDailyReportEmailEnabled(next.enabled);
    void pushCloudPortfolioNow({
      dailyReportEmail: next.email,
      dailyReportEmailEnabled: next.enabled
    });
  };

  const handleSendTestDailyReportEmail = async (email: string): Promise<{ ok: boolean; message: string }> => {
    if (!supabase) return { ok: false, message: "Sign in to send a test email." };
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return { ok: false, message: "Session expired. Sign in again." };
    const response = await fetch("/api/daily-report-email/test", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ email })
    });
    const body = await response.json() as { message?: string; error?: string };
    if (!response.ok) {
      return { ok: false, message: body.error || "Test email failed." };
    }
    return { ok: true, message: body.message || "Test email sent." };
  };

  const handleQuickAdd = (holding: HoldingInput) => {
    const message = getUnsupportedTickerMessage(holding.symbol, region);
    if (message) {
      setWarnings((existing) => [...existing, message]);
      return;
    }
    touchHoldingsEdit();
    const normalized = reconcileHolding(holding);
    const symbol = normalized.symbol.trim().toUpperCase();
    const existingIndex = inputRows.findIndex((row) => row.symbol.trim().toUpperCase() === symbol);
    if (existingIndex >= 0) {
      const existing = inputRows[existingIndex];
      const merged = mergeBuyIntoHolding(existing, normalized.shares, normalized.averageCost);
      const next = [...inputRows];
      next[existingIndex] = {
        ...existing,
        ...merged,
        name: existing.name || normalized.name,
        notes: existing.notes || normalized.notes
      };
      setInputRows(next);
    } else {
      setInputRows([...inputRows, normalized]);
    }
    setQuickAddFocusToken((token) => token + 1);
  };

  const prefsSyncHint = cloudSyncStatus === "saving" ? "Saving…" : cloudSyncStatus === "saved" ? "Saved" : undefined;
  const syncLabel = isAdmin ? cloudSyncMessage : cloudSyncStatus === "error" ? "Sync issue" : cloudSyncStatus === "saved" ? "Synced" : cloudSyncStatus === "saving" ? "Saving…" : cloudSyncStatus === "loading" ? "Loading…" : "Cloud sync";
  const syncBadge = user ? (
    <div className={`inline-flex min-h-8 items-center gap-1.5 rounded-md border px-2 py-1 text-xs md:min-h-11 md:gap-2 md:px-3 md:py-2 md:text-sm ${syncBadgeClass(cloudSyncStatus)}`} title={cloudSyncMessage}>
      {syncBadgeIcon(cloudSyncStatus)}
      <span className="max-w-[4.5rem] truncate md:max-w-xs">{syncLabel}</span>
    </div>
  ) : undefined;
  const viewingSharedPortfolio = Boolean(selectedSharedProfile);

  const holdingsTable = (
    <HoldingsTable
      holdings={displayedHoldings}
      settings={displayedSettings}
      currency={displayedCurrency}
      onChange={viewingSharedPortfolio ? undefined : updateHolding}
      onApplySale={viewingSharedPortfolio ? undefined : handleApplySale}
      readOnly={viewingSharedPortfolio}
    />
  );

  const quickAddForm = viewingSharedPortfolio ? null : (
    <QuickAddHolding
      ref={quickAddRef}
      onAdd={handleQuickAdd}
      region={region}
      focusToken={quickAddFocusToken}
      disabled={isAuthLoading}
      expanded={quickAddExpanded}
      onExpandedChange={setQuickAddExpanded}
    />
  );

  const settingsToolsContent = (
    <>
      <AuthPanel
        user={user}
        isAdmin={isAdmin}
        isLoading={isAuthLoading}
        syncStatus={cloudSyncStatus}
        syncMessage={cloudSyncMessage}
        displayName={displayName}
        variant="compact"
        onDisplayNameChange={handleDisplayNameChange}
        onDisplayNameCommit={handleDisplayNameCommit}
        onSignIn={signIn}
        onSignOut={signOut}
      />
      <SharedHoldingsViewer
        isLoading={isLoadingSharedProfiles}
        shareHoldings={shareHoldings}
        syncHint={prefsSyncHint}
        onShareHoldingsChange={handleShareHoldingsChange}
      />
      <DailyReportEmailSettings
        signedIn={Boolean(user)}
        accountEmail={user?.email}
        email={dailyReportEmail}
        enabled={dailyReportEmailEnabled}
        syncHint={prefsSyncHint}
        onChange={handleDailyReportEmailChange}
        onSendTest={handleSendTestDailyReportEmail}
      />
      <SettingsPanel settings={settings} currency={currency} onChange={setSettings} onClear={clearStored} />
      <ImageImport
        onExtracted={(rows) => {
          touchHoldingsEdit();
          const blocked = rows.filter((row) => isUnsupportedTicker(row.symbol, region));
          setHoldings((existing) => mergeExtractedRows(existing, rows, region));
          setWarnings((existing) => {
            const next = [...existing, `${rows.length} image row${rows.length === 1 ? "" : "s"} added or updated. Confirm every field before analysis.`];
            blocked.forEach((row) => {
              const message = getUnsupportedTickerMessage(row.symbol, region);
              if (message) next.push(message);
            });
            return next;
          });
        }}
        setWarning={(warning) => setWarnings((existing) => [...existing, warning])}
      />
    </>
  );

  const mobileSettings = (
    <div className="space-y-3 pb-2">
      <AuthPanel
        user={user}
        isAdmin={isAdmin}
        isLoading={isAuthLoading}
        syncStatus={cloudSyncStatus}
        syncMessage={cloudSyncMessage}
        displayName={displayName}
        variant="compact"
        onDisplayNameChange={handleDisplayNameChange}
        onDisplayNameCommit={handleDisplayNameCommit}
        onSignIn={signIn}
        onSignOut={signOut}
      />
      <SharedHoldingsViewer
        isLoading={isLoadingSharedProfiles}
        shareHoldings={shareHoldings}
        syncHint={prefsSyncHint}
        onShareHoldingsChange={handleShareHoldingsChange}
      />
      <DailyReportEmailSettings
        signedIn={Boolean(user)}
        accountEmail={user?.email}
        email={dailyReportEmail}
        enabled={dailyReportEmailEnabled}
        syncHint={prefsSyncHint}
        onChange={handleDailyReportEmailChange}
        onSendTest={handleSendTestDailyReportEmail}
      />
      <ProfileSelector
        profiles={profiles}
        activeProfileId={activeProfile?.id || activeProfileId}
        onActiveChange={setActiveProfileId}
        onAdd={addProfile}
        onDelete={deleteProfile}
        onUpdate={updateProfile}
      />
      <SettingsPanel settings={settings} currency={currency} onChange={setSettings} onClear={clearStored} />
      <ImageImport
        onExtracted={(rows) => {
          touchHoldingsEdit();
          const blocked = rows.filter((row) => isUnsupportedTicker(row.symbol, region));
          setHoldings((existing) => mergeExtractedRows(existing, rows, region));
          setWarnings((existing) => {
            const next = [...existing, `${rows.length} image row${rows.length === 1 ? "" : "s"} added or updated. Confirm every field before analysis.`];
            blocked.forEach((row) => {
              const message = getUnsupportedTickerMessage(row.symbol, region);
              if (message) next.push(message);
            });
            return next;
          });
        }}
        setWarning={(warning) => setWarnings((existing) => [...existing, warning])}
      />
    </div>
  );

  const analysisProgressBanner = !viewingSharedPortfolio && (portfolioAnalysisCoverage.total > 0 || portfolioAnalysisCoverage.skippedSymbols.length > 0) ? (
    <AnalysisProgressBanner
      phase={isAnalyzing ? (analysisSession?.phase ?? "analyzing") : (analysisSession?.phase ?? (portfolioAnalysisCoverage.analyzed >= portfolioAnalysisCoverage.total ? "complete" : "idle"))}
      completed={isAnalyzing ? (analysisSession?.completed ?? portfolioAnalysisCoverage.analyzed) : portfolioAnalysisCoverage.analyzed}
      total={analysisSession?.total ?? portfolioAnalysisCoverage.total}
      currentSymbol={isAnalyzing ? (analysisSession?.currentSymbol ?? null) : null}
      model={analysisSession?.model ?? geminiModelName()}
      completedSymbols={isAnalyzing ? (analysisSession?.completedSymbols ?? portfolioAnalysisCoverage.analyzedSymbols) : portfolioAnalysisCoverage.analyzedSymbols}
      pendingSymbols={isAnalyzing ? (analysisSession?.pendingSymbols ?? portfolioAnalysisCoverage.pendingSymbols) : portfolioAnalysisCoverage.pendingSymbols}
      skippedSymbols={portfolioAnalysisCoverage.skippedSymbols}
      isActive={isAnalyzing}
      onResume={analysisSession?.phase === "interrupted" ? () => void analyze({ resume: true }) : undefined}
    />
  ) : null;

  const workspaceProps = {
    hasHoldings: displayedHoldings.some((holding) => holding.symbol),
    readOnly: viewingSharedPortfolio,
    onAddFirstHolding: () => {
      setQuickAddExpanded(true);
      setQuickAddFocusToken((token) => token + 1);
    },
    onFabClick: () => {
      setQuickAddExpanded(true);
      quickAddRef.current?.expand();
      quickAddRef.current?.focusSymbol();
      document.getElementById("portfolio-workspace")?.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    showFab: !viewingSharedPortfolio,
    compactProfileBar: (
      <MobileContextBar
        profiles={profiles}
        activeProfileId={activeProfile?.id || activeProfileId}
        onActiveChange={setActiveProfileId}
        holdingsViewOptions={holdingsViewOptions}
        selectedViewId={selectedSharedProfileId}
        onViewChange={setSelectedSharedProfileId}
      />
    ),
    profileBar: (
      <ProfileSelector
        profiles={profiles}
        activeProfileId={activeProfile?.id || activeProfileId}
        onActiveChange={setActiveProfileId}
        onAdd={addProfile}
        onDelete={deleteProfile}
        onUpdate={updateProfile}
      />
    ),
    holdingsView: <HoldingsViewSelector options={holdingsViewOptions} selectedId={selectedSharedProfileId} onChange={setSelectedSharedProfileId} />,
    summary: <PortfolioSummary holdings={displayedHoldings} settings={displayedSettings} currency={displayedCurrency} />,
    aiBrief: viewingSharedPortfolio ? null : <AiBriefPanel brief={aiBrief} />,
    quickAdd: quickAddForm,
    holdingsTable,
    analyzing: analysisProgressBanner,
    editHoldings: viewingSharedPortfolio ? null : (
      <PortfolioInput
        holdings={inputRows}
        region={region}
        onChange={setInputRows}
        onAnalyze={() => void analyze()}
        onRefreshAi={() => void analyze({ force: true })}
        aiUsageLabel={aiUsageSummary.cacheFresh
          ? `Today's AI is cached (${aiUsageSummary.geminiCallsToday} Gemini call(s) today for this profile). Apply daily AI uses zero extra calls.`
          : `No fresh AI cache for today (${aiUsageSummary.geminiCallsToday} Gemini call(s) today). Apply daily AI after market close, or use Refresh AI.`}
        isAnalyzing={isAnalyzing}
        isRefreshingMarket={isRefreshingMarket}
        onBlockedTicker={(message) => setWarnings((existing) => [...existing, message])}
      />
    )
  };

  const desktopSettingsButton = user ? (
    <button
      className="hidden min-h-10 items-center gap-2 rounded-md border border-ink/15 bg-white px-3 py-2 text-sm font-semibold text-ink hover:border-marine/35 hover:text-marine md:inline-flex"
      type="button"
      aria-haspopup="dialog"
      aria-expanded={desktopSettingsOpen}
      onClick={() => setDesktopSettingsOpen(true)}
    >
      <Settings2 className="h-4 w-4" aria-hidden />
      Settings
    </button>
  ) : null;

  return (
    <DashboardShell syncBadge={syncBadge} headerActions={desktopSettingsButton} mobileTabsActive={Boolean(user)}>
      {!user ? (
        <AuthPanel
          user={user}
          isAdmin={isAdmin}
          isLoading={isAuthLoading}
          syncStatus={cloudSyncStatus}
          syncMessage={cloudSyncMessage}
          displayName={displayName}
          onDisplayNameChange={handleDisplayNameChange}
          onSignIn={signIn}
          onSignOut={signOut}
        />
      ) : null}
      {!user ? (
        <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft">
          <h2 className="text-lg font-semibold">Sign in to view portfolios</h2>
          <p className="mt-1 text-sm text-ink/65">Stock holdings, profiles, shared portfolios, and analysis tables are only visible after login.</p>
        </section>
      ) : null}
      {visibleWarnings.length ? (
        <div className="space-y-2 rounded-md border border-amber/40 bg-amber/10 p-3 text-sm">
          {visibleWarnings.map((warning) => (
            <p className="flex gap-2" key={warning}><AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber" aria-hidden />{warning}</p>
          ))}
        </div>
      ) : null}
      {user ? (
        <>
          <div className="md:hidden">
            <MobileTabShell
              portfolio={<PortfolioWorkspace {...workspaceProps} />}
              settings={mobileSettings}
            />
          </div>
          <div className="hidden md:block">
            <PortfolioWorkspace {...workspaceProps} />
          </div>
          <SettingsDialog open={desktopSettingsOpen} onClose={() => setDesktopSettingsOpen(false)}>
            {settingsToolsContent}
          </SettingsDialog>
        </>
      ) : null}
    </DashboardShell>
  );
}
