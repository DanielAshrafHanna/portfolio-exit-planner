# Portfolio Exit Planner — Feature Log

Living reference for what the app does today, where it lives in the codebase, and what was added recently. Use this for audits, onboarding, and planning refactors.

**Last updated:** 15 June 2026  
**Production:** [portfolio-exit-planner.vercel.app](https://portfolio-exit-planner.vercel.app) (Vercel deploy from `main`)  
**Disclaimer:** Educational tool only — not financial advice, not auto-trading, no brokerage integration.

---

## 1. Product overview

Portfolio Exit Planner helps compare **exit scenarios** for stock and ETF holdings:

- Track positions (US and Egypt)
- Fetch live quotes, technical indicators, and news
- Run cautious AI analysis (Keep / Watch / Trim / Sell)
- Model stop-losses, take-profit targets, fee-aware P/L, and partial sales

Users always make the final decision. The app does not place trades.

---

## 2. Portfolio profiles and currencies

| Feature | Description |
|---------|-------------|
| **US portfolio** | Default profile; USD; Yahoo/Alpha Vantage quotes |
| **Egypt portfolio** | EGP; EGX symbols; Mubasher quotes for live EGX prices |
| **Profile switcher** | Create, rename, delete, and switch between profiles |
| **Per-profile settings** | Fee settings stored per profile |

**Key files:** `lib/profileUtils.ts`, `components/ProfileSelector.tsx`, `lib/types.ts`

---

## 3. Adding and editing holdings

| Method | Description |
|--------|-------------|
| **Quick add** | Symbol, shares, average cost from the portfolio workspace (desktop inline; mobile FAB / expanded form) |
| **Portfolio input table** | Full editable grid: symbol, name, shares, avg cost, total cost, broker value, notes |
| **CSV import** | Upload CSV; maps common column names |
| **CSV export** | Download current holdings as CSV |
| **Screenshot OCR** | User selects image → explicit “Extract” → Gemini vision parses rows (JPEG/PNG/WebP, max 8 MB) |
| **Unsupported ticker block** | Egyptian mutual fund tickers blocked with clear message (no fake prices) |

**Key files:** `components/QuickAddHolding.tsx`, `components/PortfolioInput.tsx`, `components/ImageImport.tsx`, `app/api/extractImage/route.ts`, `lib/unsupportedTickers.ts`

---

## 4. Holdings table (primary view)

### Desktop table

- Section headers: Position | Market | Analysis | Stop | Target | Risk
- Sortable columns (click headers): symbol, shares, avg cost, price, value, P/L, daily P/L, action, confidence, stop, stop P/L, target, target P/L, risk
- Expand row → Target planner + holding details
- Click target price → opens target planner

### Mobile table

- Two-row header with section splitters: **Position** | **Market** | **Target**
- Stacked cells: Cost (total + avg/sh), Value (value + shares), P/L ($ + %), Price (price + day %)
- Sort via bar above table (no sort arrows in headers)
- AI action badge under symbol (compact)
- No horizontal scroll; `table-fixed` layout

### Table utilities (added 2026)

| Feature | Description |
|---------|-------------|
| **Search** | Filter by ticker or company name (case-insensitive, partial match); clear button; “Showing X of Y” count |
| **Text fit (USD)** | Long values shrink to fit column without overlapping neighbors |
| **Text fit (EGP)** | Wider numeric columns, compact table money format (no `EGP` prefix in cells), dynamic `HoldingsFitText`, stacked P/L on desktop |
| **Stale quote marker** | Visual hint when a quote may be outdated |

**Key files:** `components/HoldingsTable.tsx`, `components/HoldingsSortControl.tsx`, `components/HoldingsFitText.tsx`, `lib/holdingSearch.ts`, `lib/holdingSort.ts`, `lib/holdingDisplay.ts`, `app/globals.css`

---

## 5. Portfolio summary

Summary cards (when quotes exist):

- Total value, total cost, current P/L
- Value at balanced stop, value at target
- Day P/L (portfolio aggregate)
- Highest risk holding callout

Responsive: compact labels on mobile.

**Key file:** `components/PortfolioSummary.tsx`

---

## 6. Market data and quotes

### Quote sources (server-side only)

| Region | Primary | Fallback |
|--------|---------|----------|
| **US** | Alpha Vantage (if `ALPHA_VANTAGE_API_KEY` / `MARKET_DATA_API_KEY`) | Yahoo Finance chart API (automatic on Alpha errors or missing key) |
| **EG (stocks)** | Mubasher EGX HTML parse | Unavailable (no mock price) |
| **Missing key** | Yahoo public feeds | Unavailable quote (not fake mock for production tickers) |

### US extended hours (restored with validation)

- Pre-market and after-hours prices shown when Yahoo `preMarketPrice` / `postMarketPrice` pass validation (within ~15% of regular price, not a stale copy of the last daily bar).
- Holdings table shows compact **Pre** / **AH** badges when `priceSession` is `pre` or `post`.
- Faster quote refresh during US extended sessions via `lib/marketRefresh.ts`.
- If Alpha Vantage fails for a symbol, the server falls back to Yahoo for that request instead of returning unavailable.

### Indicators computed (~1 year daily bars)

- MA 20 / 50 / 200, RSI (14), ATR (14), 52-week high/low, volume, daily % change

### News

- Alpha Vantage news sentiment (with API key), or Yahoo Finance RSS, or sample news with warning

### Live refresh

- Periodic quote polling (interval varies by region and tab visibility)
- Quotes and news are **runtime-only** — stripped on save/load (local + cloud) to avoid stale persisted prices
- Market API: `force-dynamic`, `fresh: true`, client `cache: "no-store"`

**Key files:** `lib/marketData.ts`, `app/api/market/route.ts`, `lib/marketRefresh.ts`, `lib/quoteCacheMigration.ts`

---

## 7. Analyze holdings (AI)

Triggered by **Analyze** button — refreshes market data, then calls AI per holding.

### What the model receives

- Holding: symbol, name, shares, costs, notes
- Quote: price, indicators, 52w range, volume
- News: up to 12 headlines (title, source, date, summary)
- Fixed system prompt + JSON schema (no invented news/catalysts)

### What it returns

- Action: Keep | Watch | Trim | Sell
- Confidence, risk, news sentiment, trend
- Bull/bear reasons, risk flags, suggested stop/target
- Catalysts only if supported; otherwise empty + explicit message

### Fallback (no API key / quota / malformed JSON)

- Rule-based analysis from MAs, P/L, RSI — **Low confidence**

**Env vars:** `GEMINI_API_KEY` (required), `GEMINI_MODEL` (optional, default `gemini-3.1-flash-lite`)

**Key files:** `app/api/analyzeHolding/route.ts`, `lib/geminiClient.ts`, `lib/aiFallback.ts`, `lib/validation.ts`

---

## 8. Expanded holding details

When a row is expanded:

### Target planner

| Stat | Description |
|------|-------------|
| **Current target** | Selected or default target sell price |
| **Breakeven** | Fee-aware sell price for $0 / EGP 0 net P/L |
| **P/L at target** | Profit/loss and % at current target |
| **Desired P/L input** | Enter target P/L → computes required sell price → Apply |

Responsive: 3 cards in a row on wider screens; stacked on narrow phones.

### Holding details panel

- Stop-loss selector (tight / balanced / loose) with explanations
- AI decision engine (summary, bull/bear, catalysts)
- Technical indicators table
- Recent news links
- Manual target slider + partial sell %
- P/L chart vs price

**Key files:** `components/TargetPlanner.tsx`, `components/HoldingDetails.tsx`, `components/StopLossSelector.tsx`, `components/ProfitLossChart.tsx`, `lib/calculations.ts`

---

## 9. Financial math (deterministic)

| Calculation | Notes |
|-------------|-------|
| **Stop-loss** | ATR-based (1.5× / 2.5× / 3.5×) or % fallback; profit-protection adjustments |
| **Default targets** | +5%, +10%, +15%, AI-suggested |
| **P/L** | Gross and net (fixed fee, % trading fee, FX fee) |
| **Partial sale** | Sold shares, realized P/L, remaining position |
| **Breakeven price** | `calculateSellPriceForProfitLoss(..., 0, settings)` |

**Key file:** `lib/calculations.ts` (+ `lib/calculations.test.ts`)

---

## 10. Authentication and cloud sync

| Feature | Description |
|---------|-------------|
| **Supabase auth** | Email/password sign-in and sign-up |
| **Sign in with display name** | After first cloud save; resolves via `/api/resolveLoginIdentifier` (service role, server-only) |
| **Mobile sign-up fix** | Dedicated password field on Create account tab |
| **Cloud portfolio** | One row per user; RLS — users read/write own data only |
| **Local fallback** | `localStorage` for guests and offline edits |
| **Merge logic** | Avoids empty cloud overwrite; session edit protection |
| **Sync badge** | Saving / saved / error states |
| **Admin-only messages** | Detailed Supabase/setup errors for admin email only |

**Key files:** `components/AuthPanel.tsx`, `app/api/resolveLoginIdentifier/route.ts`, `lib/portfolioStorage.ts`, `lib/portfolioSync.ts`, `supabase/schema.sql`

---

## 11. Shared portfolios

| Feature | Description |
|---------|-------------|
| **Opt-in sharing** | `share_holdings` toggle in settings |
| **View selector** | Switch between “My holdings” and friends’ shared portfolios |
| **Read-only mode** | No edits when viewing someone else’s portfolio |

**Key files:** `components/SharedHoldingsViewer.tsx`, `components/HoldingsViewSelector.tsx`, `app/page.tsx`

---

## 12. Settings and fees

| Setting | Description |
|---------|-------------|
| **Fixed trading fee** | Per-trade flat fee |
| **Percent trading fee** | % of gross sale value |
| **FX fee %** | Additional % fee (e.g. conversion) |
| **Clear stored portfolio** | Wipes local holdings and fee prefs |
| **Daily market-close email** | Opt-in email address + toggle; stored in cloud `settings` JSONB; delivered after US close via Resend |
| **Send test email** | Settings button calls `/api/daily-report-email/test` to verify delivery to any address |

Desktop: settings panel in sidebar. Mobile: Settings tab in bottom nav.

**Key files:** `components/SettingsPanel.tsx`, `components/SettingsDialog.tsx`, `components/MobileTabShell.tsx`, `components/DailyReportEmailSettings.tsx`, `lib/dailyReportEmailPrefs.ts`, `lib/userPrefs.ts`

---

## 13. Mobile UX

| Feature | Description |
|---------|-------------|
| **Bottom tab bar** | Portfolio ↔ Settings |
| **Mobile context bar** | Profile + sync at top |
| **FAB** | Quick add on mobile when holdings exist |
| **Safe area** | Bottom nav respects `safe-area-inset-bottom` |
| **Expand animation** | Light panel enter animation (`prefers-reduced-motion` respected) |

**Key files:** `components/MobileTabShell.tsx`, `components/MobileContextBar.tsx`, `components/DashboardShell.tsx`, `app/globals.css`

---

## 14. Daily portfolio report (`/report`)

Signed-in users get a dedicated report page with two tabs:

### Daily report tab

- Profile filter (US / Egypt / all)
- Currency totals, sortable holdings, stop/target columns
- Saved AI action/risk labels (no fresh AI run on page load)
- Warnings for missing data or stale quotes

### Charts tab

| Chart | Description |
|-------|-------------|
| **Daily P/L this week** | Signed bar chart, rolling 7-day window (region-aware week boundaries) |
| **Today's top movers** | Horizontal bar chart from live report holdings |
| **Cumulative weekly P/L** | Running 7-day total line chart |
| **Portfolio value trend** | 7-day gross value line chart |

Chart UX (2026): shared theme/colors, memoized domains, lazy-loaded chart components, reduced motion, aria summaries, legend, gradient fills, skeleton loading on profile switch.

History is stored in Supabase `portfolio_daily_snapshots` (one row per user/profile/day). Snapshots are written when:

1. A signed-in user opens `/report` or refreshes charts (`/api/portfolio-report`).
2. Vercel crons run (`vercel.json`): morning Cairo refresh, after EGX close, after US close (`?fresh=1`).

**Key files:** `app/report/page.tsx`, `components/ReportPageContent.tsx`, `components/PortfolioReportPanel.tsx`, `components/PortfolioReportChartsPanel.tsx`, `lib/portfolioReport.ts`, `lib/portfolioReportCharts.ts`, `lib/portfolioReportHistory.ts`, `lib/chartFormat.ts`, `app/api/portfolio-report/route.ts`, `app/api/portfolio-report/history/route.ts`

---

## 15. Daily email delivery (Resend)

Per-user opt-in emails after the US market-close cron (`0 22 * * *` UTC with `fresh=1`).

| Piece | Behavior |
|-------|----------|
| **Opt-in** | Settings: email address + enable toggle; synced to cloud `settings.dailyReportEmail` / `dailyReportEmailEnabled` |
| **Recipients** | Any valid address the user enters — not limited to the Resend account owner |
| **Content** | HTML + plain text: portfolio summary, top movers, inline SVG 7-day P/L charts |
| **Test send** | `POST /api/daily-report-email/test` (auth required); subject prefix `[Test]` |
| **Cron loop** | After US-close snapshots finish (`fresh=1` at 22:00 UTC), emails use the same run's fresh snapshot rows merged into 7-day chart history |

### Production email domain

- **Sending domain:** `stocks.danyhanna.uk` (verified in Resend, DNS on Cloudflare)
- **From address:** `Portfolio Exit Planner <reports@stocks.danyhanna.uk>`
- **Setup script:** `scripts/setup-resend-domain.mjs` (one-time Resend + Cloudflare DNS automation)
- **API keys:** Use a **Sending access** Resend key in Vercel; full-access key only needed for domain setup

**Key files:** `lib/emailReport.ts`, `lib/dailyReportEmailDelivery.ts`, `app/api/cron/daily-portfolio-summary/route.ts`, `app/api/daily-report-email/test/route.ts`

See also: [`docs/daily-portfolio-report.md`](docs/daily-portfolio-report.md)

---

## 16. Privacy and warnings

- Screenshots not sent until user clicks extract
- Warning banner for mock data, missing keys, AI fallback, Yahoo fallback
- Holdings hidden from shared/analysis UI until signed in (per product rules)
- Quotes/news never persisted to storage or cloud snapshot

**Key files:** `app/page.tsx` (`normalizeWarning`, `warningForAudience`), `lib/quoteCacheMigration.ts`

---

## 17. API routes (server-only)

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/market` | POST | Batch quotes + news for holdings |
| `/api/analyzeHolding` | POST | Gemini structured analysis per holding |
| `/api/extractImage` | POST | Gemini vision OCR for screenshots |
| `/api/resolveLoginIdentifier` | POST | Resolve display name → email for sign-in |
| `/api/portfolio-report` | GET | Signed-in daily report JSON + snapshot upsert |
| `/api/portfolio-report/history` | GET | Rolling chart history (`days=7` default) |
| `/api/cron/daily-portfolio-summary` | GET | Vercel Cron: snapshots for all cloud users + opted-in emails |
| `/api/daily-report-email/test` | POST | Signed-in test email to verify Resend delivery |

All validate input with Zod. Secrets stay in Vercel env vars. Cron routes require `Authorization: Bearer $CRON_SECRET`.

---

## 18. Testing

```bash
npm test      # Vitest — lib + API route tests
npm run build # Next.js production build
npm run lint  # ESLint
```

**170+ tests** covering calculations, market parsing, validation, migrations, report charts, email delivery, and API routes.

---

## 19. Codebase map (audit quick reference)

```
app/
  page.tsx              # Main dashboard orchestration
  report/page.tsx       # Daily report + charts page
  api/
    market/             # Quotes + news
    analyzeHolding/     # AI analysis
    extractImage/       # OCR
    resolveLoginIdentifier/
    portfolio-report/   # Report JSON + history
    cron/daily-portfolio-summary/
    daily-report-email/test/
components/
  HoldingsTable.tsx     # Primary holdings UI + search
  ReportPageContent.tsx # Report + charts tabs
  DailyReportEmailSettings.tsx
  TargetPlanner.tsx     # Target / breakeven stats
  HoldingDetails.tsx    # Expanded holding panel
  AuthPanel.tsx         # Sign in / up
  PortfolioInput.tsx    # Edit grid + CSV
  ImageImport.tsx       # Screenshot upload
lib/
  calculations.ts       # Financial math (pure)
  marketData.ts         # External market providers + extended-hours validation
  marketRefresh.ts      # Quote polling intervals
  portfolioReport.ts    # Server report builder
  portfolioReportCharts.ts
  emailReport.ts        # Resend HTML/text emails
  dailyReportEmailDelivery.ts
  holdingSearch.ts      # Table search filter
  holdingSort.ts        # Table sort
  validation.ts         # Zod schemas
  portfolioStorage.ts   # localStorage
  portfolioSync.ts      # Cloud merge rules
scripts/
  setup-resend-domain.mjs  # One-time Resend + Cloudflare DNS for stocks.danyhanna.uk
supabase/
  schema.sql            # RLS + user_portfolios + portfolio_daily_snapshots
docs/
  daily-portfolio-report.md
vercel.json             # Cron schedules
```

---

## 20. Changelog (recent additions)

| Date (approx.) | Feature |
|----------------|---------|
| Jun 2026 | **Verified email domain** — `stocks.danyhanna.uk` on Resend + Cloudflare; production sends from `reports@stocks.danyhanna.uk` |
| Jun 2026 | **Send test email** — Settings button + `/api/daily-report-email/test` |
| Jun 2026 | **Per-user daily emails** — opt-in in Settings; cron emails movers + 7-day chart SVGs to any address |
| Jun 2026 | **Daily report + Charts** — `/report` page, snapshots, weekly P/L/value/movers charts, region-aware 7-day window |
| Jun 2026 | **Alpha → Yahoo failsafe** — US quotes fall back to Yahoo when Alpha Vantage errors |
| Jun 2026 | **Extended hours v2** — validated pre/post prices with Pre/AH badges; faster refresh in extended sessions |
| Jun 2026 | **Vercel crons** — morning refresh, post-EGX close, post-US close (`fresh=1`) snapshot jobs |
| Jun 2026 | **Gemini AI** — stock analysis + screenshot OCR via Gemini free tier |
| Jun 2026 | **PWA install** — add to home screen via web manifest + service worker |
| Jun 2026 | Holdings table **search** by ticker or name |
| Jun 2026 | Target planner **breakeven** stat card (fee-aware zero P/L price) |
| Jun 2026 | **EGP table layout** — shrink-to-fit, wider columns, compact format |
| Earlier | Supabase auth, cloud sync, shared portfolios, AI analysis, OCR, Egypt Mubasher quotes, stop/target planner |

---

## 21. Environment variables (checklist)

| Variable | Required | Purpose |
|----------|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | For auth/cloud | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | For auth/cloud | Browser client key (RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | For display-name login | Server-only |
| `GEMINI_API_KEY` | For AI/OCR | Gemini API (free tier) |
| `GEMINI_MODEL` | Optional | Default `gemini-3.1-flash-lite` (newest free-tier multimodal model) |
| `MARKET_DATA_API_KEY` / `ALPHA_VANTAGE_API_KEY` | Optional | Alpha Vantage US quotes/news |
| `MARKET_DATA_PROVIDER` | Optional | `alpha_vantage` or `yahoo` |
| `CRON_SECRET` | For crons | Protects `/api/cron/daily-portfolio-summary` |
| `RESEND_API_KEY` | For email | Sending-access Resend key |
| `REPORT_FROM_EMAIL` | For email | e.g. `Portfolio Exit Planner <reports@stocks.danyhanna.uk>` |

---

## 22. Known limitations and removed features

- **No auto-trading** or broker connections
- **Extended-hours prices** only when Yahoo extended fields pass validation; otherwise regular/closed session price is shown
- **Egyptian mutual funds** not supported (no live quote source)
- **AI catalysts** only from supplied data; model must not invent events
- **Resend domain setup** requires a full-access API key once; production uses sending-only key

---

## 23. Suggested audit order

1. `lib/calculations.ts` + tests — money math correctness  
2. `lib/marketData.ts` + `app/api/market/route.ts` — quote accuracy and fallbacks  
3. `lib/quoteCacheMigration.ts` — no stale prices in storage  
4. `app/api/analyzeHolding/route.ts` — prompt, validation, fallback  
5. `components/HoldingsTable.tsx` — primary UX and data display  
6. `app/page.tsx` — sync, race conditions, warning handling  
7. `lib/dailyReportEmailDelivery.ts` + `lib/emailReport.ts` — cron email loop and Resend payloads  
8. `supabase/schema.sql` — RLS policies and snapshot table  

---

*Update this file when adding user-visible features or changing architecture.*
