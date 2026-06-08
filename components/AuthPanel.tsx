"use client";

import type { User } from "@supabase/supabase-js";
import { CheckCircle2, Cloud, CloudOff, Loader2, LogIn, LogOut, UserRound } from "lucide-react";
import { useState } from "react";
import { hasSupabaseConfig } from "@/lib/supabaseClient";

export type CloudSyncStatus = "disabled" | "signed-out" | "loading" | "saving" | "saved" | "error";

type Props = {
  user: User | null;
  isAdmin: boolean;
  isLoading: boolean;
  syncStatus: CloudSyncStatus;
  syncMessage: string;
  displayName: string;
  variant?: "default" | "compact";
  onDisplayNameChange: (value: string) => void;
  onSignIn: (email: string, password: string, mode: "signin" | "signup", displayName?: string) => Promise<void>;
  onSignOut: () => Promise<void>;
};

function syncIcon(status: CloudSyncStatus) {
  if (status === "loading" || status === "saving") return <Loader2 className="h-4 w-4 animate-spin" aria-hidden />;
  if (status === "saved") return <CheckCircle2 className="h-4 w-4" aria-hidden />;
  if (status === "error") return <CloudOff className="h-4 w-4" aria-hidden />;
  return <Cloud className="h-4 w-4" aria-hidden />;
}

function syncClass(status: CloudSyncStatus) {
  if (status === "error") return "border-coral/35 bg-coral/10 text-coral";
  if (status === "saved") return "border-marine/20 bg-mint text-marine";
  return "border-ink/15 bg-paper text-ink/70";
}

function syncMessageForAudience(message: string, status: CloudSyncStatus, isAdmin: boolean) {
  if (isAdmin) return message;
  const isTechnicalSetupMessage = message.includes("Supabase SQL")
    || message.includes("schema cache")
    || message.includes("display_name")
    || message.includes("share_holdings");
  if (isTechnicalSetupMessage) return status === "saved" ? "Saved to cloud." : "Cloud sync needs admin attention.";
  if (status === "error") return "Cloud sync needs admin attention.";
  return message;
}

export function AuthPanel({ user, isAdmin, isLoading, syncStatus, syncMessage, displayName, variant = "default", onDisplayNameChange, onSignIn, onSignOut }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signupDisplayName, setSignupDisplayName] = useState("");
  const visibleSyncMessage = syncMessageForAudience(syncMessage, syncStatus, isAdmin);

  if (!hasSupabaseConfig()) {
    return (
      <section className="border-b border-ink/10 bg-white px-4 py-4">
        <div className="mx-auto max-w-7xl text-sm text-ink/70">
          Cloud accounts are not configured yet. Portfolios are local-only until Supabase environment variables are added.
        </div>
      </section>
    );
  }

  if (user && variant === "compact") {
    return (
      <div className="rounded-md border border-ink/10 bg-surface-muted p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-marine">
          <UserRound className="h-4 w-4" aria-hidden />
          Account
        </div>
        <div className="grid gap-3 sm:grid-cols-[minmax(180px,1fr)_auto] sm:items-end">
          <label className="text-xs font-semibold text-ink/65">
            Display name
            <input
              className="mt-1 min-h-11 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-base sm:text-sm"
              maxLength={60}
              placeholder="Example: Daniel"
              value={displayName}
              onChange={(event) => onDisplayNameChange(event.target.value)}
            />
          </label>
          <button className="inline-flex min-h-11 items-center gap-2 self-end rounded-md border border-coral px-4 py-2 text-sm font-semibold text-coral" type="button" onClick={onSignOut}>
            <LogOut className="h-4 w-4" aria-hidden /> Sign out
          </button>
        </div>
      </div>
    );
  }

  return (
    <section className="border-b border-ink/10 bg-white px-4 py-4">
      <div className="mx-auto grid max-w-7xl gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-marine">
            <UserRound className="h-4 w-4" aria-hidden />
            Account dashboard
          </div>
          {user ? (
            <div className="grid gap-3 md:grid-cols-[minmax(220px,360px)_minmax(0,1fr)] md:items-end">
              <label className="text-xs font-semibold text-ink/65">
                Display name
                <input
                  className="mt-1 min-h-11 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-base sm:text-sm"
                  maxLength={60}
                  placeholder="Example: Daniel"
                  value={displayName}
                  onChange={(event) => onDisplayNameChange(event.target.value)}
                />
              </label>
              <div className={`inline-flex min-h-11 min-w-0 items-center gap-2 rounded-md border px-3 py-2 text-sm ${syncClass(syncStatus)}`} title={visibleSyncMessage}>
                <span className="shrink-0">{syncIcon(syncStatus)}</span>
                <span className="min-w-0 truncate">{visibleSyncMessage}</span>
              </div>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto_auto]">
              <input className="min-h-11 rounded-md border border-ink/15 px-3 py-2 text-base sm:text-sm" type="text" placeholder="Display name" value={signupDisplayName} onChange={(event) => setSignupDisplayName(event.target.value)} />
              <input className="min-h-11 rounded-md border border-ink/15 px-3 py-2 text-base sm:text-sm" type="text" placeholder="Email or display name" value={email} onChange={(event) => setEmail(event.target.value)} />
              <input className="min-h-11 rounded-md border border-ink/15 px-3 py-2 text-base sm:text-sm" type="password" placeholder="Password" value={password} onChange={(event) => setPassword(event.target.value)} />
              <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-marine px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" type="button" disabled={isLoading || !email || !password} onClick={() => onSignIn(email, password, "signin")}>
                <LogIn className="h-4 w-4" aria-hidden /> Sign in
              </button>
              <button className="min-h-11 rounded-md border border-ink/15 px-4 py-2 text-sm font-semibold disabled:opacity-50" type="button" disabled={isLoading || !email || !password} onClick={() => onSignIn(email, password, "signup", signupDisplayName)}>
                Create account
              </button>
            </div>
          )}
        </div>
        {user ? (
          <div className="flex flex-wrap gap-2">
            <button className="inline-flex min-h-11 items-center gap-2 rounded-md border border-coral px-4 py-2 text-sm font-semibold text-coral" type="button" onClick={onSignOut}>
              <LogOut className="h-4 w-4" aria-hidden /> Sign out
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
