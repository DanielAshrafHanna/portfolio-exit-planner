import type { PriceSession } from "@/lib/types";

type Props = {
  session?: PriceSession;
};

export function PriceSessionBadge({ session }: Props) {
  if (session !== "pre" && session !== "post") return null;
  const label = session === "pre" ? "Pre" : "AH";
  return (
    <span className="ml-1 inline-flex rounded bg-amber/20 px-1 py-0.5 text-[10px] font-semibold uppercase leading-none text-ink/70">
      {label}
    </span>
  );
}
