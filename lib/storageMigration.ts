import { totalCostFor } from "./calculations";
import { DEFAULT_SETTINGS, defaultProfiles } from "./profileUtils";
import { filterUnsupportedHoldings } from "./unsupportedTickers";
import type { EnrichedHolding, FeeSettings, HoldingInput, PortfolioProfile } from "./types";
import { aiAnalysisSchema, feeSettingsSchema, marketQuoteSchema, newsItemSchema } from "./validation";

const DEMO_IDS = new Set(["tsm", "ibm", "dram", "nasa"]);
const STOP_STYLES = new Set(["tight", "balanced", "loose"]);

export type StoredPortfolioValues = {
  storedProfiles: string | null;
  storedHoldings: string | null;
  storedSettings: string | null;
  storedActiveProfileId: string | null;
};

export type PortfolioStorageState = {
  profiles: PortfolioProfile[];
  activeProfileId: string;
  warnings: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function finiteNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.replace(/[$,%\s,]/g, ""));
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function nonNegative(value: unknown, fallback = 0) {
  const parsed = finiteNumber(value);
  return parsed !== undefined && parsed >= 0 ? parsed : fallback;
}

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function parseStoredJson(raw: string | null, label: string): { value: unknown; warning?: string } {
  if (!raw) return { value: undefined };
  try {
    return { value: JSON.parse(raw) };
  } catch {
    return { value: undefined, warning: `${label} was unreadable and was ignored.` };
  }
}

export function removeLegacyDemoRows(rows: EnrichedHolding[]) {
  return rows.filter((holding) => {
    const note = (holding.notes || "").toLowerCase();
    const isLegacyDemo = DEMO_IDS.has(holding.id) && note.includes("sample");
    return !isLegacyDemo;
  });
}

export function coerceFeeSettings(value: unknown, fallback: FeeSettings = DEFAULT_SETTINGS): FeeSettings {
  const parsed = feeSettingsSchema.partial().safeParse(value);
  if (!parsed.success) return { ...DEFAULT_SETTINGS, ...fallback };
  return { ...DEFAULT_SETTINGS, ...fallback, ...parsed.data };
}

export function enrichHolding(holding: HoldingInput): EnrichedHolding {
  return { ...holding, news: [], selectedStopStyle: "balanced", sellPercent: 100 };
}

export function coerceHolding(value: unknown, index = 0): EnrichedHolding | undefined {
  if (!isRecord(value)) return undefined;
  const symbol = text(value.symbol).trim().toUpperCase();
  if (!symbol) return undefined;
  const shares = nonNegative(value.shares);
  const averageCost = nonNegative(value.averageCost);
  const totalCost = nonNegative(value.totalCost, totalCostFor(shares, averageCost));
  const base = enrichHolding({
    id: text(value.id, `holding-${index + 1}`) || `holding-${index + 1}`,
    symbol,
    name: text(value.name),
    shares,
    averageCost,
    totalCost,
    brokerCurrentValue: finiteNumber(value.brokerCurrentValue),
    notes: text(value.notes)
  });

  const quote = marketQuoteSchema.safeParse(value.quote);
  const news = Array.isArray(value.news)
    ? value.news.map((item) => newsItemSchema.safeParse(item)).filter((item) => item.success).map((item) => item.data)
    : [];
  const analysis = aiAnalysisSchema.safeParse(value.analysis);
  const selectedStopStyle = text(value.selectedStopStyle);
  const selectedTargetPrice = finiteNumber(value.selectedTargetPrice);
  const sellPercent = nonNegative(value.sellPercent, 100);

  return {
    ...base,
    quote: quote.success ? quote.data : undefined,
    news,
    analysis: analysis.success ? analysis.data : undefined,
    selectedStopStyle: STOP_STYLES.has(selectedStopStyle) ? selectedStopStyle as EnrichedHolding["selectedStopStyle"] : "balanced",
    selectedTargetPrice: selectedTargetPrice && selectedTargetPrice > 0 ? selectedTargetPrice : undefined,
    targetPriceEdited: value.targetPriceEdited === true,
    sellPercent: Math.min(100, sellPercent)
  };
}

export function coerceHoldings(value: unknown): EnrichedHolding[] {
  if (!Array.isArray(value)) return [];
  return removeLegacyDemoRows(value.map((item, index) => coerceHolding(item, index)).filter((item): item is EnrichedHolding => Boolean(item)));
}

export function coerceProfiles(value: unknown, fallbackSettings: FeeSettings = DEFAULT_SETTINGS): PortfolioProfile[] {
  if (!Array.isArray(value)) return [];
  return value.map((item, index): PortfolioProfile | undefined => {
    if (!isRecord(item)) return undefined;
    const region = item.region === "EG" ? "EG" : "US";
    return {
      id: text(item.id, `profile-${index + 1}`) || `profile-${index + 1}`,
      name: text(item.name, "Portfolio") || "Portfolio",
      region,
      currency: item.currency === "EGP" || region === "EG" ? "EGP" : "USD",
      holdings: filterUnsupportedHoldings(coerceHoldings(item.holdings), region),
      settings: coerceFeeSettings(item.settings, fallbackSettings)
    };
  }).filter((item): item is PortfolioProfile => Boolean(item));
}

export function migrateSinglePortfolio(holdings: EnrichedHolding[], settings: FeeSettings): PortfolioProfile[] {
  const [usProfile, egProfile] = defaultProfiles();
  return [
    { ...usProfile, holdings: removeLegacyDemoRows(holdings), settings: { ...DEFAULT_SETTINGS, ...settings } },
    egProfile
  ];
}

export function emptyPortfolioBootstrap(): PortfolioStorageState {
  const profiles = defaultProfiles();
  return {
    profiles,
    activeProfileId: profiles[0]?.id || "us-portfolio",
    warnings: []
  };
}

export function loadPortfolioState(values: StoredPortfolioValues): PortfolioStorageState {
  const warnings: string[] = [];
  const settingsJson = parseStoredJson(values.storedSettings, "Stored fee settings");
  const profilesJson = parseStoredJson(values.storedProfiles, "Stored portfolio profiles");
  const holdingsJson = parseStoredJson(values.storedHoldings, "Stored legacy holdings");
  [settingsJson.warning, profilesJson.warning, holdingsJson.warning].filter(Boolean).forEach((warning) => warnings.push(warning!));

  const parsedSettings = coerceFeeSettings(settingsJson.value);
  let profiles = coerceProfiles(profilesJson.value, parsedSettings);

  if (!profiles.length) {
    const legacyHoldings = coerceHoldings(holdingsJson.value);
    profiles = migrateSinglePortfolio(legacyHoldings, parsedSettings);
    if (values.storedHoldings) warnings.push("Existing portfolio data was moved into the US Portfolio profile.");
  }

  if (!profiles.length) profiles = defaultProfiles();
  const activeProfileId = profiles.some((profile) => profile.id === values.storedActiveProfileId)
    ? values.storedActiveProfileId!
    : profiles[0]?.id || "us-portfolio";

  return { profiles, activeProfileId, warnings };
}
