#!/usr/bin/env node

import { createCipheriv, pbkdf2Sync, randomBytes } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

const DEFAULT_OUT_DIR = "docs/reports";
const DEFAULT_PASSWORD_ENV = "REPORT_ENCRYPTION_PASSWORD";
const DEFAULT_ITERATIONS = 310000;
const REPORT_FILE_RE = /^portfolio-report-(\d{4}-\d{2}-\d{2})\.enc\.json$/;

function usage() {
  console.log(`Usage:
  REPORT_ENCRYPTION_PASSWORD="strong passphrase" node scripts/encrypt-report.mjs <input-html> [options]

Options:
  --date YYYY-MM-DD        Report session date. Inferred from the input filename when possible.
  --title "Title"          Report title stored as non-sensitive metadata.
  --out-dir PATH           Output directory. Default: ${DEFAULT_OUT_DIR}
  --password-env NAME      Environment variable containing the passphrase. Default: ${DEFAULT_PASSWORD_ENV}
  --iterations NUMBER      PBKDF2 iterations. Default: ${DEFAULT_ITERATIONS}
  --delete-input           Delete the raw HTML input after encryption.
  --help                   Show this help.
`);
}

function parseArgs(argv) {
  const options = {
    outDir: DEFAULT_OUT_DIR,
    passwordEnv: DEFAULT_PASSWORD_ENV,
    iterations: DEFAULT_ITERATIONS,
    title: "Daily Portfolio Report",
    deleteInput: false,
  };
  const positional = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (arg === "--delete-input") {
      options.deleteInput = true;
    } else if (arg === "--date") {
      options.date = argv[++i];
    } else if (arg === "--title") {
      options.title = argv[++i];
    } else if (arg === "--out-dir") {
      options.outDir = argv[++i];
    } else if (arg === "--password-env") {
      options.passwordEnv = argv[++i];
    } else if (arg === "--iterations") {
      options.iterations = Number(argv[++i]);
    } else if (arg.startsWith("--")) {
      throw new Error(`Unknown option: ${arg}`);
    } else {
      positional.push(arg);
    }
  }

  options.input = positional[0];
  return options;
}

function assertValidOptions(options) {
  if (options.help) return;
  if (!options.input) throw new Error("Missing input HTML path.");
  if (!Number.isInteger(options.iterations) || options.iterations < 100000) {
    throw new Error("PBKDF2 iterations must be an integer >= 100000.");
  }
}

function inferDate(inputPath) {
  const match = path.basename(inputPath).match(/(\d{4}-\d{2}-\d{2})/);
  return match?.[1];
}

function assertValidDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "")) {
    throw new Error("Report date must use YYYY-MM-DD.");
  }
}

