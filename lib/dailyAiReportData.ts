import type { SupabaseClient } from "@supabase/supabase-js";
import {
  activeProfileIdFromCloudPortfolioRow,
  cloudSettingsFromRow,
  profilesFromCloudPortfolioRow,
  type CloudPortfolioRow
} from "./cloudPortfolio";
import { parseDailyAiCache, type DailyAiProfileCacheEntry } from "./dailyAiCache";
import { parseHoldingsSnapshot, type HoldingSnapshotEntry } from "./holdingSnapshots";
import { getDailyPlSessionInfo, isTradingWeekday } from "./marketSession";
import { buildPortfolioReport, type PortfolioReport, type PortfolioReportHolding } from "./portfolioReport";
import { buildWeeklySeries, rollingSnapshotDates } from "./portfolioReportCharts";
import { fetchUserWeeklyChartSeries } from "./portfolioReportHistory";
import { createSnapshotQuoteFetcher } from "./portfolioSnapshotJobs";
import type { CurrencyCode, EnrichedHolding, MarketRegion, PortfolioProfile } from "./types";

export type DailyAiReportProfileFilter = "all" | "us-portfolio" | "eg-portfolio";

export type DailyAiReportSnapshotMeta = {
  snapshotDate: string;
  sessionLabel: string;
  updatedAt: string | null;
  createdAt: string | null;
  freshAfterClose: boolean;
  missing: boolean;
};

export type DailyAiReportHolding = HoldingSnapshotEntry & {
  id?: string;
  notes?: string;
  weightPercent?: number;
  selectedStopStyle?: EnrichedHolding["selectedStopStyle"];
  selectedTargetPrice?: number;
  targetPriceEdited?: boolean;
  sellPercent?: number;
  action?: string;
  riskLevel?: string;
  reportRow?: PortfolioReportHolding;
};

export type DailyAiReportProfilePayload = {
  id: string;
  name: string;
  region: MarketRegion;
  currency: CurrencyCode;
  sessionDate: string;
  sessionLabel: string;
  snapshot: DailyAiReportSnapshotMeta & {
    portfolioValue: number;
    dailyProfitLoss: number;
    dailyProfitLossPercent: number;
    totalProfitLoss: number;
    holdingsCount: number;
    holdings: DailyAiReportHolding[];
  };
  dailyAi?: DailyAiProfileCacheEntry;
  report?: PortfolioReport["profiles"][number];
};

export type DailyAiReportDataResponse = {
  ok: boolean;
  email: string;
  userId: string;
  ownershipVerified: boolean;
  profileId: DailyAiReportProfileFilter;
  activeProfileId: string;
  availableProfiles: Array<{
    id: string;
    name: string;
    region: MarketRegion;
    currency: CurrencyCode;
    holdingsCount: number;
  }>;
  generatedAt: string;
  cloudUpdatedAt: string | null;
  profiles: DailyAiReportProfilePayload[];
  history: Awaited<ReturnType<typeof fetchUserWeeklyChartSeries>>;
  warnings: string[];
};

type SnapshotQueryRow = {
  snapshot_date: string;
  profile_id: string;
  currency: CurrencyCode;
  daily_profit_loss: number;
  daily_profit_loss_percent: number;
  portfolio_value: number;
  total_profit_loss: number;
  holdings_count: number;
  holdings_snapshot?: unknown;
  created_at?: string;
  updated_at?: string;
};

export function parseDailyAiReportProfileFilter(value: string | null | undefined): DailyAiReportProfileFilter | null {
  const normalized = (value || "all").trim().toLowerCase();
  if (normalized === "all" || normalized === "us-portfolio" || normalized === "eg-portfolio") {
    return normalized;
  }
  return null;
}

export function filterProfilesByReportId(
  profiles: PortfolioProfile[],
  profileId: DailyAiReportProfileFilter
): PortfolioProfile[] {
  if (profileId === "all") return profiles;
  return profiles.filter((profile) => profile.id === profileId);
}

