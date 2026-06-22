---
name: portfolio-change
description: Use when implementing, reviewing, or debugging changes in the Portfolio Exit Planner app. Applies to Next.js, React, TypeScript, market data, portfolio math, UI, and daily report behavior.
---

# Portfolio Change

Use this skill for ordinary app work in this repository.

## Workflow

1. Read `AGENTS.md` before editing.
2. Identify the smallest set of files needed for the request.
3. Preserve the app's educational-only financial safety boundary.
4. Keep deterministic financial logic in `lib/` when practical.
5. Validate untrusted inputs and external data before using or storing them.
6. Guard async updates so stale requests cannot overwrite newer holdings, profiles, warnings, or target prices.
7. Match the existing UI and TypeScript patterns.
8. Add or update focused tests when changing pure logic, parsing, validation, storage migration, or async merge behavior.

## Verification

Choose the narrowest useful checks first, then broaden when the change touches shared behavior.

- For pure logic: run the relevant Vitest file.
- For UI or API changes: run related tests plus `npm run build` when practical.
- For production-ready handoff: run `npm test`, `npm run build`, and `npm run lint`.

## Do Not Do

- Do not add brokerage integrations, order placement, auto-trading, or guaranteed-outcome language.
- Do not expose server secrets to frontend code.
- Do not silently hide data failures that affect user decisions.
- Do not make broad cosmetic rewrites unrelated to the user request.
