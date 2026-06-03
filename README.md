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

- `OPENAI_API_KEY`: enables AI decision analysis and image OCR.
- `OPENAI_MODEL`: optional, defaults to `gpt-4o-mini`.
- `OPENAI_VISION_MODEL`: optional, defaults to `gpt-4o-mini`.
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
- Screenshots are not sent anywhere until the user clicks `Extract from image`.
- The UI warns when tickers or images are sent to external APIs.
- `Clear stored portfolio` removes local holdings and fee settings.

## Tests

```bash
npm test
```

The calculation tests cover cost basis, fee-aware P/L, ATR and percentage stop-loss rules, default targets, and partial-sale math.

## Deployment

This version is saved for review and has not been deployed. For Codex Sites or another Next.js-capable host, configure the environment variables above, build with `npm run build`, then deploy after review.
