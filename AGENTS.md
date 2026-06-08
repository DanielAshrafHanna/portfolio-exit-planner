# AGENTS.md

## Project Summary

Portfolio Exit Planner is an educational Next.js app for comparing possible exits from stock/ETF holdings. Users can enter holdings manually, import CSVs, upload screenshots for OCR extraction, fetch market/news data, and compare stop-loss/take-profit scenarios with fee-aware profit/loss calculations and a cautious AI Hold/Watch/Trim/Sell analysis.

This is not a trading app, not a brokerage integration, and not financial advice. It must never place trades or imply guaranteed outcomes.

## Tech Stack

- Next.js App Router, React, TypeScript.
- Tailwind CSS for styling.
- Vitest for unit tests.
- Zod for request/response validation.
- Supabase browser client for auth and private cloud portfolio sync.
- OpenAI server-side routes for AI analysis and OCR.
- Market/news data server-side provider abstraction in `lib/marketData.ts`.

## Important Files And Folders

- `app/page.tsx`: main client dashboard, profile state, localStorage hydration, Supabase sync, market refresh, and analysis orchestration.
- `app/api/market/route.ts`: server-only market/news fetch endpoint.
- `app/api/analyzeHolding/route.ts`: server-only AI analysis endpoint.
- `app/api/extractImage/route.ts`: server-only OCR endpoint for uploaded screenshots.
- `components/`: reusable UI pieces such as portfolio input, image import, summary, holdings table, details, stop selector, settings, and auth/profile panels.
- `lib/calculations.ts`: deterministic financial math. Keep this pure and covered by tests.
- `lib/marketData.ts`: provider normalization, quote/news fetching, and external market fallback behavior.
- `lib/validation.ts`: Zod schemas for API input and AI/external response validation.
- `lib/storageMigration.ts`: local/cloud portfolio coercion and migration helpers.
- `lib/holdingMerge.ts`: safe merge helpers for async analysis results.
- `lib/types.ts`: shared domain types.
- `supabase/schema.sql`: `user_portfolios` table, RLS policies, and grants.
- `*.test.ts` under `lib/`: unit tests for pure logic and parsing behavior.

## Setup Commands

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Build, Test, And Lint

```bash
npm test
npm run build
npm run lint
```

`npm run lint` uses `eslint .` with `eslint.config.mjs`. Do not revert it to deprecated `next lint`.

## TypeScript And React Conventions

- Keep strict TypeScript compatibility. Avoid `any`; use `unknown`, Zod schemas, type guards, or explicit domain types.
- Keep domain logic in pure helpers under `lib/` when practical.
- Preserve small, reviewable changes. Do not rewrite the whole app unless explicitly asked.
- Be careful with `useEffect` dependencies. If an effect is intentionally keyed by a stable fingerprint, document that locally.
- Guard async state updates so stale market/AI requests cannot overwrite newer holdings, profiles, target prices, or warnings.
- Keep API keys and service clients out of client components unless they are intentionally public, such as Supabase anon/publishable keys.

## UI/UX Conventions

- Preserve the current product behavior and visual style unless a change is needed for reliability or usability.
- Keep the dashboard clear on desktop and responsive on mobile.
- Highlight important decision fields such as current price, current P/L, stop-loss, target sell price, and P/L at target.
- Use plain language for financial controls. Avoid jargon without explanation.
- Keep screenshots/OCR flow explicit: users choose a file and click extraction before any image is sent externally.
- Show honest warnings for missing API keys, mock/sample data, failed fetches, OCR failures, and AI fallback analysis.

## API And Security Rules

- Never expose `OPENAI_API_KEY`, market data API keys, or other secrets in frontend code.
- Keep OpenAI, market-data, news, and OCR calls server-side through `app/api/*`.
- Validate request bodies with Zod before processing.
- Validate AI and external provider responses before trusting or storing them.
- Reject malformed input safely with useful errors.
- Keep OCR upload limits and allowed file types reasonable. Do not send uploaded screenshots to external AI unless the user explicitly starts extraction.
- Supabase browser code may use `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`; private data access must rely on RLS in `supabase/schema.sql`.
- Do not use Supabase service-role keys in browser code.

## Financial-Analysis Safety Rules

- Always keep the educational disclaimer visible or preserved.
- Never describe output as financial advice.
- Never guarantee returns, recoveries, or sell outcomes.
- Never add order placement, broker connection, auto-trading, or trade execution behavior.
- AI analysis must use only supplied holdings, quote/indicator data, supplied news, and verified catalysts.
- AI must not invent news, dates, analyst changes, catalysts, ETF holdings, or facts. If data is missing, say so.
- Financial calculations must remain deterministic and testable.

## Testing Expectations

- Add or update tests when changing:
  - `lib/calculations.ts`
  - storage migration/coercion
  - market/news parsing or fallback behavior
  - AI response validation
  - OCR parsing/normalization
  - async merge behavior that protects user edits
- Prefer pure helper tests over brittle UI tests when the behavior can be isolated.
- Keep calculation tests exact and fee-aware.
- Run `npm test`, `npm run build`, and `npm run lint` before handing off production-quality changes.

## Definition Of Done

- The app builds successfully.
- Tests pass.
- Lint passes.
- Strict TypeScript issues are resolved without unsafe shortcuts.
- External/API/AI data is validated before use.
- Async requests cannot overwrite newer user state.
- User-facing warnings are honest and useful.
- No secrets are exposed to the frontend.
- Financial-analysis behavior remains educational and non-trading.
- Changes are scoped, understandable, and documented when needed.

## Things Codex Must Not Do

- Do not add auto-trading, brokerage execution, or order placement.
- Do not hardcode credentials or shared login passwords.
- Do not expose server secrets through `NEXT_PUBLIC_*` or client components.
- Do not trust AI JSON, OCR JSON, market data, localStorage, CSV data, or Supabase JSON without validation/coercion.
- Do not silently hide failures that affect user decisions.
- Do not remove RLS protections or weaken Supabase policies.
- Do not add new production dependencies unless clearly justified.
- Do not make cosmetic rewrites or broad refactors unrelated to the task.
- Do not change deterministic formulas without tests and a clear explanation.
