"use client";

import { Mail } from "lucide-react";
import { useEffect, useState } from "react";
import { isValidReportEmail, normalizeReportEmail } from "@/lib/dailyReportEmailPrefs";

type Props = {
  signedIn: boolean;
  accountEmail?: string;
  email: string;
  enabled: boolean;
  syncHint?: string;
  onChange: (next: { email: string; enabled: boolean }) => void;
};

export function DailyReportEmailSettings({
  signedIn,
  accountEmail,
  email,
  enabled,
  syncHint,
  onChange
}: Props) {
  const [draftEmail, setDraftEmail] = useState(email);
  const validEmail = isValidReportEmail(draftEmail);

  useEffect(() => {
    setDraftEmail(email);
  }, [email]);

  if (!signedIn) {
    return (
      <div className="rounded-md border border-ink/10 bg-surface-muted p-4">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-marine">
          <Mail className="h-4 w-4" aria-hidden />
          Daily market-close email
        </div>
        <p className="text-sm text-ink/65">Sign in and save holdings to the cloud to receive a daily summary after the US market closes.</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-ink/10 bg-surface-muted p-4">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-marine">
        <Mail className="h-4 w-4" aria-hidden />
        Daily market-close email
      </div>
      <p className="mb-3 text-sm text-ink/65">
        Get charts, daily movers, and portfolio totals after the US market closes. Requires cloud sync.
      </p>
      <label className="flex items-start gap-3 text-sm text-ink/80">
        <input
          className="mt-1 h-4 w-4 rounded border-ink/20"
          type="checkbox"
          checked={enabled}
          disabled={!validEmail}
          onChange={(event) => onChange({ email: normalizeReportEmail(draftEmail), enabled: event.target.checked })}
        />
        <span>
          <span className="font-semibold text-ink">Send daily summary email</span>
          <span className="mt-1 block text-xs text-ink/55">Delivered after the end-of-day snapshot cron runs.</span>
        </span>
      </label>
      <label className="mt-3 block text-xs font-medium text-ink/70">
        Email address
        <input
          className="mt-1 min-h-11 w-full rounded-md border border-ink/15 px-3 py-2 text-base sm:text-sm"
          type="email"
          autoComplete="email"
          placeholder={accountEmail || "you@example.com"}
          value={draftEmail}
          onChange={(event) => setDraftEmail(event.target.value)}
          onBlur={() => {
            const normalized = normalizeReportEmail(draftEmail);
            setDraftEmail(normalized);
            onChange({ email: normalized, enabled: enabled && isValidReportEmail(normalized) });
          }}
        />
      </label>
      {!validEmail && draftEmail.trim() ? (
        <p className="mt-2 text-xs text-coral">Enter a valid email address to enable delivery.</p>
      ) : null}
      {accountEmail && !draftEmail ? (
        <button
          className="mt-2 text-xs font-semibold text-marine underline-offset-2 hover:underline"
          type="button"
          onClick={() => {
            const normalized = normalizeReportEmail(accountEmail);
            setDraftEmail(normalized);
            onChange({ email: normalized, enabled });
          }}
        >
          Use account email ({accountEmail})
        </button>
      ) : null}
      {syncHint ? <p className="mt-2 text-xs text-ink/55">{syncHint}</p> : null}
    </div>
  );
}
