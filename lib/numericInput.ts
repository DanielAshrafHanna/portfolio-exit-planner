export function isIncompleteNumericInput(value: string) {
  const trimmed = value.trim();
  if (trimmed === "-") return true;
  if (trimmed === "." || trimmed.endsWith(".")) return true;
  if (!trimmed.includes(".")) return false;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return false;
  // Keep draft while typing values like "302.0" before "302.06".
  return String(parsed) !== trimmed;
}

export function parseNumericInput(value: string): number {
  const trimmed = value.trim();
  if (trimmed === "" || trimmed === "-" || trimmed === ".") return 0;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : 0;
}
