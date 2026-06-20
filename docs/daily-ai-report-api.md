# Daily AI Report Data API

Server-only endpoint for automation tools (Cursor Cloud Agents, scripts, cron jobs) to fetch verified portfolio holdings, snapshot freshness metadata, chart history, and optional live report rows without querying Supabase directly.

## Endpoint

```http
GET /api/cron/daily-ai-report-data
Authorization: Bearer $CRON_SECRET
```

Production base URL:

```text
https://portfolio-exit-planner.vercel.app/api/cron/daily-ai-report-data
```

## Authentication

This route uses the same secret as the existing daily snapshot cron:

| Variable | Required | Purpose |
| --- | --- | --- |
| `CRON_SECRET` | Yes | Bearer token for all `/api/cron/*` automation routes |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes on server | Resolves email → user and reads cloud portfolio rows |
| `DAILY_AI_REPORT_ALLOWED_EMAILS` | Optional | Comma-separated allowlist. If empty, any existing cloud user email is allowed |

Send the secret exactly like the snapshot refresh script:

```bash
curl -sf \
  -H "Authorization: Bearer $CRON_SECRET" \
  "https://portfolio-exit-planner.vercel.app/api/cron/daily-ai-report-data?email=danielhanna0001@gmail.com"
```

Never expose `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, or `REPORT_ENCRYPTION_PASSWORD` in git, HTML reports, or email bodies.

## Query Parameters

| Parameter | Default | Values | Description |
| --- | --- | --- | --- |
| `email` | _(required)_ | valid email | Cloud portfolio owner to load |
| `profileId` | `all` | `all`, `us-portfolio`, `eg-portfolio` | Which profile(s) to return |
| `historyDays` | `30` | `1`–`30` | Rolling snapshot history window for charts |
| `report` | `0` | `0`, `1` | When `1`, also builds live report rows via `buildPortfolioReport()` |
| `fresh` | `0` | `0`, `1` | When `report=1`, fetch fresh market quotes instead of cached quotes |

### Profile selection examples

All profiles (US + Egypt):

```bash
curl -sf -H "Authorization: Bearer $CRON_SECRET" \
  "https://portfolio-exit-planner.vercel.app/api/cron/daily-ai-report-data?email=danielhanna0001@gmail.com&profileId=all"
```

US portfolio only:

```bash
curl -sf -H "Authorization: Bearer $CRON_SECRET" \
  "https://portfolio-exit-planner.vercel.app/api/cron/daily-ai-report-data?email=danielhanna0001@gmail.com&profileId=us-portfolio"
```

Egypt portfolio only:

```bash
curl -sf -H "Authorization: Bearer $CRON_SECRET" \
  "https://portfolio-exit-planner.vercel.app/api/cron/daily-ai-report-data?email=danielhanna0001@gmail.com&profileId=eg-portfolio"
```

Include live report rows with fresh quotes:

```bash
curl -sf -H "Authorization: Bearer $CRON_SECRET" \
  "https://portfolio-exit-planner.vercel.app/api/cron/daily-ai-report-data?email=danielhanna0001@gmail.com&profileId=us-portfolio&report=1&fresh=1"
```

## Recommended Automation Flow

On US market open days, call endpoints in this order:

1. Refresh post-close snapshots:

```bash
node scripts/refresh-daily-snapshot.mjs
```

2. Fetch verified portfolio data for the report owner:

```bash
curl -sf -H "Authorization: Bearer $CRON_SECRET" \
  "https://portfolio-exit-planner.vercel.app/api/cron/daily-ai-report-data?email=danielhanna0001@gmail.com&profileId=all&historyDays=30"
