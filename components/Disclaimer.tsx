import { ShieldAlert } from "lucide-react";

export function Disclaimer() {
  return (
    <section className="border-y border-amber/40 bg-amber/15 px-4 py-3 text-sm text-ink">
      <div className="mx-auto flex max-w-7xl gap-3">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber" aria-hidden />
        <p>
          Educational analysis only. This app does not place trades, connect to brokerages, or provide financial advice.
          Market data, AI analysis, and stop-loss levels can be wrong or stale. The final decision is yours.
        </p>
      </div>
    </section>
  );
}
