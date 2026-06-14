const ALPHA_FALLBACK_PATTERN = /Alpha Vantage failed for ([A-Z0-9.-]+); using Yahoo Finance fallback/i;

function stripAlphaVantageBoilerplate(warning: string) {
  return warning
    .replace(/\s*\(Thank you for using Alpha Vantage![\s\S]*$/i, "")
    .replace(/\s*You may subscribe to any of the premium plans[\s\S]*$/i, "")
    .trim();
}

export function sanitizeReportWarningsForEmail(warnings: string[]) {
  const alphaByProfile = new Map<string, Set<string>>();
  const other: string[] = [];
  const seenOther = new Set<string>();

  warnings.forEach((raw) => {
    const warning = stripAlphaVantageBoilerplate(raw.trim());
    if (!warning) return;

    const profileSplit = warning.match(/^([^:]+):\s*(.+)$/);
    const profileName = profileSplit?.[1]?.trim();
    const message = profileSplit?.[2]?.trim() || warning;
    const alphaMatch = message.match(ALPHA_FALLBACK_PATTERN);

    if (profileName && alphaMatch) {
      const symbols = alphaByProfile.get(profileName) || new Set<string>();
      symbols.add(alphaMatch[1]);
      alphaByProfile.set(profileName, symbols);
      return;
    }

    if (!seenOther.has(warning)) {
      seenOther.add(warning);
      other.push(warning);
    }
  });

  const collapsedAlpha = [...alphaByProfile.entries()].map(([profileName, symbols]) => {
    const list = [...symbols];
    if (list.length === 1) {
      return `${profileName}: Alpha Vantage rate limit hit for ${list[0]}; using Yahoo Finance quotes.`;
    }
    const preview = list.slice(0, 4).join(", ");
    const suffix = list.length > 4 ? ", …" : "";
    return `${profileName}: Alpha Vantage rate limit hit for ${list.length} symbols (${preview}${suffix}); using Yahoo Finance quotes.`;
  });

  return [...collapsedAlpha, ...other];
}
