const EMAIL_NOISE_PATTERNS = [
  /alpha vantage (failed|rate limit|free-tier)/i,
  /using yahoo finance (fallback|quotes)/i,
  /egypt quotes are fetched from mubasher/i,
  /quotes are fetched from yahoo finance/i,
  /market api key is missing, so quotes are fetched from yahoo/i,
  /news is fetched from yahoo finance rss/i,
  /news api key is missing/i,
  /showing sample news/i
];

function stripAlphaVantageBoilerplate(warning: string) {
  return warning
    .replace(/\s*\(Thank you for using Alpha Vantage![\s\S]*$/i, "")
    .replace(/\s*You may subscribe to any of the premium plans[\s\S]*$/i, "")
    .trim();
}

function warningBody(warning: string) {
  const profileSplit = warning.match(/^([^:]+):\s*(.+)$/);
  return profileSplit?.[2]?.trim() || warning;
}

export function isEmailNoiseWarning(warning: string) {
  const normalized = stripAlphaVantageBoilerplate(warning);
  const body = warningBody(normalized);
  return EMAIL_NOISE_PATTERNS.some((pattern) => pattern.test(normalized) || pattern.test(body));
}

/** Keep only user-actionable warnings in daily emails; hide quote-source transparency noise. */
export function sanitizeReportWarningsForEmail(warnings: string[]) {
  const seen = new Set<string>();
  return warnings
    .map(stripAlphaVantageBoilerplate)
    .filter(Boolean)
    .filter((warning) => !isEmailNoiseWarning(warning))
    .filter((warning) => {
      if (seen.has(warning)) return false;
      seen.add(warning);
      return true;
    });
}

export function stripWarningsFromTextDigest(textDigest: string) {
  const marker = "\nWarnings:";
  const index = textDigest.indexOf(marker);
  return index >= 0 ? textDigest.slice(0, index).trim() : textDigest;
}
