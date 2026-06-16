import { extractJsonPayload, generateGeminiGroundedJson, isGeminiConfigured } from "./geminiClient";
import { formatSignedMoney, formatPercent, type PortfolioReport, type PortfolioReportProfile } from "./portfolioReport";
import { dailyPortfolioSummarySchema, type DailyPortfolioSummary } from "./validation";

export type DailyPortfolioSummaryResult = {
  profileId: string;
  profileName: string;
  summary: DailyPortfolioSummary;
  fallback: boolean;
  warning?: string;
};

type GenerateFn = (params: { systemInstruction: string; userContent: string; temperature?: number }) => Promise<string>;

type BuildOptions = {
  generate?: GenerateFn;
  configured?: boolean;
};

const DAILY_SYSTEM_INSTRUCTION = [
  "You are a cautious market-close portfolio analyst. Write a brief but detailed daily wrap-up for a single portfolio.",
  "Use Google Search to confirm what actually moved each holding today and any confirmed upcoming catalysts. Prefer reputable, same-day sources.",
  "Never invent prices, news, dates, or catalysts. If you cannot verify a driver, say the move is unexplained by available news.",
  "For each holding give one action: Keep, Watch, Trim, or Sell, with a one-line reason tied to today's move, trend, and any real news.",
  "Keep the overview tight (3-6 sentences): how the portfolio moved today, standout winners/losers, and the overall risk posture.",
  "Cite the sources you actually used. No guarantees. Never call this financial advice.",
  "Return JSON ONLY matching the provided schema."
].join(" ");

const SUMMARY_SCHEMA_HINT = {
  overview: "string (3-6 sentences on how the portfolio moved today and overall posture)",
  marketContext: "string (1-2 sentences on broad market/sector backdrop today)",
  holdings: [{ symbol: "string", action: "Keep | Watch | Trim | Sell", note: "one-line reason tied to today" }],
  watchItems: ["string (confirmed upcoming catalysts or risks to watch)"],
  sources: [{ title: "string", publisher: "string", url: "string" }]
};

export async function buildDailyPortfolioAiSummaries(
  report: PortfolioReport,
  options: BuildOptions = {}
): Promise<DailyPortfolioSummaryResult[]> {
  const configured = options.configured ?? isGeminiConfigured();
  const generate = options.generate ?? generateGeminiGroundedJson;

  const results: DailyPortfolioSummaryResult[] = [];
  for (const profile of report.profiles) {
    const quoted = profile.holdings.filter((holding) => holding.currentPrice !== undefined);
    if (!quoted.length) continue;

    if (!configured) {
      results.push({
        profileId: profile.id,
        profileName: profile.name,
        summary: fallbackDailySummary(profile),
        fallback: true,
        warning: "GEMINI_API_KEY is missing. Showing a deterministic market-close summary."
      });
      continue;
    }

    try {
      const raw = await generate({
        systemInstruction: DAILY_SYSTEM_INSTRUCTION,
        userContent: JSON.stringify({
          requiredSchema: SUMMARY_SCHEMA_HINT,
          generatedAt: report.generatedAt,
          profile: {
            name: profile.name,
            region: profile.region,
            currency: profile.currency,
            totals: {
              currentValue: profile.totals.currentValue,
              profitLoss: profile.totals.profitLoss,
              profitLossPercent: profile.totals.profitLossPercent,
              dailyProfitLoss: profile.totals.dailyProfitLoss,
              dailyProfitLossPercent: profile.totals.dailyProfitLossPercent
            },
            holdings: quoted.map((holding) => ({
              symbol: holding.symbol,
              name: holding.name,
              currentPrice: holding.currentPrice,
              dailyProfitLoss: holding.dailyProfitLoss,
              dailyProfitLossPercent: holding.dailyProfitLossPercent,
              profitLoss: holding.profitLoss,
              profitLossPercent: holding.profitLossPercent
            }))
          }
        })
      });
      const parsed = dailyPortfolioSummarySchema.safeParse(extractJsonPayload(raw));
      if (parsed.success) {
        results.push({
          profileId: profile.id,
          profileName: profile.name,
          summary: parsed.data,
          fallback: false
        });
      } else {
        results.push({
          profileId: profile.id,
          profileName: profile.name,
          summary: fallbackDailySummary(profile),
          fallback: true,
          warning: "AI returned malformed daily summary JSON. Showing a deterministic market-close summary."
        });
      }
    } catch (error) {
      results.push({
        profileId: profile.id,
        profileName: profile.name,
        summary: fallbackDailySummary(profile),
        fallback: true,
        warning: error instanceof Error ? error.message : "Daily AI summary unavailable."
      });
    }
  }

  return results;
}

/** Deterministic, non-hallucinating summary used when AI is unavailable or invalid. */
export function fallbackDailySummary(profile: PortfolioReportProfile): DailyPortfolioSummary {
  const quoted = profile.holdings.filter((holding) => holding.currentPrice !== undefined);
  const sorted = [...quoted].sort((a, b) => b.dailyProfitLoss - a.dailyProfitLoss);
  const winner = sorted[0];
  const loser = sorted[sorted.length - 1];
  const currency = profile.currency;
  const dailyText = `${formatSignedMoney(profile.totals.dailyProfitLoss, currency)} (${formatPercent(profile.totals.dailyProfitLossPercent)})`;
  const totalText = `${formatSignedMoney(profile.totals.profitLoss, currency)} (${formatPercent(profile.totals.profitLossPercent)})`;

  const overviewParts = [
    `${profile.name} moved ${dailyText} today and stands at ${totalText} overall.`
  ];
  if (winner && winner.dailyProfitLoss > 0) {
    overviewParts.push(`Top mover up: ${winner.symbol} ${formatSignedMoney(winner.dailyProfitLoss, currency)}.`);
  }
  if (loser && loser.dailyProfitLoss < 0 && (!winner || loser.symbol !== winner.symbol)) {
    overviewParts.push(`Biggest drag: ${loser.symbol} ${formatSignedMoney(loser.dailyProfitLoss, currency)}.`);
  }
  overviewParts.push("AI commentary is unavailable, so this is a data-only recap with no news context.");

  return {
    overview: overviewParts.join(" "),
    marketContext: "",
    holdings: quoted.map((holding) => ({
      symbol: holding.symbol.trim().toUpperCase(),
      action: actionFromHolding(holding.action),
      note: `${formatSignedMoney(holding.dailyProfitLoss, currency)} today (${formatPercent(holding.dailyProfitLossPercent)}); position P/L ${formatSignedMoney(holding.profitLoss, currency)}.`
    })),
    watchItems: [],
    sources: []
  };
}

function actionFromHolding(action?: string): DailyPortfolioSummary["holdings"][number]["action"] {
  if (action === "Keep" || action === "Watch" || action === "Trim" || action === "Sell") return action;
  return "Watch";
}
