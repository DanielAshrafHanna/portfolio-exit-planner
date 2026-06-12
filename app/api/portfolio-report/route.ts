import { NextResponse } from "next/server";
import { activeProfileIdFromCloudPortfolioRow, profilesFromCloudPortfolioRow, type CloudPortfolioRow } from "@/lib/cloudPortfolio";
import { buildPortfolioReport } from "@/lib/portfolioReport";
import { defaultProfiles } from "@/lib/profileUtils";
import { bearerTokenFromRequest, createSupabaseUserClient } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const accessToken = bearerTokenFromRequest(request);
  if (!accessToken) {
    return NextResponse.json({ error: "Sign in to view portfolio reports." }, { status: 401 });
  }

  try {
    const supabase = createSupabaseUserClient(accessToken);
    const { data: authData, error: authError } = await supabase.auth.getUser(accessToken);
    const user = authData.user;
    if (authError || !user) {
      return NextResponse.json({ error: "Session expired. Sign in again to view portfolio reports." }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("user_portfolios")
      .select("holdings, settings, display_name, share_holdings, updated_at, user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: `Portfolio report failed to load: ${error.message}` }, { status: 500 });
    }

    const row = data as CloudPortfolioRow | null;
    const profiles = row ? profilesFromCloudPortfolioRow(row) : defaultProfiles();
    const report = await buildPortfolioReport(profiles);

    return NextResponse.json({
      report,
      activeProfileId: row ? activeProfileIdFromCloudPortfolioRow(row, profiles) : profiles[0]?.id,
      cloudUpdatedAt: row?.updated_at || null
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Portfolio report failed."
    }, { status: 500 });
  }
}
