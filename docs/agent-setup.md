# Cursor And Codex Agent Setup

This repo is set up so Cursor and Codex share the same durable project guidance while still using each app's native extension points.

## What Goes Where

| Purpose | Location | Used By | File Name |
| --- | --- | --- | --- |
| Repo-wide project instructions | `AGENTS.md` | Codex and Cursor | `AGENTS.md` |
| Cursor project rules | `.cursor/rules/` | Cursor | Any name ending in `.mdc` |
| Shared agent skills | `.agents/skills/<skill-name>/` | Codex and Cursor | `SKILL.md` |
| Codex command approval rules | `.codex/rules/` or `~/.codex/rules/` | Codex | Any name ending in `.rules` |
| Personal Codex defaults | `~/.codex/AGENTS.md` | Codex | `AGENTS.md` |
| Personal Cursor rules | Cursor Settings | Cursor | Stored by Cursor |

## Recommended Pattern For This Repo

Use `AGENTS.md` as the main source of truth for project behavior:

- financial safety rules
- architecture boundaries
- setup, build, lint, and test commands
- security expectations
- files agents should inspect first

Use `.cursor/rules/*.mdc` only for Cursor-specific routing and scoped reminders. Cursor rules should be short and should avoid duplicating all of `AGENTS.md`.

Use `.agents/skills/*/SKILL.md` for repeatable workflows that an agent may choose only when relevant, such as:

- safely changing Supabase schema or data
- making a production-ready app change
- preparing a GitHub push
- debugging market data

## Current Files

- `AGENTS.md`: main repo instructions for both tools.
- `.cursor/rules/portfolio-core.mdc`: always-on Cursor rule that points Cursor back to `AGENTS.md`.
- `.cursor/rules/frontend-ui.mdc`: scoped Cursor guidance for app and component UI files.
- `.cursor/rules/server-data-security.mdc`: scoped Cursor guidance for API, Supabase, and market/AI data files.
- `.agents/skills/portfolio-change/SKILL.md`: shared skill for normal implementation work in this app.
- `.agents/skills/supabase-safe-change/SKILL.md`: shared skill for safe Supabase work.
- `.agents/skills/impeccable-design/SKILL.md`: shared frontend polish and visual QA skill.
- `.agents/skills/email-kowalski-design/SKILL.md`: shared email/report design skill.
- `.agents/skills/taste/SKILL.md`: shared aesthetic judgment and simplification skill.

## Naming Rules

Cursor rules:

- Must be `.mdc` files.
- Can be named anything descriptive, such as `frontend-ui.mdc`.
- Need frontmatter with fields like `alwaysApply`, `description`, and/or `globs`.

Agent skills:

- Must live in a folder.
- The folder name and `name` frontmatter should match.
- Must use `SKILL.md` exactly.
- Recommended name format: lowercase words separated by hyphens.

Example:

```text
.agents/
  skills/
    supabase-safe-change/
      SKILL.md
```

```md
---
name: supabase-safe-change
description: Use when changing Supabase schema, RLS, SQL, or persisted data.
---
```

Codex command approval rules are different from Cursor project rules. They are not markdown. Only add `.rules` files when you want to control which shell commands Codex may run outside the sandbox.