export function isEmailAllowedForDailyAiReport(email: string) {
  const allowlist = (process.env.DAILY_AI_REPORT_ALLOWED_EMAILS || "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  if (!allowlist.length) return true;
  return allowlist.includes(email.trim().toLowerCase());
}

export function regionCashCloseUtcMs(region: MarketRegion, sessionDate: string) {
  const timeZone = region === "EG" ? "Africa/Cairo" : "America/New_York";
  const closeHour = region === "EG" ? 14 : 16;
  const closeMinute = region === "EG" ? 30 : 0;
  const year = Number(sessionDate.slice(0, 4));
  const month = Number(sessionDate.slice(5, 7)) - 1;
  const day = Number(sessionDate.slice(8, 10));

  for (let utcHour = 0; utcHour < 24; utcHour += 1) {
    for (let utcMinute = 0; utcMinute < 60; utcMinute += 1) {
      const candidate = new Date(Date.UTC(year, month, day, utcHour, utcMinute, 0, 0));
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
      }).formatToParts(candidate);
      const localDate = `${parts.find((part) => part.type === "year")?.value}-${parts.find((part) => part.type === "month")?.value}-${parts.find((part) => part.type === "day")?.value}`;
      const localHour = Number(parts.find((part) => part.type === "hour")?.value ?? "-1");
      const localMinute = Number(parts.find((part) => part.type === "minute")?.value ?? "-1");
      if (localDate === sessionDate && localHour === closeHour && localMinute === closeMinute) {
        return candidate.getTime();
      }
    }
  }

  return Number.NaN;
}

export function isSnapshotFreshAfterClose(
  updatedAt: string | null | undefined,
  region: MarketRegion,
  sessionDate: string
) {
  if (!updatedAt) return false;
  const updatedMs = Date.parse(updatedAt);
  if (!Number.isFinite(updatedMs)) return false;

  const closeMs = regionCashCloseUtcMs(region, sessionDate);
  if (!Number.isFinite(closeMs)) return false;

  return updatedMs >= closeMs;
}

function mergeHoldingMetadata(
  snapshotHoldings: HoldingSnapshotEntry[],
  profile: PortfolioProfile,
  portfolioValue: number,
  reportHoldings: PortfolioReportHolding[] = [],
  dailyAi?: DailyAiProfileCacheEntry
): DailyAiReportHolding[] {
  const bySymbol = new Map(
    profile.holdings.map((holding) => [holding.symbol.trim().toUpperCase(), holding] as const)
  );
  const reportBySymbol = new Map(
    reportHoldings.map((holding) => [holding.symbol.trim().toUpperCase(), holding] as const)
  );

  return snapshotHoldings.map((entry) => {
    const symbolKey = entry.symbol.trim().toUpperCase();
    const source = bySymbol.get(symbolKey);
    const reportRow = reportBySymbol.get(symbolKey);
    const analysis = dailyAi?.analysesBySymbol[symbolKey];
    const weightPercent = portfolioValue > 0
      ? (entry.current_value / portfolioValue) * 100
      : 0;

    return {
      ...entry,
      id: source?.id,
      notes: source?.notes,
      weightPercent: Math.round(weightPercent * 100) / 100,
      selectedStopStyle: source?.selectedStopStyle,
      selectedTargetPrice: source?.selectedTargetPrice,
      targetPriceEdited: source?.targetPriceEdited,
      sellPercent: source?.sellPercent,
      action: analysis?.action,
      riskLevel: analysis?.riskLevel,
      reportRow
    };
  });
}

function snapshotPayloadFromRow(
  row: SnapshotQueryRow | null,
  profile: PortfolioProfile,
  now: Date,
  reportHoldings: PortfolioReportHolding[] = [],
  dailyAi?: DailyAiProfileCacheEntry
): DailyAiReportProfilePayload["snapshot"] {
  const session = getDailyPlSessionInfo(profile.region, now);
  if (!row) {
    return {
      snapshotDate: session.sessionDate,
      sessionLabel: session.sessionLabel,
      updatedAt: null,
      createdAt: null,
      freshAfterClose: false,
      missing: true,
      portfolioValue: 0,
      dailyProfitLoss: 0,
      dailyProfitLossPercent: 0,
      totalProfitLoss: 0,
      holdingsCount: 0,
      holdings: []
    };
  }

  const snapshotDate = String(row.snapshot_date);
  const portfolioValue = Number(row.portfolio_value) || 0;
  const snapshotHoldings = parseHoldingsSnapshot(row.holdings_snapshot);

  return {
    snapshotDate,
    sessionLabel: session.sessionLabel,
    updatedAt: row.updated_at || null,
    createdAt: row.created_at || null,
    freshAfterClose: isSnapshotFreshAfterClose(row.updated_at, profile.region, snapshotDate),
    missing: false,
    portfolioValue,
    dailyProfitLoss: Number(row.daily_profit_loss) || 0,
    dailyProfitLossPercent: Number(row.daily_profit_loss_percent) || 0,
    totalProfitLoss: Number(row.total_profit_loss) || 0,
    holdingsCount: Number(row.holdings_count) || snapshotHoldings.length,
    holdings: mergeHoldingMetadata(snapshotHoldings, profile, portfolioValue, reportHoldings, dailyAi)
  };
}

