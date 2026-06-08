"use client";

import { AlertCircle } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import type { CloudSyncStatus } from "@/components/AuthPanel";
import { AuthPanel } from "@/components/AuthPanel";
import { HoldingsTable } from "@/components/HoldingsTable";
import { HoldingsViewSelector, type HoldingsViewOption } from "@/components/HoldingsViewSelector";
import { ImageImport } from "@/components/ImageImport";
import { PortfolioInput } from "@/components/PortfolioInput";
import { ProfileSelector } from "@/components/ProfileSelector";
import { PortfolioSummary } from "@/components/PortfolioSummary";
import { SettingsPanel } from "@/components/SettingsPanel";
import { SharedHoldingsViewer } from "@/components/SharedHoldingsViewer";
import { defaultSellTargets } from "@/lib/calculations";
import { applyAnalyzedHoldingResults, type AnalyzedHoldingResult } from "@/lib/holdingMerge";
import { DEFAULT_SETTINGS, defaultProfiles, displayMarketSymbol } from "@/lib/profileUtils";
import { coerceHoldings, coerceProfiles, enrichHolding, loadPortfolioState, migrateSinglePortfolio } from "@/lib/storageMigration";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";
import type { AiAnalysis, EnrichedHolding, FeeSettings, HoldingInput, MarketQuote, NewsItem, PortfolioProfile, SharedPortfolioProfile } from "@/lib/types";

const STORAGE_KEY = "portfolio-exit-planner:v1";
const SETTINGS_KEY = "portfolio-exit-planner:settings:v1";
const PROFILES_KEY = "portfolio-exit-planner:profiles:v1";
const ACTIVE_PROFILE_KEY = "portfolio-exit-planner:active-profile:v1";
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
  if (warning.includes("OPENAI_API_KEY")) {
    return "OPENAI_API_KEY is missing. AI/OCR features are using deterministic fallback analysis until the secret is added.";
  }
  if (warning.includes("Yahoo Finance's public chart feed")) {
    return "Market API key is missing. Quotes are currently fetched from Yahoo Finance's public chart feed.";
  }
  if (warning.includes("Yahoo Finance RSS")) {
    return "Recent news is currently fetched from Yahoo Finance RSS.";
  }
  return warning;
}

