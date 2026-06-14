# Daily Portfolio Report

The daily portfolio report is generated server-side from Supabase cloud portfolio data. It does not log in with a browser, store a password, or scrape the deployed UI.

## What It Adds

- `/report`: an interactive signed-in report page with **Daily report** and **Charts** tabs, profile filters, currency totals, sortable holdings, stop/target values, warnings, and saved AI action/risk labels.
- `/api/portfolio-report`: an authenticated JSON report endpoint for the currently signed-in user. Also upserts today's per-profile snapshot rows for chart history.
- `/api/portfolio-report/history`: an authenticated rolling history endpoint (`days=7` by default) for weekly chart data.
- `/api/cron/daily-portfolio-summary`: a Vercel Cron endpoint that saves daily snapshots for **every** cloud portfolio user and optionally emails one configured account.
- `portfolio_daily_snapshots` in Supabase: one row per user/profile/day with daily P/L, portfolio value, and cost-basis P/L.
- `vercel.json`: schedules three crons:
  - `0 5 * * *` — morning refresh (~8:00 AM Cairo), good for EGX open and pre-US.
  - `30 13 * * *` — after EGX close (~3:30 PM Cairo).
  - `0 22 * * *` — after US close with `?fresh=1` for end-of-day quotes.

## Charts Tab

The **Charts** tab on `/report` includes:

- **Daily P/L this week**: signed bar chart for the rolling last 7 days. Losses render below zero on the y-axis.
- **Today's top movers**: horizontal bar chart from the live report (works immediately, no history required).
- **Cumulative weekly P/L**: running 7-day total line chart.
- **Portfolio value trend**: 7-day gross value line chart.

History is captured when:

1. A signed-in user opens `/report` or refreshes the Charts tab (`/api/portfolio-report`).
2. The daily cron runs and snapshots **all** rows in `user_portfolios` that have at least one holding symbol.

Empty portfolios are skipped. Users with cloud holdings get chart history even if they never open `/report`.

Older days before deployment will show as empty bars until enough market-day snapshots accumulate.

## Supabase Setup For Chart History

Run the updated SQL in [`supabase/schema.sql`](../supabase/schema.sql), including the `portfolio_daily_snapshots` table and RLS policies, then reload the PostgREST schema cache.

## History API

```bash
curl -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  "https://portfolio-exit-planner.vercel.app/api/portfolio-report/history?days=7&profileId=all"
```

Response shape:

```json
{
  "days": 7,
  "profileId": "all",
  "series": [
    {
      "currency": "USD",
      "profileId": "us-portfolio",
      "profileName": "US Portfolio",
      "points": [
        {
          "date": "Jun 13",
          "snapshotDate": "2026-06-13",
          "dailyProfitLoss": 20,
          "dailyProfitLossPercent": 1.7,
          "portfolioValue": 1200,
          "totalProfitLoss": 200,
          "hasData": true
        }
      ]
    }
  ],
  "warnings": []
}
```

## Required Environment Variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Browser/auth key used by the signed-in report route. |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes for cron | Server-only key used by the cron route to read the configured user's portfolio. |
| `CRON_SECRET` | Yes for cron | Bearer token Vercel sends to protect the cron endpoint. |
| `PORTFOLIO_REPORT_USER_ID` | Optional | Supabase `auth.users.id` for the one account that should receive the optional daily email. Snapshots run for all users without this. |
| `MARKET_DATA_PROVIDER` | Recommended | Set to `alpha_vantage` when `ALPHA_VANTAGE_API_KEY` is configured; otherwise `yahoo` (default on Vercel). |
| `MARKET_DATA_API_KEY` or `ALPHA_VANTAGE_API_KEY` | Recommended | Alpha Vantage key for US quotes/news. Without it, the app uses Yahoo Finance and Mubasher EGX. |
| `RESEND_API_KEY` | Optional | Enables daily email delivery. |
| `REPORT_TO_EMAIL` | Optional | Comma-separated recipient list for email delivery. |
| `REPORT_FROM_EMAIL` | Optional | Verified Resend sender address. |
| `GEMINI_API_KEY` | Optional | Needed for AI analysis elsewhere in the app. The daily report displays saved AI labels but does not run a fresh AI analysis by default. |

## How To Find `PORTFOLIO_REPORT_USER_ID`

Only needed if you want one daily email summary. Snapshots do not depend on it.

In Supabase:

1. Open Authentication.
2. Open Users.
3. Copy the `User UID` for the account you want emailed.
4. Set that value as `PORTFOLIO_REPORT_USER_ID` in Vercel.

## Manual Testing

After deployment, call the cron route manually with the same secret:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://portfolio-exit-planner.vercel.app/api/cron/daily-portfolio-summary
```

The response includes snapshot counts for all users (`processed`, `skipped`, `failed`) and, when configured, the emailed user's report JSON. If email variables are missing, the JSON response includes an email setup warning instead of failing snapshots.

## Security Notes

- Do not paste portfolio credentials into chat or environment variables.
- Do not expose `SUPABASE_SERVICE_ROLE_KEY` with a `NEXT_PUBLIC_` prefix.
- Keep `CRON_SECRET` long and random.
- The signed-in `/report` page uses the user's Supabase access token and RLS-protected data.
- The cron route is protected by `CRON_SECRET` and uses the service role to read all `user_portfolios` rows for snapshotting.
