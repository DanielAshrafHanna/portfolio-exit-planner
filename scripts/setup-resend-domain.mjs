#!/usr/bin/env node
/**
 * One-time setup: Resend sending domain + Cloudflare DNS for danyhanna.uk
 *
 * Usage:
 *   RESEND_API_KEY=re_xxx CLOUDFLARE_API_TOKEN=xxx node scripts/setup-resend-domain.mjs
 *
 * Optional:
 *   SEND_SUBDOMAIN=stocks.danyhanna.uk
 *   FROM_ADDRESS="Portfolio Exit Planner <reports@stocks.danyhanna.uk>"
 */

const SEND_SUBDOMAIN = process.env.SEND_SUBDOMAIN || "stocks.danyhanna.uk";
const ROOT_DOMAIN = SEND_SUBDOMAIN.includes(".")
  ? SEND_SUBDOMAIN.split(".").slice(-2).join(".")
  : SEND_SUBDOMAIN;
const FROM_ADDRESS = process.env.FROM_ADDRESS || `Portfolio Exit Planner <reports@${SEND_SUBDOMAIN}>`;
const RESEND_API_KEY = process.env.RESEND_API_KEY?.trim();
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN?.trim();

if (!RESEND_API_KEY) {
  console.error("Missing RESEND_API_KEY.");
  process.exit(1);
}

async function resend(path, options = {}) {
  const response = await fetch(`https://api.resend.com${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!response.ok) {
    throw new Error(`Resend ${path} failed (${response.status}): ${text}`);
  }
  return data;
}

async function cloudflare(path, options = {}) {
  if (!CLOUDFLARE_API_TOKEN) return null;
  const response = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(`Cloudflare ${path} failed: ${JSON.stringify(data)}`);
  }
  return data.result;
}

function normalizeRecordName(recordName) {
  return recordName.replace(/\.$/, "");
}

async function ensureResendDomain() {
  const listed = await resend("/domains");
  const existing = (listed.data || []).find((item) => item.name === SEND_SUBDOMAIN);
  if (existing) {
    console.log(`Resend domain already exists: ${SEND_SUBDOMAIN} (${existing.id}) status=${existing.status}`);
    const detail = await resend(`/domains/${existing.id}`);
    return detail;
  }

  console.log(`Creating Resend domain ${SEND_SUBDOMAIN}...`);
  const created = await resend("/domains", {
    method: "POST",
    body: JSON.stringify({
      name: SEND_SUBDOMAIN,
      region: "us-east-1",
      custom_return_path: "bounce",
      open_tracking: false,
      click_tracking: false
    })
  });
  return created;
}

async function upsertCloudflareRecords(records) {
  if (!CLOUDFLARE_API_TOKEN) {
    console.log("\nNo CLOUDFLARE_API_TOKEN — add these DNS records manually in Cloudflare:\n");
    records.forEach((record) => {
      console.log(`- ${record.type} ${record.name} -> ${record.value} (priority: ${record.priority ?? "n/a"})`);
    });
    return;
  }

  const zones = await cloudflare(`/zones?name=${ROOT_DOMAIN}`);
  const zone = zones?.[0];
  if (!zone) throw new Error(`Cloudflare zone not found for ${ROOT_DOMAIN}`);

  console.log(`Using Cloudflare zone ${zone.name} (${zone.id})`);

  const existing = await cloudflare(`/zones/${zone.id}/dns_records?per_page=100`);
  for (const record of records) {
    const name = normalizeRecordName(record.name);
    const content = (record.value || "").replace(/\.$/, "");
    const type = record.type;
    const priority = record.priority ?? undefined;
    const match = existing.find((item) => (
      item.type === type
      && item.name === name
      && item.content.replace(/\.$/, "") === content
    ));

    const payload = {
      type,
      name,
      content,
      ttl: 1,
      proxied: false,
      ...(priority !== undefined ? { priority } : {})
    };

    if (match) {
      console.log(`DNS exists: ${type} ${name}`);
      continue;
    }

    console.log(`Creating DNS: ${type} ${name} -> ${content}`);
    await cloudflare(`/zones/${zone.id}/dns_records`, {
      method: "POST",
      body: JSON.stringify(payload)
    });
  }
}

async function verifyDomain(domainId) {
  console.log("Triggering Resend verification...");
  await resend(`/domains/${domainId}/verify`, { method: "POST" });
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const detail = await resend(`/domains/${domainId}`);
    console.log(`Verification status: ${detail.status}`);
    if (detail.status === "verified") return detail;
    if (detail.status === "failed") throw new Error("Domain verification failed in Resend.");
    await new Promise((resolve) => setTimeout(resolve, 10_000));
  }
  throw new Error("Domain not verified yet. DNS may still be propagating — retry later.");
}

async function main() {
  const domain = await ensureResendDomain();
  const domainId = domain.id;
  const records = domain.records || [];
  if (!records.length) {
    const refreshed = await resend(`/domains/${domainId}`);
    records.push(...(refreshed.records || []));
  }

  await upsertCloudflareRecords(records);

  try {
    await verifyDomain(domainId);
  } catch (error) {
    console.warn(error instanceof Error ? error.message : String(error));
  }

  console.log("\nNext: update Vercel REPORT_FROM_EMAIL to:");
  console.log(FROM_ADDRESS);
  console.log("\nExample:");
  console.log(`printf '%s' '${FROM_ADDRESS}' | vercel env rm REPORT_FROM_EMAIL production -y && printf '%s' '${FROM_ADDRESS}' | vercel env add REPORT_FROM_EMAIL production`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
