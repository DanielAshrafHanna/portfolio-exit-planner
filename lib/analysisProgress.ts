import type { EnrichedHolding } from "./types";

export type AnalysisPhase = "idle" | "market" | "analyzing" | "complete" | "interrupted";

export type AnalysisCoverage = {
  total: number;
  analyzed: number;
  pendingSymbols: string[];
  analyzedSymbols: string[];
};

export type AnalysisSession = {
  profileId: string;
  inputKey: string;
  phase: AnalysisPhase;
  completed: number;
  total: number;
  currentSymbol: string | null;
  model: string;
  completedSymbols: string[];
  pendingSymbols: string[];
  updatedAt: string;
};

const STORAGE_PREFIX = "portfolio-exit-planner:analysis-session:v1";

export function analysisSessionKey(userId: string | "guest") {
  return `${STORAGE_PREFIX}:${userId === "guest" ? "guest" : `user:${userId}`}`;
}

export function analysisCoverage(holdings: EnrichedHolding[]): AnalysisCoverage {
  const analyzable = holdings.filter((holding) => holding.symbol.trim());
  const analyzedSymbols = analyzable.filter((holding) => holding.analysis).map((holding) => holding.symbol.trim().toUpperCase());
  const pendingSymbols = analyzable.filter((holding) => !holding.analysis).map((holding) => holding.symbol.trim().toUpperCase());
  return {
    total: analyzable.length,
    analyzed: analyzedSymbols.length,
    pendingSymbols,
    analyzedSymbols
  };
}

export function readAnalysisSession(userId: string | "guest"): AnalysisSession | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(analysisSessionKey(userId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as AnalysisSession;
    if (!parsed || typeof parsed !== "object") return null;
    if (!parsed.profileId || !parsed.inputKey || typeof parsed.total !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeAnalysisSession(userId: string | "guest", session: AnalysisSession) {
  if (typeof window === "undefined") return;
  localStorage.setItem(analysisSessionKey(userId), JSON.stringify(session));
}

export function clearAnalysisSession(userId: string | "guest") {
  if (typeof window === "undefined") return;
  localStorage.removeItem(analysisSessionKey(userId));
}

export function reconcileAnalysisSession(
  session: AnalysisSession | null,
  profileId: string,
  inputKey: string,
  coverage: AnalysisCoverage
): AnalysisSession | null {
  if (!session) return null;
  if (session.profileId !== profileId || session.inputKey !== inputKey) return null;
  if (session.phase === "complete") return null;
  if (coverage.total === 0) return null;

  const completed = Math.min(coverage.analyzed, session.total);
  const pendingSymbols = coverage.pendingSymbols;
  const analyzedSymbols = coverage.analyzedSymbols;

  if (session.phase === "analyzing" || session.phase === "market") {
    return {
      ...session,
      phase: "interrupted",
      completed,
      completedSymbols: analyzedSymbols,
      pendingSymbols,
      currentSymbol: null
    };
  }

  if (session.phase === "interrupted" && pendingSymbols.length === 0) {
    return null;
  }

  return {
    ...session,
    completed,
    completedSymbols: analyzedSymbols,
    pendingSymbols,
    currentSymbol: session.phase === "interrupted" ? null : session.currentSymbol
  };
}

export function buildAnalysisSession(params: {
  profileId: string;
  inputKey: string;
  phase: AnalysisPhase;
  completed: number;
  total: number;
  currentSymbol: string | null;
  model: string;
  completedSymbols: string[];
  pendingSymbols: string[];
}): AnalysisSession {
  return {
    ...params,
    updatedAt: new Date().toISOString()
  };
}
