# Daily Portfolio Report

The daily portfolio report is generated server-side from Supabase cloud portfolio data. It does not log in with a browser, store a password, or scrape the deployed UI.

## What It Adds

- `/report`: an interactive signed-in report page with profile tabs, currency totals, sortable holdings, stop/target values, warnings, and saved AI action/risk labels.
- `/api/portfolio-report`: an authenticated JSON report endpoint for the currently signed-in user.
- `/api/cron/daily-portfolio-summary`: a Vercel Cron endpoint that builds the configured user's report and optionally emails it.
- `vercel.json`: schedules the cron at `0 5 * * *`, which is 05:00 UTC. That is around 8:00 AM Cairo during daylight saving time.

## Required Environment Variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Browser/auth key used by the signed-in report route. |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes for cron | Server-only key used by the cron route to read the configured user's portfolio. |
| `CRON_SECRET` | Yes for cron | Bearer token Vercel sends to protect the cron endpoint. |
| `PORTFOLIO_REPORT_USER_ID` | Yes for cron | Supabase `auth.users.id` for the account whose portfolio should be summarized. |
| `MARKET_DATA_PROVIDER` | Recommended | Set to `alpha_vantage` for real market data. |
| `MARKET_DATA_API_KEY` or `ALPHA_VANTAGE_API_KEY` | Recommended | Market data key. Without it, the app falls back to Yahoo/public or sample providers where available. |
| `RESEND_API_KEY` | Optional | Enables daily email delivery. |
| `REPORT_TO_EMAIL` | Optional | Comma-separated recipient list for email delivery. |
| `REPORT_FROM_EMAIL` | Optional | Verified Resend sender address. |
| `GEMINI_API_KEY` | Optional | Needed for AI analysis elsewhere in the app. The daily report displays saved AI labels but does not run a fresh AI analysis by default. |

## How To Find `PORTFOLIO_REPORT_USER_ID`

In Supabase:

1. Open Authentication.
2. Open Users.
3. Copy the `User UID` for the account you want reported.
4. Set that value as `PORTFOLIO_REPORT_USER_ID` in Vercel.

## Manual Testing

After deployment, call the cron route manually with the same secret:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://portfolio-exit-planner.vercel.app/api/cron/daily-portfolio-summary
```

The response includes the structured report JSON. If email variables are missing, the JSON response includes an email setup warning instead of failing the report.

## Security Notes

- Do not paste portfolio credentials into chat or environment variables.
- Do not expose `SUPABASE_SERVICE_ROLE_KEY` with a `NEXT_PUBLIC_` prefix.
- Keep `CRON_SECRET` long and random.
- The signed-in `/report` page uses the user's Supabase access token and RLS-protected data.
- The cron route is protected by `CRON_SECRET` and only reads the configured `PORTFOLIO_REPORT_USER_ID` row.
