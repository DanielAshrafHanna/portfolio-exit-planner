# Portfolio Exit Planner — Feature Log

Living reference for what the app does today, where it lives in the codebase, and what was added recently. Use this for audits, onboarding, and planning refactors.

**Last updated:** June 2026  
**Production:** Vercel deploy from `main`  
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
| **Screenshot OCR** | User selects image → explicit “Extract” → OpenAI vision parses rows (JPEG/PNG/WebP, max 8 MB) |
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
| **US** | Alpha Vantage (if `MARKET_DATA_API_KEY`) | Yahoo Finance chart API |
| **EG (stocks)** | Mubasher EGX HTML parse | Unavailable (no mock price) |
| **Missing key** | Yahoo public feeds | Unavailable quote (not fake mock for production tickers) |

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

**Env vars:** `OPENAI_API_KEY` (required), `OPENAI_MODEL`, `OPENAI_VISION_MODEL` (optional)

**Key files:** `app/api/analyzeHolding/route.ts`, `lib/aiFallback.ts`, `lib/validation.ts`

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

Desktop: settings panel in sidebar. Mobile: Settings tab in bottom nav.

**Key files:** `components/SettingsPanel.tsx`, `components/SettingsDialog.tsx`, `components/MobileTabShell.tsx`

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

## 14. Privacy and warnings

- Screenshots not sent until user clicks extract
- Warning banner for mock data, missing keys, AI fallback, Yahoo fallback
- Holdings hidden from shared/analysis UI until signed in (per product rules)
- Quotes/news never persisted to storage or cloud snapshot

**Key files:** `app/page.tsx` (`normalizeWarning`, `warningForAudience`), `lib/quoteCacheMigration.ts`

---

## 15. API routes (server-only)

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/market` | POST | Batch quotes + news for holdings |
| `/api/analyzeHolding` | POST | OpenAI structured analysis per holding |
| `/api/extractImage` | POST | OpenAI vision OCR for screenshots |
| `/api/resolveLoginIdentifier` | POST | Resolve display name → email for sign-in |

All validate input with Zod. Secrets stay in Vercel env vars.

---

## 16. Testing

```bash
npm test      # Vitest — lib + API route tests
npm run build # Next.js production build
npm run lint  # ESLint
```

**98+ tests** covering calculations, market parsing, validation, migrations, key components.

---

## 17. Codebase map (audit quick reference)

```
app/
  page.tsx              # Main dashboard orchestration
  api/
    market/             # Quotes + news
    analyzeHolding/     # AI analysis
    extractImage/       # OCR
    resolveLoginIdentifier/
components/
  HoldingsTable.tsx     # Primary holdings UI + search
  TargetPlanner.tsx     # Target / breakeven stats
  HoldingDetails.tsx    # Expanded holding panel
  AuthPanel.tsx         # Sign in / up
  PortfolioInput.tsx    # Edit grid + CSV
  ImageImport.tsx       # Screenshot upload
lib/
  calculations.ts       # Financial math (pure)
  marketData.ts         # External market providers
  holdingSearch.ts      # Table search filter
  holdingSort.ts        # Table sort
  validation.ts         # Zod schemas
  portfolioStorage.ts   # localStorage
  portfolioSync.ts      # Cloud merge rules
supabase/
  schema.sql            # RLS + user_portfolios
```

---

## 18. Changelog (recent additions)

| Date (approx.) | Feature |
|----------------|---------|
| Jun 2026 | **Instant portfolio backup** — local cache + faster cloud save on every edit; restores newer local data after reload |
| Jun 2026 | **Company name search** — Yahoo `longName`/`shortName` fills holdings; search matches names like Apple → AAPL |
| Jun 2026 | Holdings table **search** by ticker or name |
| Jun 2026 | Target planner **breakeven** stat card (fee-aware zero P/L price) |
| Jun 2026 | **EGP table layout** — full large numbers visible (shrink-to-fit, wider columns, compact format) |
| Jun 2026 | **Table text overflow fix** — dynamic fit text, no column overlap |
| Jun 2026 | **Mobile sign-up** — separate password field on Create account |
| Jun 2026 | **Mobile table** — section headers, stacked cells, unified table layout |
| Jun 2026 | **Live Yahoo quotes fix** — correct headers, no persisted stale quotes, unavailable instead of mock |
| Earlier | Supabase auth, cloud sync, shared portfolios, AI analysis, OCR, Egypt Mubasher quotes, stop/target planner |

---

## 19. Environment variables (checklist)

| Variable | Required | Purpose |
|----------|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | For auth/cloud | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | For auth/cloud | Browser client key (RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | For display-name login | Server-only |
| `OPENAI_API_KEY` | For AI/OCR | Chat + vision |
| `OPENAI_MODEL` | Optional | Analysis model |
| `OPENAI_VISION_MODEL` | Optional | OCR model |
| `MARKET_DATA_API_KEY` | Optional | Alpha Vantage |
| `MARKET_DATA_PROVIDER` | Optional | `alpha_vantage` or mock |

---

## 20. Known limitations and removed features

- **No auto-trading** or broker connections
- **No extended-hours US prices** (removed — Yahoo extended quotes were often stale; see README “Future update recommendations”)
- **Egyptian mutual funds** not supported (no live quote source)
- **ChatGPT subscription ≠ API billing** — OpenAI API is pay-as-you-go separately
- **AI catalysts** only from supplied data; model must not invent events

---

## 21. Suggested audit order

1. `lib/calculations.ts` + tests — money math correctness  
2. `lib/marketData.ts` + `app/api/market/route.ts` — quote accuracy and fallbacks  
3. `lib/quoteCacheMigration.ts` — no stale prices in storage  
4. `app/api/analyzeHolding/route.ts` — prompt, validation, fallback  
5. `components/HoldingsTable.tsx` — primary UX and data display  
6. `app/page.tsx` — sync, race conditions, warning handling  
7. `supabase/schema.sql` — RLS policies  

---

*Update this file when adding user-visible features or changing architecture.*