async function resolveUserIdByEmail(supabase: SupabaseClient, email: string) {
  const normalized = email.trim().toLowerCase();
  let page = 1;

  while (page <= 10) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error || !data.users.length) break;

    const match = data.users.find((user) => user.email?.trim().toLowerCase() === normalized);
    if (match?.email) {
      return {
        userId: match.id,
        email: match.email.trim().toLowerCase()
      };
    }

    if (data.users.length < 200) break;
    page += 1;
  }

  return null;
}

async function fetchSnapshotRows(
  supabase: SupabaseClient,
  userId: string,
  profileIds: string[],
  startDate: string
) {
  const baseSelect = "snapshot_date, profile_id, currency, daily_profit_loss, daily_profit_loss_percent, portfolio_value, total_profit_loss, holdings_count, holdings_snapshot, created_at, updated_at";
  const query = supabase
    .from("portfolio_daily_snapshots")
    .select(baseSelect)
    .eq("user_id", userId)
    .gte("snapshot_date", startDate)
    .order("snapshot_date", { ascending: false });

  const filtered = profileIds.length === 1
    ? query.eq("profile_id", profileIds[0])
    : query.in("profile_id", profileIds);

  const { data, error } = await filtered;
  if (error && isMissingHoldingsSnapshotColumn(error.message)) {
    const fallback = await supabase
      .from("portfolio_daily_snapshots")
      .select("snapshot_date, profile_id, currency, daily_profit_loss, daily_profit_loss_percent, portfolio_value, total_profit_loss, holdings_count, created_at, updated_at")
      .eq("user_id", userId)
      .gte("snapshot_date", startDate)
      .order("snapshot_date", { ascending: false });
    return {
      rows: (fallback.data || []) as SnapshotQueryRow[],
      warning: "Holdings snapshot column missing — holdings arrays will be empty until schema is updated."
    };
  }

  if (error) {
    return { rows: [] as SnapshotQueryRow[], warning: `Snapshot query failed: ${error.message}` };
  }

  return { rows: (data || []) as SnapshotQueryRow[], warning: undefined };
}

function latestSnapshotForProfile(rows: SnapshotQueryRow[], profileId: string, sessionDate: string) {
  return rows.find((row) => row.profile_id === profileId && row.snapshot_date === sessionDate)
    || rows.find((row) => row.profile_id === profileId);
}

