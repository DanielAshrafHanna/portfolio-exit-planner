"use client";

import { AlertCircle, DatabaseZap } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { AuthPanel } from "@/components/AuthPanel";
import { Disclaimer } from "@/components/Disclaimer";
import { HoldingsTable } from "@/components/HoldingsTable";
import { ImageImport } from "@/components/ImageImport";
import { PortfolioInput } from "@/components/PortfolioInput";
import { PortfolioSummary } from "@/components/PortfolioSummary";
import { SettingsPanel } from "@/components/SettingsPanel";
import { defaultSellTargets } from "@/lib/calculations";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";
import type { AiAnalysis, EnrichedHolding, FeeSettings, HoldingInput, MarketQuote, NewsItem } from "@/lib/types";

const STORAGE_KEY = "portfolio-exit-planner:v1";
const SETTINGS_KEY = "portfolio-exit-planner:settings:v1";
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

export default function Home() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [holdings, setHoldings] = useState<EnrichedHolding[]>([]);
  const [settings, setSettings] = useState<FeeSettings>({ fixedTradingFee: 0, percentTradingFee: 0, fxFeePercent: 0 });
  const [warnings, setWarnings] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [isSavingCloud, setIsSavingCloud] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    const storedSettings = localStorage.getItem(SETTINGS_KEY);
    const parsedRows = stored ? JSON.parse(stored) as EnrichedHolding[] : [];
    const storedRows = removeLegacyDemoRows(parsedRows);
    if (stored && storedRows.length !== parsedRows.length) {
      if (storedRows.length) localStorage.setItem(STORAGE_KEY, JSON.stringify(storedRows));
      else localStorage.removeItem(STORAGE_KEY);
      setWarnings((existing) => [...existing, "Old demo tickers were removed from local storage."]);
    }
    setHoldings(storedRows);
    if (storedSettings) setSettings(JSON.parse(storedSettings));
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(holdings));
  }, [holdings]);

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

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

  const analyze = async () => {
    setIsAnalyzing(true);
    setWarnings(["Your tickers are being sent to market/news providers. Uploaded screenshots are not sent unless you use image extraction."]);
    try {
      const symbols = holdings.map((holding) => holding.symbol).filter(Boolean);
      const marketResponse = await fetch("/api/market", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbols })
      });
      const marketData = await marketResponse.json();
      if (marketData.error) throw new Error(marketData.error);
      const bySymbol = new Map<string, { quote: MarketQuote; news: NewsItem[]; warnings: string[] }>();
      marketData.rows.forEach((row: any) => bySymbol.set(row.symbol, row));
      const withMarket = holdings.map((holding) => {
        const row = bySymbol.get(holding.symbol.toUpperCase());
        const quote = row?.quote;
        const selectedTargetPrice = quote && !holding.targetPriceEdited ? defaultSellTargets(quote.currentPrice)[1].price : holding.selectedTargetPrice;
        return { ...holding, quote, news: row?.news || [], selectedTargetPrice };
      });
      setWarnings((existing) => [...existing, ...marketData.rows.flatMap((row: any) => row.warnings || []).map(normalizeWarning)]);

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
    setHoldings([]);
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
      setWarnings((existing) => [...existing, "Signed in. You can now save or load your private cloud portfolio."]);
    }
  };

  const signOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
    setWarnings((existing) => [...existing, "Signed out. Local portfolio data remains on this device."]);
  };

  const saveCloudPortfolio = async () => {
    if (!supabase || !user) return;
    setIsSavingCloud(true);
    const { error } = await supabase.from("user_portfolios").upsert({
      user_id: user.id,
      holdings,
      settings,
      updated_at: new Date().toISOString()
    });
    setIsSavingCloud(false);
    setWarnings((existing) => [...existing, error ? `Cloud save failed: ${error.message}` : "Cloud portfolio saved for your account."]);
  };

  const loadCloudPortfolio = async () => {
    if (!supabase || !user) return;
    setIsAuthLoading(true);
    const { data, error } = await supabase.from("user_portfolios").select("holdings, settings").eq("user_id", user.id).maybeSingle();
    setIsAuthLoading(false);
    if (error) {
      setWarnings((existing) => [...existing, `Cloud load failed: ${error.message}`]);
      return;
    }
    if (!data) {
      setWarnings((existing) => [...existing, "No cloud portfolio saved yet for this account."]);
      return;
    }
    setHoldings(Array.isArray(data.holdings) ? data.holdings as EnrichedHolding[] : []);
    setSettings({ ...settings, ...(data.settings as Partial<FeeSettings>) });
    setWarnings((existing) => [...existing, "Cloud portfolio loaded."]);
  };

  return (
    <main>
      <header className="bg-white px-4 py-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded bg-mint px-3 py-1 text-xs font-semibold uppercase text-marine">
            <DatabaseZap className="h-4 w-4" aria-hidden /> Local-first educational planner
          </div>
          <h1 className="max-w-3xl text-4xl font-bold tracking-normal text-ink md:text-5xl">Portfolio Exit Planner</h1>
          <p className="mt-3 max-w-3xl text-base text-ink/70">
            Upload, import, or enter holdings, then compare stop-losses, target exits, fees, partial sales, market data, news, and a cautious AI Hold / Watch / Trim / Sell decision.
          </p>
        </div>
      </header>
      <Disclaimer />
      <AuthPanel
        user={user}
        isLoading={isAuthLoading}
        isSaving={isSavingCloud}
        onSignIn={signIn}
        onSignOut={signOut}
        onSave={saveCloudPortfolio}
        onLoad={loadCloudPortfolio}
      />
      <SettingsPanel settings={settings} onChange={setSettings} onClear={clearStored} />
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
      <PortfolioInput holdings={inputRows} onChange={setInputRows} onAnalyze={analyze} isAnalyzing={isAnalyzing} />
      {isAnalyzing ? (
        <section className="mx-auto grid max-w-7xl gap-3 px-4 pb-8 sm:grid-cols-3">
          {[0, 1, 2].map((item) => <div className="h-24 animate-pulse bg-white" key={item} />)}
        </section>
      ) : null}
      <PortfolioSummary holdings={holdings} settings={settings} />
      <HoldingsTable holdings={holdings} settings={settings} onChange={updateHolding} />
    </main>
  );
}
