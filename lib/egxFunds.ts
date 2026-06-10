import type { MarketQuote } from "./types";

export type EgxFundConfig = {
  fundId?: number;
  names: string[];
};

export const EGX_FUNDS_BY_SYMBOL: Record<string, EgxFundConfig> = {
  AZG: {
    fundId: 5989,
    names: ["Azimut Gold (az-gold)", "az-gold", "AZ - Gold", "Azimut Gold"]
  },
  BFI: {
    names: ["Beltone 3 Financial Sector", "Beltone Financial Sectorial Fund"]
  },
  BRE: {
    names: ["Beltone 4 Real Estate Sector", "Beltone Real Estate Sectorial Fund"]
  },
  BIN: {
    names: ["Beltone 5 Industrial Sector", "Beltone Industrial Sectorial Fund"]
  },
  BCO: {
    names: ["Beltone 6 Consumer Sector", "Beltone Consumer Sectorial Fund"]
  }
};

export const MUBASHER_FUND_PRICE_ARTICLE_IDS = [
  4602512,
  4602500,
  4562664,
  4554819,
  4562600
];

const MUBASHER_FUND_CSV_URL = "https://static.mubasher.info/File.MubasherCharts/File.Mutual_Fund_Charts_Dir/priceChartFund_";

export function normalizeFundLookupKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function parseMubasherNewsFundPrices(html: string) {
  const stripped = html
    .replace(/<span[^>]*>/gi, "")
    .replace(/<\/span>/gi, "")
    .replace(/<strong[^>]*>/gi, "")
    .replace(/<\/strong>/gi, "");
  const text = stripped
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\\n/g, " ")
    .replace(/\\u00a0/g, " ")
    .replace(/\s+/g, " ");

  const prices = new Map<string, number>();
  const pattern = /Fund Name\s*:?\s*([^]+?)\s*Price per Certificate\s*\(EGP\)\s*:?\s*([\d.]+)/gi;
  for (const match of text.matchAll(pattern)) {
    const name = match[1].trim();
    const price = Number(match[2]);
    if (!name || !Number.isFinite(price)) continue;
    prices.set(normalizeFundLookupKey(name), price);
  }
  return prices;
}

export function findFundPrice(prices: Map<string, number>, config: EgxFundConfig) {
  for (const name of config.names) {
    const price = prices.get(normalizeFundLookupKey(name));
    if (price !== undefined) return price;
  }
  return undefined;
}

export function findFundPriceInArticle(html: string, config: EgxFundConfig) {
  const fromTable = findFundPrice(parseMubasherNewsFundPrices(html), config);
  if (fromTable !== undefined) return fromTable;

  const flattened = html.replace(/<span[^>]*>/gi, "").replace(/<\/span>/gi, "");
  for (const name of config.names) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`${escaped}[\\s\\S]{0,240}?Price per Certificate \\(EGP\\)[^0-9]*([\\d.]+)`, "i");
    const match = flattened.match(pattern);
    if (match) return Number(match[1]);
  }
  return undefined;
}

export function parseMubasherFundCsv(csv: string) {
  const rows = csv
    .trim()
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const comma = line.lastIndexOf(",");
      if (comma < 0) return undefined;
      const price = Number(line.slice(comma + 1));
      return Number.isFinite(price) ? price : undefined;
    })
    .filter((price): price is number => price !== undefined);

  if (!rows.length) return undefined;
  return {
    currentPrice: rows.at(-1)!,
    previousClose: rows.length >= 2 ? rows.at(-2)! : rows.at(-1)!
  };
}

export function isStaleFundArticle(articleId: number) {
  const newestArticleId = MUBASHER_FUND_PRICE_ARTICLE_IDS[0];
  return articleId < newestArticleId;
}

export function buildEgxFundQuote(
  symbol: string,
  currentPrice: number,
  previousClose: number,
  options: { stale: boolean }
): MarketQuote {
  const roundedCurrent = Number(currentPrice.toFixed(5));
  const roundedPrevious = Number(previousClose.toFixed(5));
  return {
    symbol,
    currentPrice: roundedCurrent,
    previousClose: roundedPrevious,
    dailyChangePercent: roundedPrevious > 0
      ? Number((((roundedCurrent - roundedPrevious) / roundedPrevious) * 100).toFixed(2))
      : 0,
    provider: "mubasher_egx_fund",
    stale: options.stale
  };
}

export function getEgxFundConfig(symbol: string) {
  return EGX_FUNDS_BY_SYMBOL[symbol.trim().toUpperCase()];
}

export function mubasherFundCsvUrl(fundId: number) {
  return `${MUBASHER_FUND_CSV_URL}${fundId}.csv`;
}
