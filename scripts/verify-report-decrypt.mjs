#!/usr/bin/env node

import { createDecipheriv, pbkdf2Sync } from "node:crypto";
import { readFileSync } from "node:fs";

const file = process.argv[2] || "docs/reports/portfolio-report-2026-06-19.enc.json";
const password = process.env.REPORT_ENCRYPTION_PASSWORD?.trim();

if (!password) {
  console.error("REPORT_ENCRYPTION_PASSWORD is not set.");
  process.exit(1);
}

const payload = JSON.parse(readFileSync(file, "utf8"));
const salt = Buffer.from(payload.salt, "base64");
const iv = Buffer.from(payload.iv, "base64");
const data = Buffer.from(payload.ciphertext, "base64");
const tag = data.subarray(data.length - 16);
const enc = data.subarray(0, data.length - 16);
const key = pbkdf2Sync(password, salt, payload.iterations, 32, "sha256");
const decipher = createDecipheriv("aes-256-gcm", key, iv);
decipher.setAuthTag(tag);
const plain = Buffer.concat([decipher.update(enc), decipher.final()]);
console.log(`OK ${file}: ${plain.byteLength} bytes, title=${payload.title}`);
