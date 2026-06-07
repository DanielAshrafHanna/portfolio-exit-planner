"use client";

import type { User } from "@supabase/supabase-js";
import { CheckCircle2, Cloud, CloudOff, Loader2, LogIn, LogOut, UserRound } from "lucide-react";
import { useState } from "react";
import { hasSupabaseConfig } from "@/lib/supabaseClient";

export type CloudSyncStatus = "disabled" | "signed-out" | "loading" | "saving" | "saved" | "error";

type Props = {
  user: User | null;
  isLoading: boolean;
  syncStatus: CloudSyncStatus;
  syncMessage: string;
  onSignIn: (email: string, password: string, mode: "signin" | "signup") => Promise<void>;
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

export function AuthPanel({ user, isLoading, syncStatus, syncMessage, onSignIn, onSignOut }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  if (!hasSupabaseConfig()) {
    return (
      <section className="border-b border-ink/10 bg-white px-4 py-4">
        <div className="mx-auto max-w-7xl text-sm text-ink/70">
          Cloud accounts are not configured yet. Portfolios are local-only until Supabase environment variables are added.
        </div>
      </section>
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
            <div className="space-y-2">
              <p className="text-sm text-ink/70">Signed in as <span className="font-semibold text-ink">{user.email}</span>. Cloud sync is private to this account.</p>
              <div className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${syncClass(syncStatus)}`}>
                {syncIcon(syncStatus)}
                {syncMessage}
              </div>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto]">
              <input className="rounded-md border border-ink/15 px-3 py-2 text-sm" type="email" placeholder="Email" value={email} onChange={(event) => setEmail(event.target.value)} />
              <input className="rounded-md border border-ink/15 px-3 py-2 text-sm" type="password" placeholder="Password" value={password} onChange={(event) => setPassword(event.target.value)} />
              <button className="inline-flex items-center justify-center gap-2 rounded-md bg-marine px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" type="button" disabled={isLoading || !email || !password} onClick={() => onSignIn(email, password, "signin")}>
                <LogIn className="h-4 w-4" aria-hidden /> Sign in
              </button>
              <button className="rounded-md border border-ink/15 px-4 py-2 text-sm font-semibold disabled:opacity-50" type="button" disabled={isLoading || !email || !password} onClick={() => onSignIn(email, password, "signup")}>
                Create account
              </button>
            </div>
          )}
        </div>
        {user ? (
          <div className="flex flex-wrap gap-2">
            <button className="inline-flex items-center gap-2 rounded-md border border-coral px-4 py-2 text-sm font-semibold text-coral" type="button" onClick={onSignOut}>
              <LogOut className="h-4 w-4" aria-hidden /> Sign out
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