```

3. Check each returned profile:

- `snapshot.missing` must be `false`
- `snapshot.freshAfterClose` should be `true` after the US/EG cash session you are reporting on
- use `snapshot.updatedAt`, not `createdAt`, for freshness

4. Generate the HTML report, encrypt it, email it, and push encrypted Pages files.

## Response Shape

Successful responses return JSON like:

```json
{
  "ok": true,
  "email": "danielhanna0001@gmail.com",
  "userId": "uuid",
  "ownershipVerified": true,
  "profileId": "all",
  "activeProfileId": "us-portfolio",
  "availableProfiles": [
    {
      "id": "us-portfolio",
      "name": "US Portfolio",
      "region": "US",
      "currency": "USD",
      "holdingsCount": 12
    }
  ],
  "generatedAt": "2026-06-18T22:10:00.000Z",
  "cloudUpdatedAt": "2026-06-18T18:02:11.000Z",
  "profiles": [
    {
      "id": "us-portfolio",
      "name": "US Portfolio",
      "region": "US",
      "currency": "USD",
      "sessionDate": "2026-06-18",
      "sessionLabel": "Wed, Jun 18",
      "snapshot": {
        "snapshotDate": "2026-06-18",
        "sessionLabel": "Wed, Jun 18",
        "updatedAt": "2026-06-18T21:05:00.000Z",
        "createdAt": "2026-06-18T13:00:00.000Z",
        "freshAfterClose": true,
        "missing": false,
        "portfolioValue": 12500.42,
        "dailyProfitLoss": -84.12,
        "dailyProfitLossPercent": -0.67,
        "totalProfitLoss": 820.5,
        "holdingsCount": 12,
        "holdings": [
          {
            "symbol": "AAPL",
            "name": "Apple",
            "shares": 10,
            "average_cost": 180,
            "current_value": 2100,
            "profit_loss": 300,
            "daily_profit_loss": -12.5,
            "daily_profit_loss_percent": -0.59,
            "weightPercent": 16.8,
            "notes": "Core position",
            "action": "Keep",
            "riskLevel": "Medium"
          }
        ]
      },
      "dailyAi": {
        "profileId": "us-portfolio",
        "marketDate": "2026-06-18",
        "generatedAt": "2026-06-18T21:06:00.000Z",
        "analysesBySymbol": {}
      }
    }
  ],
  "history": [],
  "warnings": []
}
```

### Important fields

| Field | Meaning |
| --- | --- |
| `ownershipVerified` | Requested email matches the resolved Supabase auth user |
| `availableProfiles` | All profiles stored for the user; use this to discover valid `profileId` values |
| `profiles[].snapshot.freshAfterClose` | `updated_at` is after regional cash close for the snapshot session date |
| `profiles[].snapshot.holdings` | Post-close holdings snapshot merged with notes, targets, and saved AI labels |
| `profiles[].dailyAi` | Saved daily AI cache entry for that profile, if present |
| `profiles[].report` | Present only when `report=1`; live calculated rows from `buildPortfolioReport()` |
| `history` | Rolling chart series filtered to the requested `profileId` |
| `warnings` | Non-fatal data issues such as stale snapshots or missing history |

## Error Responses

| Status | When |
| --- | --- |
| `401` | Missing or invalid `Authorization: Bearer $CRON_SECRET` |
| `403` | Email blocked by `DAILY_AI_REPORT_ALLOWED_EMAILS` |
| `404` | Email not found, or no cloud portfolio row exists |
| `400` | Invalid `profileId` or malformed request |
| `503` | `CRON_SECRET` or Supabase admin config missing on the server |

Example ownership failure:

```json
{
  "error": "The report cannot be completed accurately because I could not verify that the holdings belong to missing@example.com. Please provide a holdings export or reconnect the correct portfolio profile."
}
```

## What This API Does Not Provide

This endpoint is the source of truth for **your portfolio accounting** only:

- holdings, weights, cost basis, snapshot P/L, saved AI labels, chart history

It does **not** replace external research sources for the HTML report:

- RSI, MACD, moving averages, volume comparisons
- recent news, earnings dates, benchmarks such as SPY / QQQ / EGX30

Those still come from public market sources during report generation.

## Related Routes

| Route | Auth | Purpose |
| --- | --- | --- |
| `/api/cron/daily-portfolio-summary` | `CRON_SECRET` | Refresh snapshots for all cloud users |
| `/api/portfolio-report` | User Supabase JWT | Signed-in interactive report page |
| `/api/portfolio-report/history` | User Supabase JWT | Signed-in chart history |

## Local Testing

```bash
export CRON_SECRET=your-local-secret
export SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
npm run dev
```

Then:

```bash
curl -sf -H "Authorization: Bearer $CRON_SECRET" \
  "http://localhost:3000/api/cron/daily-ai-report-data?email=danielhanna0001@gmail.com&profileId=us-portfolio"
```

## Implementation Files

- `app/api/cron/daily-ai-report-data/route.ts`
- `lib/dailyAiReportData.ts`
- `scripts/refresh-daily-snapshot.mjs`
