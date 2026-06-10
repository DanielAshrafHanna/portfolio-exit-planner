import type { PriceSession } from "@/lib/types";

type Props = {
  session?: PriceSession;
};

export function ExtendedHoursPriceMarker({ session }: Props) {
  if (session !== "pre" && session !== "post") return null;
  const label = session === "pre" ? "Pre-market price" : "After-hours price";
  return (
    <span
      className="ml-1 inline-flex align-middle rounded bg-marine/10 px-1 text-[10px] font-semibold uppercase tracking-wide text-marine"
      title={label}
      aria-label={label}
    >
      {session === "pre" ? "Pre" : "AH"}
    </span>
  );
}