function warningForAudience(warning: string, isAdmin: boolean) {
  if (isAdmin) return warning;
  if (warning.includes("Supabase SQL") || warning.includes("schema cache") || warning.includes("display_name") || warning.includes("share_holdings")) {
    return null;
  }
  if (warning.includes("OPENAI_API_KEY")) {
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

function mergeExtractedRows(existingRows: EnrichedHolding[], extractedRows: HoldingInput[]) {
  const bySymbol = new Map(existingRows.map((holding) => [holding.symbol.trim().toUpperCase(), holding]));
  const merged = [...existingRows];

  extractedRows.forEach((row) => {
    const symbol = row.symbol.trim().toUpperCase();
    if (!symbol) return;
    const existing = bySymbol.get(symbol);
    if (existing) {
      const next = { ...existing, ...row, id: existing.id, symbol };
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

type AnalysisApiResponse = {
  analysis?: AiAnalysis;
  warning?: string;
  error?: string;
};

type AnalyzedHoldingResponse = AnalyzedHoldingResult & { warning?: string };

type CloudPortfolioPayload = {
  profiles: PortfolioProfile[];
  activeProfileId: string;
  displayName?: string;
  shareHoldings?: boolean;
};

type CloudPortfolioRow = {
  holdings: unknown;
  settings: unknown;
  display_name?: string | null;
  share_holdings?: boolean | null;
  updated_at?: string | null;
  user_id?: string | null;
};

type CloudSettings = { activeProfileId?: string; displayName?: string; shareHoldings?: boolean } & Partial<FeeSettings>;

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

export default function Home() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [profiles, setProfiles] = useState<PortfolioProfile[]>(() => defaultProfiles());
  const [activeProfileId, setActiveProfileId] = useState("us-portfolio");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isRefreshingMarket, setIsRefreshingMarket] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [cloudSyncStatus, setCloudSyncStatus] = useState<CloudSyncStatus>("signed-out");
  const [cloudSyncMessage, setCloudSyncMessage] = useState("Sign in to enable cloud sync.");
  const [cloudLoadedUserId, setCloudLoadedUserId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("Friend");
  const [shareHoldings, setShareHoldings] = useState(false);
  const [sharedProfiles, setSharedProfiles] = useState<SharedPortfolioProfile[]>([]);
  const [selectedSharedProfileId, setSelectedSharedProfileId] = useState(OWN_HOLDINGS_VIEW_ID);
  const [isLoadingSharedProfiles, setIsLoadingSharedProfiles] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const latestSyncPayload = useRef("");
  const marketRequestId = useRef(0);
  const analysisRequestId = useRef(0);
  const activeProfileIdRef = useRef(activeProfileId);
  const holdingInputKeyRef = useRef("");

  useEffect(() => {
    const restored = loadPortfolioState({
      storedProfiles: localStorage.getItem(PROFILES_KEY),
      storedHoldings: localStorage.getItem(STORAGE_KEY),
      storedSettings: localStorage.getItem(SETTINGS_KEY),
      storedActiveProfileId: localStorage.getItem(ACTIVE_PROFILE_KEY)
    });
    setProfiles(restored.profiles);
    setActiveProfileId(restored.activeProfileId);
    if (restored.warnings.length) setWarnings((existing) => [...existing, ...restored.warnings]);
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
  }, [profiles, isHydrated]);

  useEffect(() => {
    if (!isHydrated) return;
    localStorage.setItem(ACTIVE_PROFILE_KEY, activeProfileId);
  }, [activeProfileId, isHydrated]);

  useEffect(() => {
    if (!supabase) return;
    setIsAuthLoading(true);
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setIsAuthLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => listener.subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    latestSyncPayload.current = "";
    if (!user) {
      setCloudLoadedUserId(null);
      setCloudSyncStatus("signed-out");
      setCloudSyncMessage("Sign in to enable cloud sync.");
      setShareHoldings(false);
      setSharedProfiles([]);
      setSelectedSharedProfileId(OWN_HOLDINGS_VIEW_ID);
    } else {
      setDisplayName((existing) => existing === "Friend" ? friendlyNameForUser(user) : existing);
    }
  }, [user]);

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
  const displayedHoldings = selectedSharedProfile?.profile.holdings || holdings;
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

  useEffect(() => {
    activeProfileIdRef.current = activeProfile?.id || activeProfileId;
    holdingInputKeyRef.current = holdingInputKey;
  }, [activeProfile?.id, activeProfileId, holdingInputKey]);

  useEffect(() => {
    if (!holdingsViewOptions.some((option) => option.id === selectedSharedProfileId)) {
      setSelectedSharedProfileId(OWN_HOLDINGS_VIEW_ID);
    }
  }, [holdingsViewOptions, selectedSharedProfileId]);

  const updateActiveProfile = (updater: (profile: PortfolioProfile) => PortfolioProfile) => {
    setProfiles((items) => items.map((profile) => profile.id === activeProfile?.id ? updater(profile) : profile));
  };

  const setHoldings = (nextHoldings: EnrichedHolding[] | ((existing: EnrichedHolding[]) => EnrichedHolding[])) => {
    updateActiveProfile((profile) => ({
      ...profile,
      holdings: typeof nextHoldings === "function" ? nextHoldings(profile.holdings) : nextHoldings
    }));
  };

  const setSettings = (nextSettings: FeeSettings) => {
    updateActiveProfile((profile) => ({ ...profile, settings: nextSettings }));
  };

  const inputRows = useMemo(() => holdings.map(toHoldingInput), [holdings]);

  const setInputRows = (rows: HoldingInput[]) => {
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
    setHoldings((items) => items.map((item) => item.id === next.id ? next : item));
  };

  const refreshMarketData = async (options: { showLoading?: boolean; showWarnings?: boolean } = {}) => {
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
        body: JSON.stringify({ holdings: analysisHoldings, region: regionAtStart })
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
        return { ...holding, quote: row.quote, news: row.news, selectedTargetPrice };
      }));
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
    if (!isHydrated || !holdings.some((holding) => holding.symbol)) return;
    const timeout = window.setTimeout(() => {
      void refreshMarketData({ showLoading: false, showWarnings: false });
    }, 500);
    return () => window.clearTimeout(timeout);
    // Keyed by symbol/profile fingerprint so quote-only updates do not trigger another refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHydrated, activeProfileId, region, marketSymbolKey]);

  useEffect(() => {
    if (!isHydrated || !holdings.some((holding) => holding.symbol)) return;
    const interval = window.setInterval(() => {
      void refreshMarketData({ showLoading: false, showWarnings: false });
    }, 60_000);
    return () => window.clearInterval(interval);
    // Keyed by input fingerprint so quote-only updates do not reset the polling interval.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHydrated, activeProfileId, region, marketSymbolKey, holdingInputKey]);

  const analyze = async () => {
    const requestId = analysisRequestId.current + 1;
    analysisRequestId.current = requestId;
    const profileIdAtStart = activeProfile?.id || activeProfileId;
    const inputKeyAtStart = holdingInputKeyRef.current;
    const isLatestAnalysis = () => analysisRequestId.current === requestId && activeProfileIdRef.current === profileIdAtStart && holdingInputKeyRef.current === inputKeyAtStart;
    setIsAnalyzing(true);
    setWarnings(["Refreshing market data, news, and analysis. Uploaded screenshots are not sent unless you use image extraction."]);
    try {
      const withMarket = await refreshMarketData({ showLoading: true, showWarnings: true });
      if (!withMarket || !isLatestAnalysis()) return;
      const analyzed = await Promise.all(withMarket.map(async (holding): Promise<AnalyzedHoldingResponse> => {
        if (!holding.quote) return { id: holding.id, quote: holding.quote, news: holding.news };
        const response = await fetch("/api/analyzeHolding", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ holding, quote: holding.quote, news: holding.news })
        });
        const data = await readJsonResponse<AnalysisApiResponse>(response);
        if (!response.ok) throw new Error(data.error || `Analysis failed for ${holding.symbol}`);
        return {
          id: holding.id,
          quote: holding.quote,
          news: holding.news,
          analysis: data.analysis,
          warning: data.warning
        };
      }));
      if (!isLatestAnalysis()) return;
      const warningsToAdd = analyzed.map((item) => item.warning).filter((warning): warning is string => Boolean(warning)).map(normalizeWarning);
      if (warningsToAdd.length) setWarnings((existing) => [...existing, ...warningsToAdd]);
      setHoldings((currentItems) => applyAnalyzedHoldingResults(currentItems, analyzed));
    } catch (error) {
      setWarnings((existing) => [...existing, error instanceof Error ? error.message : "Analysis failed"]);
    } finally {
      if (analysisRequestId.current === requestId) setIsAnalyzing(false);
    }
  };

  const clearStored = () => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(SETTINGS_KEY);
    localStorage.removeItem(PROFILES_KEY);
    localStorage.removeItem(ACTIVE_PROFILE_KEY);
    const nextProfiles = defaultProfiles();
    setProfiles(nextProfiles);
    setActiveProfileId(nextProfiles[0].id);
    setWarnings(["Stored portfolio data cleared."]);
  };

  const signIn = async (email: string, password: string, mode: "signin" | "signup", signupDisplayName?: string) => {
    if (!supabase) return;
    setIsAuthLoading(true);
    const emailRedirectTo = typeof window !== "undefined" ? window.location.origin : "https://portfolio-exit-planner.vercel.app";
    const normalizedSignupName = normalizeDisplayName(signupDisplayName || friendlyNameFromEmail(email));
    const result = mode === "signin"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({
        email,
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
    const cloudSettings = {
      activeProfileId: parsedPayload.activeProfileId,
      profilesVersion: 2,
      displayName: normalizeDisplayName(parsedPayload.displayName || displayName),
      shareHoldings: Boolean(parsedPayload.shareHoldings)
    };
    const { error } = await supabase.from("user_portfolios").upsert({
      user_id: user.id,
      holdings: parsedPayload.profiles,
      settings: cloudSettings,
      display_name: cloudSettings.displayName,
      share_holdings: cloudSettings.shareHoldings,
      updated_at: new Date().toISOString()
    });
    if (error) {
      if (isMissingSharedColumnsError(error)) {
        const { error: legacyError } = await supabase.from("user_portfolios").upsert({
          user_id: user.id,
          holdings: parsedPayload.profiles,
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

  const loadCloudPortfolio = async () => {
    if (!supabase || !user || cloudLoadedUserId === user.id) return;
    setIsAuthLoading(true);
    setCloudSyncStatus("loading");
    setCloudSyncMessage("Loading cloud portfolio...");
    const initialResult = await supabase.from("user_portfolios").select("holdings, settings, display_name, share_holdings").eq("user_id", user.id).maybeSingle();
    let data = initialResult.data as CloudPortfolioRow | null;
    let error = initialResult.error;
    if (isMissingSharedColumnsError(error)) {
      const fallback = await supabase.from("user_portfolios").select("holdings, settings").eq("user_id", user.id).maybeSingle();
      data = fallback.data as CloudPortfolioRow | null;
      error = fallback.error;
      setWarnings((existing) => [...existing, "Shared holdings need the updated Supabase SQL/schema cache. Cloud sync will keep working privately for now."]);
    }
    setIsAuthLoading(false);
    if (error) {
      setCloudLoadedUserId(user.id);
      setCloudSyncStatus("error");
      setCloudSyncMessage(isAdmin ? `Cloud load failed: ${error.message}` : "Cloud load failed. Ask the admin to check setup.");
      return;
    }
    if (!data) {
      setCloudLoadedUserId(user.id);
      setDisplayName(friendlyNameForUser(user));
      setShareHoldings(false);
      setCloudSyncStatus("saved");
      setCloudSyncMessage("No cloud portfolio yet. Local changes will save automatically.");
      void loadSharedProfiles();
      return;
    }
    const row = data as CloudPortfolioRow;
    const cloudSettings: CloudSettings = row.settings && typeof row.settings === "object"
      ? data.settings as CloudSettings
      : {};
    setDisplayName(normalizeDisplayName(row.display_name || cloudSettings.displayName || friendlyNameForUser(user)));
    setShareHoldings(Boolean(row.share_holdings ?? cloudSettings.shareHoldings));
    const loadedProfiles = coerceProfiles(row.holdings, DEFAULT_SETTINGS);
    if (loadedProfiles.length) {
      setProfiles(loadedProfiles);
      setActiveProfileId(loadedProfiles.some((profile) => profile.id === cloudSettings?.activeProfileId) ? cloudSettings.activeProfileId! : loadedProfiles[0].id);
    } else {
      const legacyHoldings = coerceHoldings(data.holdings);
      const migratedProfiles = migrateSinglePortfolio(legacyHoldings, { ...DEFAULT_SETTINGS, ...cloudSettings });
      setProfiles(migratedProfiles);
      setActiveProfileId(migratedProfiles[0].id);
    }
    setCloudLoadedUserId(user.id);
    setCloudSyncStatus("saved");
    setCloudSyncMessage("Cloud portfolio loaded. Changes save automatically.");
    void loadSharedProfiles();
  };

  useEffect(() => {
    if (!supabase || !user || !isHydrated) return;
    void loadCloudPortfolio();
    // loadCloudPortfolio is guarded by cloudLoadedUserId and should run once per signed-in user.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, user, isHydrated, cloudLoadedUserId]);

  useEffect(() => {
    if (!supabase || !user || !isHydrated || cloudLoadedUserId !== user.id) return;
    const payload = JSON.stringify({ profiles, activeProfileId, displayName, shareHoldings });
    if (payload === latestSyncPayload.current) return;
    latestSyncPayload.current = payload;
    const timeout = window.setTimeout(() => {
      void saveCloudPortfolio(payload);
    }, 1200);
    return () => window.clearTimeout(timeout);
    // saveCloudPortfolio consumes the serialized payload captured for this debounce tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, user, isHydrated, cloudLoadedUserId, profiles, activeProfileId, displayName, shareHoldings]);

  const addProfile = () => {
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
    setProfiles((items) => {
      if (items.length <= 1) return items;
      const nextProfiles = items.filter((profile) => profile.id !== id);
      if (activeProfileId === id) setActiveProfileId(nextProfiles[0].id);
      return nextProfiles;
    });
  };

  const updateProfile = (nextProfile: PortfolioProfile) => {
    setProfiles((items) => items.map((profile) => profile.id === nextProfile.id ? nextProfile : profile));
  };

  return (
    <main>
      <header className="bg-white px-4 py-6">
        <div className="mx-auto max-w-7xl">
          <h1 className="max-w-3xl text-4xl font-bold tracking-normal text-ink md:text-5xl">Portfolio Exit Planner</h1>
          <p className="mt-2 max-w-3xl text-base text-ink/70">Manage holdings, compare exits, and track US and Egyptian market positions.</p>
        </div>
      </header>
      <AuthPanel
        user={user}
        isAdmin={isAdmin}
        isLoading={isAuthLoading}
        syncStatus={cloudSyncStatus}
        syncMessage={cloudSyncMessage}
        displayName={displayName}
        onDisplayNameChange={setDisplayName}
        onSignIn={signIn}
        onSignOut={signOut}
      />
      {user ? (
        <>
          <SettingsPanel settings={settings} currency={currency} onChange={setSettings} onClear={clearStored} />
          <SharedHoldingsViewer
            isLoading={isLoadingSharedProfiles}
            shareHoldings={shareHoldings}
            onShareHoldingsChange={setShareHoldings}
          />
        </>
      ) : (
        <section className="mx-auto max-w-7xl px-4 py-8">
          <div className="border border-ink/10 bg-white p-5 shadow-soft">
            <h2 className="text-lg font-semibold">Sign in to view portfolios</h2>
            <p className="mt-1 text-sm text-ink/65">Stock holdings, profiles, shared portfolios, and analysis tables are only visible after login.</p>
          </div>
        </section>
      )}
      {visibleWarnings.length ? (
        <section className="mx-auto max-w-7xl px-4 pt-5">
          <div className="space-y-2 border border-amber/40 bg-amber/10 p-3 text-sm">
            {visibleWarnings.map((warning) => (
              <p className="flex gap-2" key={warning}><AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber" aria-hidden />{warning}</p>
            ))}
          </div>
        </section>
      ) : null}
      {user ? (
        <>
          <ImageImport
            onExtracted={(rows) => {
              setHoldings((existing) => mergeExtractedRows(existing, rows));
              setWarnings((existing) => [...existing, `${rows.length} image row${rows.length === 1 ? "" : "s"} added or updated. Confirm every field before analysis.`]);
            }}
            setWarning={(warning) => setWarnings((existing) => [...existing, warning])}
          />
          <PortfolioInput holdings={inputRows} onChange={setInputRows} onAnalyze={analyze} isAnalyzing={isAnalyzing} isRefreshingMarket={isRefreshingMarket} />
          {isAnalyzing ? (
            <section className="mx-auto grid max-w-7xl gap-3 px-4 pb-8 sm:grid-cols-3">
              {[0, 1, 2].map((item) => <div className="h-24 animate-pulse bg-white" key={item} />)}
            </section>
          ) : null}
          <ProfileSelector profiles={profiles} activeProfileId={activeProfile?.id || activeProfileId} onActiveChange={setActiveProfileId} onAdd={addProfile} onDelete={deleteProfile} onUpdate={updateProfile} />
          <HoldingsViewSelector options={holdingsViewOptions} selectedId={selectedSharedProfileId} onChange={setSelectedSharedProfileId} />
          <PortfolioSummary holdings={displayedHoldings} settings={displayedSettings} currency={displayedCurrency} />
          <HoldingsTable
            holdings={displayedHoldings}
            settings={displayedSettings}
            currency={displayedCurrency}
            onChange={selectedSharedProfile ? undefined : updateHolding}
            readOnly={Boolean(selectedSharedProfile)}
          />
        </>
      ) : null}
    </main>
  );
}
