#!/usr/bin/env node
/**
 * Refresh post-close portfolio snapshots before the daily AI HTML report.
 *
 * Required env:
 *   CRON_SECRET              — same value as Vercel CRON_SECRET
 *   PORTFOLIO_APP_URL        — optional; defaults to production app URL
 *
 * Usage (from repo root):
 *   node scripts/refresh-daily-snapshot.mjs
 *
 * Calls /api/cron/daily-portfolio-summary?fresh=1&snapshotsOnly=1 so quotes are
 * fetched after US close without sending the simpler daily email (that still runs
 * on the 22:00 UTC Vercel cron).
 */

const appUrl = (process.env.PORTFOLIO_APP_URL || "https://portfolio-exit-planner.vercel.app").replace(/\/$/, "");
const cronSecret = process.env.CRON_SECRET;

if (!cronSecret) {
  console.error("CRON_SECRET is not set. Add it to the Cursor automation secrets.");
  process.exit(1);
}

const endpoint = `${appUrl}/api/cron/daily-portfolio-summary?fresh=1&snapshotsOnly=1`;

const response = await fetch(endpoint, {
  headers: { Authorization: `Bearer ${cronSecret}` }
});

const bodyText = await response.text();
let body;
try {
  body = JSON.parse(bodyText);
} catch {
  body = { raw: bodyText };
}

if (!response.ok) {
  console.error(`Snapshot refresh failed (${response.status}):`, body);
  process.exit(1);
}

const processed = body.snapshots?.processed ?? 0;
const failed = body.snapshots?.failed ?? 0;

console.log(JSON.stringify({
  ok: body.ok === true,
  processed,
  failed,
  snapshotWarnings: body.snapshotWarnings || [],
  message: body.emails?.warning || "Post-close snapshots refreshed (emails skipped)."
}, null, 2));

if (body.ok !== true || failed > 0) {
  process.exit(1);
}

if (processed === 0) {
  console.error("No portfolios were snapshotted. Check cloud holdings and cron logs.");
  process.exit(1);
}
