---
name: supabase-safe-change
description: Use when working with Supabase schema, SQL, RLS, migrations, auth, storage, or persisted portfolio data in this app.
---

# Supabase Safe Change

Use this skill before making any Supabase change.

## Safety Checklist

1. Read `AGENTS.md` and inspect existing Supabase files or live schema relevant to the request.
2. State the SQL plan before applying destructive, production, or user-data-impacting work.
3. Keep changes scoped to the requested table, policy, function, or data set.
4. Do not modify, delete, truncate, rename, or migrate unrelated production portfolio data.
5. Do not weaken existing RLS policies, grants, or auth boundaries.
6. Prefer idempotent SQL for repeatable setup work.
7. Verify with a read query after applying changes.
8. Report exactly what was changed and what was intentionally untouched.

## Data Rules

- Treat Supabase JSON and all persisted user-controlled data as untrusted.
- Use server-side service access only when it is required and never expose service credentials in client code.
- Preserve private cloud portfolio sync behavior and existing RLS protections.

## Verification Query Pattern

For data inserts or upserts, verify identity fields, row count, timestamps, active flags, and a stable length/hash when storing large text.
