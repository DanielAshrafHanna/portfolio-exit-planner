"use client";

import { AlertCircle } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import type { CloudSyncStatus } from "@/components/AuthPanel";
import { AuthPanel } from "@/components/AuthPanel";
import { HoldingsTable } from "@/components/HoldingsTable";
import { ImageImport } from "@/components/ImageImport";
import { PortfolioInput } from "@/components/PortfolioInput";
import { ProfileSelector } from "@/components/ProfileSelector";
import { PortfolioSummary } from "@/components/PortfolioSummary";
import { SettingsPanel } from "@/components/SettingsPanel";
import { defaultSellTargets } from "@/lib/calculations";
import { DEFAULT_SETTINGS, defaultProfiles, displayMarketSymbol } from "@/lib/profileUtils";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";
import type { AiAnalysis, EnrichedHolding, FeeSettings, HoldingInput, MarketQuote, NewsItem, PortfolioProfile } from "@/lib/types";

const STORAGE_KEY = "portfolio-exit-planner:v1";
const SETTINGS_KEY = "portfolio-exit-planner:settings:v1";
const PROFILES_KEY = "portfolio-exit-planner:profiles:v1";
const ACTIVE_PROFILE_KEY = "portfolio-exit-planner:active-profile:v1";
const DEMO_IDS = new Set(["tsm", "ibm", "dram", "nasa"]);

function enrich(holding: HoldingInput): EnrichedHolding {
  return { ...holding, news: [], selectedStopStyle: "balanced", sellPercent: 100 };
}

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

function removeLegacyDemoRows(rows: EnrichedHolding[]) {
  return rows.filter((holding) => {
    const note = (holding.notes || "").toLowerCase();
    const isLegacyDemo = DEMO_IDS.has(holding.id) && note.includes("sample");
    return !isLegacyDemo;
  });
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
        ...enrich(next),
        quote: undefined,
        news: [],
        analysis: undefined,
        selectedStopStyle: existing.selectedStopStyle || "balanced",
        sellPercent: existing.sellPercent || 100
      };
      return;
    }
    merged.push(enrich({ ...row, symbol }));
  });

  return merged;
}

function profileNameForCount(count: number) {
  return `Portfolio ${count + 1}`;
}

function coerceProfiles(value: unknown, fallbackSettings: FeeSettings): PortfolioProfile[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is PortfolioProfile => Boolean(item && typeof item === "object" && "holdings" in item)).map((profile: any) => ({
    id: String(profile.id || crypto.randomUUID()),
    name: String(profile.name || "Portfolio"),
    region: profile.region === "EG" ? "EG" : "US",
    currency: profile.currency === "EGP" || profile.region === "EG" ? "EGP" : "USD",
    holdings: Array.isArray(profile.holdings) ? removeLegacyDemoRows(profile.holdings) : [],
    settings: { ...DEFAULT_SETTINGS, ...fallbackSettings, ...(profile.settings || {}) }
  }));
}

