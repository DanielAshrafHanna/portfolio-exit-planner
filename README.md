# Portfolio Exit Planner

Educational React/Next.js app for comparing portfolio exit plans. It accepts manual holdings, CSV imports, or screenshot OCR, fetches market/news data through server-side routes, and shows stop-losses, take-profit targets, fee-aware P/L, partial-sale math, and a cautious AI Hold / Watch / Trim / Sell decision.

This is not an auto-trading app. It does not place trades, connect to brokerages, or provide financial advice. The final decision is always yours.

## Setup

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Environment Variables

Add these secrets in your deployment environment:

- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL for user accounts and cloud portfolios.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase anon/publishable key. Safe for browser use when RLS is enabled.
- `SUPABASE_SERVICE_ROLE_KEY`: server-only Supabase service role key used by `/api/resolveLoginIdentifier` to let users sign in with a previously saved display name. Never expose this as a `NEXT_PUBLIC_` variable.
- `GEMINI_API_KEY`: enables AI decision analysis and screenshot OCR via the Gemini API free tier ([Google AI Studio](https://aistudio.google.com/)).
- `GEMINI_MODEL`: optional, defaults to `gemini-2.5-flash`.
- `MARKET_DATA_PROVIDER`: set to `alpha_vantage` for the real provider, or leave unset/use `mock`.
- `MARKET_DATA_API_KEY`: Alpha Vantage API key for quotes, indicators, and news.
- `ALPHA_VANTAGE_API_KEY`: optional alias for `MARKET_DATA_API_KEY`.
- `NEWS_API_KEY`: reserved if you add a separate news provider later.

API keys are read only in server routes. They are not exposed in frontend code. If market keys are missing, the app first tries Yahoo Finance public quote/news feeds from the server. If no public quote is available for a ticker, it falls back to sample data and shows a warning banner.

## Formula Notes

Stop-loss levels are deterministic:

- Tight stop: `current price - 1.5 * ATR`, or about 6% below current price when ATR is unavailable.
- Balanced stop: `current price - 2.5 * ATR`, or about 10% below current price when ATR is unavailable.
- Loose stop: `current price - 3.5 * ATR`, or about 18% below current price when ATR is unavailable.

When a position is profitable, stops are adjusted when reasonable to protect part of the open gain. When a position is losing, stops are kept focused on limiting further downside rather than assuming recovery.

Default take-profit targets:

- Target 1: current price + 5%.
- Target 2: current price + 10%.
- Target 3: current price + 15%.
- AI target: returned by `/api/analyzeHolding`, or a fallback target if AI is unavailable.

Profit/loss calculations:

- Current value: `shares * current price`, before optional trading and FX fees.
- Gross P/L: `value - total cost`.
- Net P/L: `gross value - fixed fee - percentage trading fee - FX fee - cost basis`.
- Partial selling calculates sold shares, realized P/L, remaining shares, remaining value, and remaining unrealized P/L.

## AI Decision Engine

`/api/analyzeHolding` instructs the model to use only supplied portfolio data, quote data, indicators, news, and verified catalysts. It must return structured JSON only and must not invent news, dates, catalysts, analyst changes, or ETF facts. If no reliable catalyst is supplied, it returns `upcomingCatalysts: []` and says `No verified upcoming catalyst found.`

## Privacy

- Holdings and settings are stored locally with `localStorage`.
- If Supabase is configured, signed-in users can save/load a private cloud portfolio row protected by Row Level Security.
- Holdings, profiles, shared portfolios, and analysis tables are hidden until a user signs in.
- Detailed warnings and cloud setup/error messages are shown only to the admin account.
- Screenshots are not sent anywhere until the user clicks `Extract from image`.
- The UI warns when tickers or images are sent to external APIs.
- `Clear stored portfolio` removes local holdings and fee settings.

## Tests

```bash
npm test
```

The calculation tests cover cost basis, fee-aware P/L, ATR and percentage stop-loss rules, default targets, and partial-sale math.

## Supabase Auth And User Portfolios

Run the SQL in `supabase/schema.sql` in your Supabase project SQL editor. It creates `public.user_portfolios` with Row Level Security so each signed-in user can update only their own portfolio. Users can optionally enable sharing, which lets other signed-in users read that shared row through the app's shared holdings view.

The schema includes:

- `display_name`: friendly user name shown in shared portfolio selectors; emails are not shown in the shared view.
- `share_holdings`: opt-in toggle for whether other signed-in users can read that user's US and Egypt portfolio profiles.
- Admin metadata for `danielhanna0001@gmail.com`, used by the UI to show setup logs/error details only to the admin.

Users can sign in with either email or an exact display name after their cloud portfolio has saved at least once. If multiple users have the same display name, the app asks for email instead of guessing.

If Supabase says a new column is missing from the schema cache, rerun the full SQL file. The final `notify pgrst, 'reload schema';` line asks Supabase/PostgREST to refresh the API schema cache.

Recommended Supabase Auth setup:

- Enable email/password auth or magic links.
- For a small friend group, restrict signups by invite or manually create users in the Supabase dashboard.
- Do not hardcode shared credentials in the app.
- Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to Vercel project environment variables.

## Install on your phone (PWA)

Portfolio Exit Planner can be installed like an app from the browser. This is a **Progressive Web App (PWA)** — not a downloadable `.apk` from the site.

**Android (Chrome)**

1. Open the deployed site in Chrome.
2. Tap the menu (⋮) → **Install app**, or use the in-app **Install app** banner when it appears.
3. The app icon is added to your home screen and opens full-screen.

**iPhone (Safari)**

1. Open the site in Safari (not Chrome).
2. Tap **Share** → **Add to Home Screen**.
3. Confirm the name and tap **Add**.

**Notes**

- Quotes, cloud sync, AI analysis, and login still need an internet connection.
- The service worker is disabled during local `npm run dev`; test install behavior on the production Vercel deploy after `npm run build`.

## Deployment

Deploy to Vercel (or any Next.js host): configure the environment variables above, build with `npm run build`, and push to `main` for automatic deploys.

## Future update recommendations

### US pre-market and after-hours prices (removed)

We briefly showed Yahoo `preMarketPrice` / `postMarketPrice` during extended sessions, with small **Pre** / **AH** badges in the holdings table. That feature was **removed** because Yahoo’s public chart API often returns **stale or wrong** extended-hours values while `regularMarketPrice` stays correct (for example, AAPL showing ~153 when the real regular price was ~291).

**Current behavior:** US quotes use Yahoo `regularMarketPrice` only — the official regular-session price (last close when the market is closed).

**To add extended hours again later, consider:**

1. **Validate before display** — only use `preMarketPrice` / `postMarketPrice` if they are within a sane band of `regularMarketPrice` (e.g. within ~15% on liquid US stocks); otherwise fall back to regular.
2. **Prefer a dedicated quote endpoint** — Yahoo chart `meta` on `range=1y&interval=1d` is built for daily bars, not reliable live extended-hours ticks. Evaluate Alpha Vantage `GLOBAL_QUOTE`, a paid market data API, or an intraday chart request (`interval=1m` / `5m` with `range=1d`) and compare against a known-good source (e.g. broker app).
3. **Session labeling** — reintroduce `priceSession` (`pre` | `regular` | `post` | `closed`) and UI badges only when the chosen price is validated.
4. **Regression tests** — keep a fixture where `postMarketPrice` is stale but `regularMarketPrice` is correct; assert the app never shows the stale value.
5. **Polling** — if extended hours return, consider faster quote refresh during pre-market (≈4:00–9:30 ET) and after-hours (≈16:00–20:00 ET), not only during regular session.

Relevant code paths: [`lib/marketData.ts`](lib/marketData.ts) (`parseYahooChartQuote`), live quote polling in [`lib/marketRefresh.ts`](lib/marketRefresh.ts) and [`app/page.tsx`](app/page.tsx).

### Mobile motion and app-like navigation (partial)

**Current behavior:** smooth document scrolling (`scroll-behavior: smooth`), touch momentum (`-webkit-overflow-scrolling: touch`), and a light expand-panel animation when opening holding details / Target Planner.

**Future improvements for a more native feel:**

1. **View Transitions API** — animate route/tab changes (portfolio ↔ settings) without full page jumps.
2. **Shared element transitions** — subtle fade/slide when expanding a holding row.
3. **Spring-based motion** — consider a small library (e.g. Framer Motion) for row expand/collapse and summary card updates, with `prefers-reduced-motion` fallbacks.
4. **Scroll containers** — audit nested `overflow-x` wrappers; avoid horizontal scroll chaining on iOS Safari.
5. **Haptic-friendly targets** — keep 44px minimum tap targets on mobile actions (already targeted in holdings table).

Relevant files: [`app/globals.css`](app/globals.css), [`components/HoldingsTable.tsx`](components/HoldingsTable.tsx), [`components/MobileTabShell.tsx`](components/MobileTabShell.tsx).
