import { NextResponse } from "next/server";
import { profilesFromCloudPortfolioRow, type CloudPortfolioRow } from "@/lib/cloudPortfolio";
import { parseHoldingsSnapshot, type HoldingSnapshotDay } from "@/lib/holdingSnapshots";
import { buildWeeklySeries, rollingSnapshotDates } from "@/lib/portfolioReportCharts";
import { bearerTokenFromRequest, createSupabaseUserClient } from "@/lib/supabaseServer";
import type { CurrencyCode } from "@/lib/types";

export const dynamic = "force-dynamic";

function parseDays(value: string | null) {
  const parsed = Number(value || "7");
  if (!Number.isFinite(parsed) || parsed < 1) return 7;
  return Math.min(Math.floor(parsed), 30);
}

export async function GET(request: Request) {
  const accessToken = bearerTokenFromRequest(request);
  if (!accessToken) {
    return NextResponse.json({ error: "Sign in to view portfolio report history." }, { status: 401 });
  }

  try {
    const supabase = createSupabaseUserClient(accessToken);
    const { data: authData, error: authError } = await supabase.auth.getUser(accessToken);
    const user = authData.user;
    if (authError || !user) {
      return NextResponse.json({ error: "Session expired. Sign in again to view portfolio report history." }, { status: 401 });
    }

    const url = new URL(request.url);
    const days = parseDays(url.searchParams.get("days"));
    const profileId = url.searchParams.get("profileId") || "all";
    const now = new Date();
    // Snapshots are keyed by each region's local market date. Query from the earliest
    // region window start (minus a day buffer) so boundary days are never dropped.
    const usStart = rollingSnapshotDates(days, "US", now)[0];
    const egStart = rollingSnapshotDates(days, "EG", now)[0];
    const earliest = usStart < egStart ? usStart : egStart;
    const buffered = new Date(`${earliest}T12:00:00.000Z`);
    buffered.setUTCDate(buffered.getUTCDate() - 1);
    const startDate = buffered.toISOString().slice(0, 10);

    const [{ data: portfolioRow }, snapshotResult] = await Promise.all([
      supabase
        .from("user_portfolios")
        .select("holdings, settings")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("portfolio_daily_snapshots")
        .select("snapshot_date, profile_id, currency, daily_profit_loss, daily_profit_loss_percent, portfolio_value, total_profit_loss, holdings_count, holdings_snapshot")
        .eq("user_id", user.id)
        .gte("snapshot_date", startDate)
        .order("snapshot_date", { ascending: true })
    ]);

    let data: Array<Record<string, unknown>> | null = snapshotResult.data as Array<Record<string, unknown>> | null;
    let error = snapshotResult.error;
    if (error && isMissingHoldingsSnapshotColumn(error.message)) {
      const fallback = await supabase
        .from("portfolio_daily_snapshots")
        .select("snapshot_date, profile_id, currency, daily_profit_loss, daily_profit_loss_percent, portfolio_value, total_profit_loss, holdings_count")
        .eq("user_id", user.id)
        .gte("snapshot_date", startDate)
        .order("snapshot_date", { ascending: true });
      data = fallback.data as Array<Record<string, unknown>> | null;
      error = fallback.error;
    }

    if (error) {
      const message = error.message.toLowerCase();
      if (message.includes("portfolio_daily_snapshots") || message.includes("schema cache") || message.includes("could not find the table")) {
        return NextResponse.json({
          days,
          profileId,
          series: [],
          holdingSnapshots: [],
          warnings: ["Portfolio history is not active yet. Run the updated Supabase SQL, then reload the schema cache."]
        });
      }
      return NextResponse.json({ error: `Portfolio report history failed to load: ${error.message}` }, { status: 500 });
    }

    const profileNames = new Map(
      profilesFromCloudPortfolioRow((portfolioRow || { holdings: [], settings: {} }) as CloudPortfolioRow)
        .map((profile) => [profile.id, profile.name] as const)
    );
    const snapshots = (data || []).map((row) => ({
      snapshot_date: row.snapshot_date as string,
      profile_id: row.profile_id as string,
      profile_name: profileNames.get(row.profile_id as string),
      currency: row.currency as "USD" | "EGP",
      daily_profit_loss: Number(row.daily_profit_loss),
      daily_profit_loss_percent: Number(row.daily_profit_loss_percent),
      portfolio_value: Number(row.portfolio_value),
      total_profit_loss: Number(row.total_profit_loss),
      holdings_count: Number(row.holdings_count)
    }));

    const holdingSnapshots: HoldingSnapshotDay[] = (data || []).map((row) => ({
      snapshotDate: row.snapshot_date as string,
      profileId: row.profile_id as string,
      currency: row.currency as CurrencyCode,
      holdings: parseHoldingsSnapshot("holdings_snapshot" in row ? row.holdings_snapshot : [])
    }));

    return NextResponse.json({
      days,
      profileId,
      series: buildWeeklySeries(snapshots, { days, profileId, now }),
      holdingSnapshots,
      warnings: holdingSnapshots.every((day) => !day.holdings.length) && (data || []).length
        ? ["Historical mover breakdown starts after the next saved report snapshot."]
        : []
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Portfolio report history failed."
    }, { status: 500 });
  }
}

function isMissingHoldingsSnapshotColumn(message: string) {
  const normalized = message.toLowerCase();
  return normalized.includes("holdings_snapshot") || normalized.includes("column");
}