function base64(buffer) {
  return Buffer.from(buffer).toString("base64");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function encodeReportParam(fileName) {
  return `viewer.html?report=${encodeURIComponent(fileName)}`;
}

async function writeLatestHtml(outDir) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="refresh" content="0; url=${encodeReportParam("latest.enc.json")}">
  <link rel="canonical" href="${encodeReportParam("latest.enc.json")}">
  <title>Latest Encrypted Portfolio Report</title>
</head>
<body>
  <p>Opening the latest encrypted report. If it does not open automatically, use this link:
    <a href="${encodeReportParam("latest.enc.json")}">latest encrypted report</a>.
  </p>
</body>
</html>
`;
  await fs.writeFile(path.join(outDir, "latest.html"), html, "utf8");
}

async function readReportEntries(outDir) {
  const names = await fs.readdir(outDir).catch(() => []);
  const entries = [];

  for (const name of names) {
    const match = name.match(REPORT_FILE_RE);
    if (!match) continue;

    try {
      const raw = await fs.readFile(path.join(outDir, name), "utf8");
      const payload = JSON.parse(raw);
      entries.push({
        fileName: name,
        reportDate: payload.reportDate || match[1],
        title: payload.title || "Daily Portfolio Report",
      });
    } catch {
      entries.push({
        fileName: name,
        reportDate: match[1],
        title: "Daily Portfolio Report",
      });
    }
  }

  entries.sort((a, b) => b.reportDate.localeCompare(a.reportDate));
  return entries;
}

function renderArchiveItems(entries) {
  if (!entries.length) {
    return '<li class="empty">No encrypted reports have been published yet.</li>';
  }

  return entries.map((entry) => `      <li>
        <a href="${encodeReportParam(entry.fileName)}">${escapeHtml(entry.title)}</a>
        <time datetime="${escapeHtml(entry.reportDate)}">${escapeHtml(entry.reportDate)}</time>
      </li>`).join("\n");
}

async function writeArchiveIndex(outDir) {
  const entries = await readReportEntries(outDir);
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Encrypted Daily Portfolio Report Archive</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f4f7fb;
      --surface: #ffffff;
      --border: #d8e1ec;
      --text: #172033;
      --muted: #5e6b7d;
      --accent: #1d6fd8;
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
      background: var(--bg);
      color: var(--text);
      padding: 24px;
    }

    main {
      width: min(900px, 100%);
      margin: 0 auto;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 28px;
      box-shadow: 0 12px 40px rgba(23, 32, 51, 0.08);
    }

    header {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      align-items: flex-start;
      border-bottom: 1px solid var(--border);
      padding-bottom: 16px;
      margin-bottom: 18px;
    }

    h1 {
      margin: 0 0 6px;
      font-size: clamp(26px, 5vw, 38px);
      line-height: 1.1;
    }

    p {
      margin: 0;
      color: var(--muted);
      line-height: 1.6;
    }

    a {
      color: var(--accent);
      font-weight: 700;
      text-decoration: none;
    }

    a:hover { text-decoration: underline; }

    .latest {
      display: inline-flex;
      align-items: center;
      min-height: 44px;
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 10px 14px;
      white-space: nowrap;
    }

    ol {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 10px;
    }

    li {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      gap: 8px;
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 14px 16px;
      background: #fff;
    }

    .empty {
      color: var(--muted);
      justify-content: flex-start;
    }

    time { color: var(--muted); }

    @media (max-width: 620px) {
      header { display: grid; }
      .latest { justify-content: center; }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <div>
        <h1>Encrypted Daily Portfolio Report Archive</h1>
        <p>Reports are published as encrypted files and opened in the browser with your report password.</p>
      </div>
      <a class="latest" href="${encodeReportParam("latest.enc.json")}">Open Latest</a>
    </header>

    <ol>
${renderArchiveItems(entries)}
    </ol>
  </main>
</body>
</html>
`;
  await fs.writeFile(path.join(outDir, "index.html"), html, "utf8");
}

async function encryptReport(options) {
  const reportDate = options.date || inferDate(options.input);
  assertValidDate(reportDate);

  const password = process.env[options.passwordEnv]?.trim();
  if (!password || password.length < 16) {
    throw new Error(`${options.passwordEnv} must be set to a strong passphrase of at least 16 characters.`);
  }

  const inputPath = path.resolve(options.input);
  const outDir = path.resolve(options.outDir);
  const html = await fs.readFile(inputPath);
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = pbkdf2Sync(password, salt, options.iterations, 32, "sha256");
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(html), cipher.final()]);
  const tag = cipher.getAuthTag();
  const ciphertext = Buffer.concat([encrypted, tag]);

  const fileName = `portfolio-report-${reportDate}.enc.json`;
  const payload = {
    version: 1,
    algorithm: "AES-256-GCM",
    kdf: "PBKDF2-SHA256",
    iterations: options.iterations,
    salt: base64(salt),
    iv: base64(iv),
    ciphertext: base64(ciphertext),
    contentType: "text/html; charset=utf-8",
    title: options.title,
    reportDate,
    createdAt: new Date().toISOString(),
    sourceName: path.basename(inputPath),
    plaintextBytes: html.byteLength,
  };

  await fs.mkdir(outDir, { recursive: true });
  const datedPath = path.join(outDir, fileName);
  await fs.writeFile(datedPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  await fs.copyFile(datedPath, path.join(outDir, "latest.enc.json"));
  await writeLatestHtml(outDir);
  await writeArchiveIndex(outDir);

  if (options.deleteInput) {
    await fs.rm(inputPath, { force: true });
  }

  console.log(`Encrypted report: ${path.relative(process.cwd(), datedPath)}`);
  console.log(`Latest pointer: ${path.relative(process.cwd(), path.join(outDir, "latest.enc.json"))}`);
  console.log(`Viewer URL path: reports/${encodeReportParam(fileName)}`);
  console.log(`Latest URL path: reports/${encodeReportParam("latest.enc.json")}`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  assertValidOptions(options);
  if (options.help) {
    usage();
    return;
  }
  await encryptReport(options);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