function migrateSinglePortfolio(holdings: EnrichedHolding[], settings: FeeSettings): PortfolioProfile[] {
  const [usProfile, egProfile] = defaultProfiles();
  return [
    { ...usProfile, holdings: removeLegacyDemoRows(holdings), settings: { ...DEFAULT_SETTINGS, ...settings } },
    egProfile
  ];
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
  const [isHydrated, setIsHydrated] = useState(false);
  const latestSyncPayload = useRef("");

  useEffect(() => {
    const storedProfiles = localStorage.getItem(PROFILES_KEY);
    const stored = localStorage.getItem(STORAGE_KEY);
    const storedSettings = localStorage.getItem(SETTINGS_KEY);
    const parsedSettings = storedSettings ? { ...DEFAULT_SETTINGS, ...(JSON.parse(storedSettings) as Partial<FeeSettings>) } : DEFAULT_SETTINGS;
    let nextProfiles = storedProfiles ? coerceProfiles(JSON.parse(storedProfiles), parsedSettings) : [];

    if (!nextProfiles.length) {
      const parsedRows = stored ? JSON.parse(stored) as EnrichedHolding[] : [];
      const storedRows = removeLegacyDemoRows(parsedRows);
      nextProfiles = migrateSinglePortfolio(storedRows, parsedSettings);
      if (stored) setWarnings((existing) => [...existing, "Existing portfolio data was moved into the US Portfolio profile."]);
      if (stored && storedRows.length !== parsedRows.length) {
        setWarnings((existing) => [...existing, "Old demo tickers were removed from local storage."]);
      }
    }

    setProfiles(nextProfiles.length ? nextProfiles : defaultProfiles());
    const storedActiveProfileId = localStorage.getItem(ACTIVE_PROFILE_KEY);
    setActiveProfileId(nextProfiles.some((profile) => profile.id === storedActiveProfileId) ? storedActiveProfileId! : nextProfiles[0]?.id || "us-portfolio");
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
    }
  }, [user]);

  const activeProfile = useMemo(() => profiles.find((profile) => profile.id === activeProfileId) || profiles[0], [profiles, activeProfileId]);
  const holdings = activeProfile?.holdings || [];
  const settings = activeProfile?.settings || DEFAULT_SETTINGS;
  const currency = activeProfile?.currency || "USD";
  const region = activeProfile?.region || "US";
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

  const inputRows = useMemo(() => holdings.map(({ quote, news, analysis, selectedStopStyle, selectedTargetPrice, targetPriceEdited, sellPercent, ...holding }) => holding), [holdings]);

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
        ...enrich(row),
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
    const symbols = holdings.map((holding) => displayMarketSymbol(holding.symbol, region)).filter(Boolean);
    if (!symbols.length) return holdings;
    if (options.showLoading) setIsRefreshingMarket(true);
    try {
      const analysisHoldings = holdings.map((holding) => ({ symbol: displayMarketSymbol(holding.symbol, region), region })).filter((holding) => holding.symbol);
      const marketResponse = await fetch("/api/market", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ holdings: analysisHoldings, region })
      });
      const marketData = await marketResponse.json();
      if (marketData.error) throw new Error(marketData.error);
      const bySymbol = new Map<string, { quote: MarketQuote; news: NewsItem[]; warnings: string[] }>();
      marketData.rows.forEach((row: any) => bySymbol.set(row.symbol, row));
      const withMarket = holdings.map((holding) => {
        const row = bySymbol.get(displayMarketSymbol(holding.symbol, region).toUpperCase());
        const quote = row?.quote;
        const selectedTargetPrice = quote && !holding.targetPriceEdited ? defaultSellTargets(quote.currentPrice)[1].price : holding.selectedTargetPrice;
        return { ...holding, quote, news: row?.news || holding.news || [], selectedTargetPrice };
      });
      if (options.showWarnings) {
        setWarnings((existing) => [...existing, ...marketData.rows.flatMap((row: any) => row.warnings || []).map(normalizeWarning)]);
      }
      setHoldings(withMarket);
      return withMarket;
    } catch (error) {
      if (options.showWarnings) {
        setWarnings((existing) => [...existing, error instanceof Error ? error.message : "Market refresh failed"]);
      }
      return holdings;
    } finally {
      if (options.showLoading) setIsRefreshingMarket(false);
    }
  };

  useEffect(() => {
    if (!isHydrated || !holdings.some((holding) => holding.symbol)) return;
    const timeout = window.setTimeout(() => {
      void refreshMarketData({ showLoading: true, showWarnings: false });
    }, 500);
    return () => window.clearTimeout(timeout);
  }, [isHydrated, activeProfileId, region, marketSymbolKey]);

  useEffect(() => {
    if (!isHydrated || !holdings.some((holding) => holding.symbol)) return;
    const interval = window.setInterval(() => {
      void refreshMarketData({ showLoading: true, showWarnings: false });
    }, 60_000);
    return () => window.clearInterval(interval);
  }, [isHydrated, activeProfileId, region, marketSymbolKey, holdingInputKey]);

  const analyze = async () => {
    setIsAnalyzing(true);
    setWarnings(["Refreshing market data, news, and analysis. Uploaded screenshots are not sent unless you use image extraction."]);
    try {
      const withMarket = await refreshMarketData({ showLoading: true, showWarnings: true });
      const analyzed = await Promise.all(withMarket.map(async (holding) => {
        if (!holding.quote) return holding;
        const response = await fetch("/api/analyzeHolding", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ holding, quote: holding.quote, news: holding.news })
        });
        const data = await response.json();
        if (data.warning) setWarnings((existing) => [...existing, normalizeWarning(data.warning)]);
        return { ...holding, analysis: data.analysis as AiAnalysis };
      }));
      setHoldings(analyzed);
    } catch (error) {
      setWarnings((existing) => [...existing, error instanceof Error ? error.message : "Analysis failed"]);
    } finally {
      setIsAnalyzing(false);
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

  const signIn = async (email: string, password: string, mode: "signin" | "signup") => {
    if (!supabase) return;
    setIsAuthLoading(true);
    const emailRedirectTo = typeof window !== "undefined" ? window.location.origin : "https://portfolio-exit-planner.vercel.app";
    const result = mode === "signin"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password, options: { emailRedirectTo } });
    setIsAuthLoading(false);
    if (result.error) {
      setWarnings((existing) => [...existing, result.error.message]);
      return;
    }
    if (mode === "signup" && !result.data.session) {
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
    const parsedPayload = JSON.parse(payload) as { profiles: PortfolioProfile[]; activeProfileId: string };
    const { error } = await supabase.from("user_portfolios").upsert({
      user_id: user.id,
      holdings: parsedPayload.profiles,
      settings: { activeProfileId: parsedPayload.activeProfileId, profilesVersion: 2 },
      updated_at: new Date().toISOString()
    });
    if (error) {
      setCloudSyncStatus("error");
      setCloudSyncMessage(`Cloud save failed: ${error.message}`);
      return false;
    }
    setCloudSyncStatus("saved");
    setCloudSyncMessage(`Saved to cloud at ${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.`);
    return true;
  };

  const loadCloudPortfolio = async () => {
    if (!supabase || !user || cloudLoadedUserId === user.id) return;
    setIsAuthLoading(true);
    setCloudSyncStatus("loading");
    setCloudSyncMessage("Loading cloud portfolio...");
    const { data, error } = await supabase.from("user_portfolios").select("holdings, settings").eq("user_id", user.id).maybeSingle();
    setIsAuthLoading(false);
    if (error) {
      setCloudLoadedUserId(user.id);
      setCloudSyncStatus("error");
      setCloudSyncMessage(`Cloud load failed: ${error.message}`);
      return;
    }
    if (!data) {
      setCloudLoadedUserId(user.id);
      setCloudSyncStatus("saved");
      setCloudSyncMessage("No cloud portfolio yet. Local changes will save automatically.");
      return;
    }
    const cloudSettings = data.settings as { activeProfileId?: string } & Partial<FeeSettings>;
    const loadedProfiles = coerceProfiles(data.holdings, DEFAULT_SETTINGS);
    if (loadedProfiles.length) {
      setProfiles(loadedProfiles);
      setActiveProfileId(loadedProfiles.some((profile) => profile.id === cloudSettings?.activeProfileId) ? cloudSettings.activeProfileId! : loadedProfiles[0].id);
    } else {
      const legacyHoldings = Array.isArray(data.holdings) ? data.holdings as EnrichedHolding[] : [];
      const migratedProfiles = migrateSinglePortfolio(legacyHoldings, { ...DEFAULT_SETTINGS, ...cloudSettings });
      setProfiles(migratedProfiles);
      setActiveProfileId(migratedProfiles[0].id);
    }
    setCloudLoadedUserId(user.id);
    setCloudSyncStatus("saved");
    setCloudSyncMessage("Cloud portfolio loaded. Changes save automatically.");
  };

  useEffect(() => {
    if (!supabase || !user || !isHydrated) return;
    void loadCloudPortfolio();
  }, [supabase, user, isHydrated, cloudLoadedUserId]);

  useEffect(() => {
    if (!supabase || !user || !isHydrated || cloudLoadedUserId !== user.id) return;
    const payload = JSON.stringify({ profiles, activeProfileId });
    if (payload === latestSyncPayload.current) return;
    latestSyncPayload.current = payload;
    const timeout = window.setTimeout(() => {
      void saveCloudPortfolio(payload);
    }, 1200);
    return () => window.clearTimeout(timeout);
  }, [supabase, user, isHydrated, cloudLoadedUserId, profiles, activeProfileId]);

  const addProfile = () => {
    const id = crypto.randomUUID();
    const nextProfile: PortfolioProfile = {
      id,
      name: profileNameForCount(profiles.length),
      region: "US",
      currency: "USD",
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
        isLoading={isAuthLoading}
        syncStatus={cloudSyncStatus}
        syncMessage={cloudSyncMessage}
        onSignIn={signIn}
        onSignOut={signOut}
      />
      <ProfileSelector profiles={profiles} activeProfileId={activeProfile?.id || activeProfileId} onActiveChange={setActiveProfileId} onAdd={addProfile} onDelete={deleteProfile} onUpdate={updateProfile} />
      <SettingsPanel settings={settings} currency={currency} onChange={setSettings} onClear={clearStored} />
      {warnings.length ? (
        <section className="mx-auto max-w-7xl px-4 pt-5">
          <div className="space-y-2 border border-amber/40 bg-amber/10 p-3 text-sm">
            {[...new Set(warnings)].map((warning) => (
              <p className="flex gap-2" key={warning}><AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber" aria-hidden />{warning}</p>
            ))}
          </div>
        </section>
      ) : null}
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
      <PortfolioSummary holdings={holdings} settings={settings} currency={currency} />
      <HoldingsTable holdings={holdings} settings={settings} currency={currency} onChange={updateHolding} />
    </main>
  );
}