export async function fetchDailyAiReportData(
  supabase: SupabaseClient,
  options: {
    email: string;
    profileId?: DailyAiReportProfileFilter;
    historyDays?: number;
    includeReport?: boolean;
    freshQuotes?: boolean;
    now?: Date;
  }
): Promise<{ data?: DailyAiReportDataResponse; error?: string; status?: number }> {
  const email = options.email.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return { error: "A valid email query parameter is required.", status: 400 };
  }

  if (!isEmailAllowedForDailyAiReport(email)) {
    return { error: "This email is not allowed for daily AI report data access.", status: 403 };
  }

  const profileFilter = options.profileId || "all";
  const now = options.now || new Date();
  const historyDays = Math.min(Math.max(options.historyDays ?? 30, 1), 30);
  const warnings: string[] = [];

  const resolved = await resolveUserIdByEmail(supabase, email);
  if (!resolved) {
    return {
      error: `The report cannot be completed accurately because I could not verify that the holdings belong to ${email}. Please provide a holdings export or reconnect the correct portfolio profile.`,
      status: 404
    };
  }

  const { data: portfolioRow, error: portfolioError } = await supabase
    .from("user_portfolios")
    .select("holdings, settings, display_name, share_holdings, updated_at, user_id")
    .eq("user_id", resolved.userId)
    .maybeSingle();

  if (portfolioError) {
    return { error: `Portfolio load failed: ${portfolioError.message}`, status: 500 };
  }

  if (!portfolioRow) {
    return {
      error: `The report cannot be completed accurately because the latest holdings snapshot for ${email} is unavailable. Please provide a holdings export or reconnect the portfolio data source.`,
      status: 404
    };
  }

  const row = portfolioRow as CloudPortfolioRow;
  const allProfiles = profilesFromCloudPortfolioRow(row);
  const selectedProfiles = filterProfilesByReportId(allProfiles, profileFilter);
  if (!selectedProfiles.length) {
    return { error: `Unknown profileId "${profileFilter}".`, status: 400 };
  }

  const activeProfileId = activeProfileIdFromCloudPortfolioRow(row, allProfiles);
  const settings = cloudSettingsFromRow(row);
  const dailyAiCache = parseDailyAiCache(settings.dailyAiCache);

  const usStart = rollingSnapshotDates(historyDays, "US", now)[0];
  const egStart = rollingSnapshotDates(historyDays, "EG", now)[0];
  const earliest = usStart < egStart ? usStart : egStart;
  const buffered = new Date(`${earliest}T12:00:00.000Z`);
  buffered.setUTCDate(buffered.getUTCDate() - 1);
  const startDate = buffered.toISOString().slice(0, 10);

  const profileIds = selectedProfiles.map((profile) => profile.id);
  const snapshotResult = await fetchSnapshotRows(supabase, resolved.userId, profileIds, startDate);
  if (snapshotResult.warning) warnings.push(snapshotResult.warning);

  let report: PortfolioReport | undefined;
  if (options.includeReport) {
    report = await buildPortfolioReport(selectedProfiles, {
      now,
      freshQuotes: options.freshQuotes === true,
      fetchQuote: createSnapshotQuoteFetcher({ freshQuotes: options.freshQuotes === true })
    });
  }

  const profiles: DailyAiReportProfilePayload[] = selectedProfiles.map((profile) => {
    const session = getDailyPlSessionInfo(profile.region, now);
    const latestRow = latestSnapshotForProfile(snapshotResult.rows, profile.id, session.sessionDate);
    const reportProfile = report?.profiles.find((entry) => entry.id === profile.id);
    const dailyAi = dailyAiCache.entries[profile.id];

    if (!latestRow) {
      warnings.push(`${profile.name}: no snapshot row found for session ${session.sessionDate}.`);
    } else if (!isSnapshotFreshAfterClose(latestRow.updated_at, profile.region, String(latestRow.snapshot_date))) {
      warnings.push(`${profile.name}: snapshot updated_at is before regional cash close for ${latestRow.snapshot_date}.`);
    }

    if (!isTradingWeekday(profile.region, now)) {
      warnings.push(`${profile.name}: ${profile.region} market is closed today — snapshot reflects the last trading session.`);
    }

    return {
      id: profile.id,
      name: profile.name,
      region: profile.region,
      currency: profile.currency,
      sessionDate: session.sessionDate,
      sessionLabel: session.sessionLabel,
      snapshot: snapshotPayloadFromRow(
        latestRow || null,
        profile,
        now,
        reportProfile?.holdings || [],
        dailyAi
      ),
      dailyAi,
      report: reportProfile
    };
  });

  const history = await fetchUserWeeklyChartSeries(supabase, resolved.userId, row, {
    days: historyDays,
    now
  }).then((series) => (
    profileFilter === "all"
      ? series
      : series.filter((entry) => entry.profileId === profileFilter)
  ));

  if (!history.length) {
    warnings.push("Historical portfolio trend data is limited for the selected profile window.");
  } else if (profileFilter !== "all") {
    const hasPoints = history.some((entry) => entry.points.some((point) => point.hasData));
    if (!hasPoints) {
      warnings.push(`No chart history points found for profileId=${profileFilter}.`);
    }
  }

  return {
    data: {
      ok: profiles.every((profile) => !profile.snapshot.missing),
      email: resolved.email,
      userId: resolved.userId,
      ownershipVerified: resolved.email === email,
      profileId: profileFilter,
      activeProfileId,
      availableProfiles: allProfiles.map((profile) => ({
        id: profile.id,
        name: profile.name,
        region: profile.region,
        currency: profile.currency,
        holdingsCount: profile.holdings.length
      })),
      generatedAt: now.toISOString(),
      cloudUpdatedAt: row.updated_at || null,
      profiles,
      history,
      warnings
    }
  };
}

function isMissingHoldingsSnapshotColumn(message: string) {
  const normalized = message.toLowerCase();
  return normalized.includes("holdings_snapshot");
}

export function weeklySeriesForProfiles(
  snapshots: Parameters<typeof buildWeeklySeries>[0],
  options: { days?: number; profileId?: DailyAiReportProfileFilter; now?: Date }
) {
  return buildWeeklySeries(snapshots, {
    days: options.days,
    profileId: options.profileId,
    now: options.now
  });
}
