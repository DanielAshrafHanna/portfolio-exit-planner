import { NextResponse } from "next/server";
import { z } from "zod";
import { cloudSettingsFromRow, profilesFromCloudPortfolioRow, type CloudPortfolioRow } from "@/lib/cloudPortfolio";
import { dailyReportEmailPrefsFromSettings, isValidReportEmail, normalizeReportEmail } from "@/lib/dailyReportEmailPrefs";
import { sendDailyReportEmail } from "@/lib/emailReport";
import { fetchUserWeeklyChartSeries } from "@/lib/portfolioReportHistory";
import { buildPortfolioReport } from "@/lib/portfolioReport";
import { defaultProfiles } from "@/lib/profileUtils";
import { bearerTokenFromRequest, createSupabaseUserClient } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

const requestSchema = z.object({
  email: z.string().trim().email().optional()
});

export async function POST(request: Request) {
  const accessToken = bearerTokenFromRequest(request);
  if (!accessToken) {
    return NextResponse.json({ error: "Sign in to send a test email." }, { status: 401 });
  }

  try {
    const supabase = createSupabaseUserClient(accessToken);
    const { data: authData, error: authError } = await supabase.auth.getUser(accessToken);
    const user = authData.user;
    if (authError || !user) {
      return NextResponse.json({ error: "Session expired. Sign in again to send a test email." }, { status: 401 });
    }

    const parsedBody = requestSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsedBody.success) {
      return NextResponse.json({ error: "Enter a valid email address before sending a test." }, { status: 400 });
    }

    const { data: portfolioRow, error: portfolioError } = await supabase
      .from("user_portfolios")
      .select("holdings, settings, display_name, share_holdings, updated_at, user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (portfolioError) {
      return NextResponse.json({ error: `Cloud portfolio failed to load: ${portfolioError.message}` }, { status: 500 });
    }

    const row = portfolioRow as CloudPortfolioRow | null;
    const cloudPrefs = dailyReportEmailPrefsFromSettings(cloudSettingsFromRow(row || { holdings: [], settings: {} }));
    const requestedEmail = parsedBody.data.email ? normalizeReportEmail(parsedBody.data.email) : "";
    const recipient = requestedEmail || cloudPrefs.dailyReportEmail || user.email?.trim().toLowerCase() || "";

    if (!isValidReportEmail(recipient)) {
      return NextResponse.json({ error: "Enter a valid email address before sending a test." }, { status: 400 });
    }

    const profiles = row ? profilesFromCloudPortfolioRow(row) : defaultProfiles();
    const report = await buildPortfolioReport(profiles, { freshQuotes: true });
    const series = row?.user_id
      ? await fetchUserWeeklyChartSeries(supabase, user.id, row)
      : [];

    const delivery = await sendDailyReportEmail({
      to: recipient,
      report,
      series,
      displayName: row?.display_name || undefined,
      subjectPrefix: "[Test]"
    });

    if (!delivery.configured) {
      return NextResponse.json({
        error: delivery.warning || "Email delivery is not configured on the server."
      }, { status: 503 });
    }

    if (!delivery.sent) {
      return NextResponse.json({
        error: delivery.warning || "Test email could not be sent."
      }, { status: 502 });
    }

    return NextResponse.json({
      ok: true,
      sentTo: recipient,
      message: `Test email sent to ${recipient}. Check your inbox and spam folder.`
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Test email failed."
    }, { status: 500 });
  }
}
