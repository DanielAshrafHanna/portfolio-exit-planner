"use client";

import type { User } from "@supabase/supabase-js";
import { CheckCircle2, Cloud, CloudOff, Loader2, LogIn, LogOut, UserRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
  onDisplayNameCommit?: (value: string) => void;
  onSignIn: (identifier: string, password: string, mode: "signin" | "signup", displayName?: string) => Promise<void>;
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

function DisplayNameInput({
  displayName,
  onDisplayNameChange,
  onDisplayNameCommit
}: Pick<Props, "displayName" | "onDisplayNameChange" | "onDisplayNameCommit">) {
  const [draft, setDraft] = useState(displayName);
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setDraft(displayName);
  }, [displayName]);

  return (
    <input
      className="mt-1 min-h-11 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-base sm:text-sm"
      maxLength={60}
      placeholder="Example: Daniel"
      value={draft}
      onFocus={() => { focused.current = true; }}
      onChange={(event) => {
        setDraft(event.target.value);
        onDisplayNameChange(event.target.value);
      }}
      onBlur={() => {
        focused.current = false;
        onDisplayNameCommit?.(draft);
      }}
    />
  );
}

type SignInMethod = "email" | "displayName";

function SignInMethodToggle({ value, onChange }: { value: SignInMethod; onChange: (next: SignInMethod) => void }) {
  return (
    <div className="inline-flex rounded-md border border-ink/15 bg-paper p-1" role="group" aria-label="Sign-in method">
      <button
        className={`min-h-9 rounded px-3 py-1.5 text-sm font-semibold ${value === "email" ? "bg-white text-marine shadow-sm" : "text-ink/65"}`}
        type="button"
        aria-pressed={value === "email"}
        onClick={() => onChange("email")}
      >
        Email
      </button>
      <button
        className={`min-h-9 rounded px-3 py-1.5 text-sm font-semibold ${value === "displayName" ? "bg-white text-marine shadow-sm" : "text-ink/65"}`}
        type="button"
        aria-pressed={value === "displayName"}
        onClick={() => onChange("displayName")}
      >
        Display name
      </button>
    </div>
  );
}

export function AuthPanel({ user, isAdmin, isLoading, syncStatus, syncMessage, displayName, variant = "default", onDisplayNameChange, onDisplayNameCommit, onSignIn, onSignOut }: Props) {
  const [signInMethod, setSignInMethod] = useState<SignInMethod>("email");
  const [signInIdentifier, setSignInIdentifier] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signupDisplayName, setSignupDisplayName] = useState("");
  const [authHint, setAuthHint] = useState<string | null>(null);
  const visibleSyncMessage = syncMessageForAudience(syncMessage, syncStatus, isAdmin);

  const handleSignIn = () => {
    const trimmed = signInIdentifier.trim();
    if (!trimmed || !password) return;
    if (signInMethod === "email" && !trimmed.includes("@")) {
      setAuthHint("Enter your email address, or switch to Display name.");
      return;
    }
    if (signInMethod === "displayName" && trimmed.includes("@")) {
      setAuthHint("Switch to Email when signing in with an email address.");
      return;
    }
    setAuthHint(null);
    void onSignIn(trimmed, password, "signin");
  };

  const handleSignUp = () => {
    const trimmedEmail = signupEmail.trim();
    if (!trimmedEmail || !password) return;
    if (!trimmedEmail.includes("@")) {
      setAuthHint("Create an account with an email address.");
      return;
    }
    setAuthHint(null);
    void onSignIn(trimmedEmail, password, "signup", signupDisplayName);
  };

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
            <DisplayNameInput displayName={displayName} onDisplayNameChange={onDisplayNameChange} onDisplayNameCommit={onDisplayNameCommit} />
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
                <DisplayNameInput displayName={displayName} onDisplayNameChange={onDisplayNameChange} onDisplayNameCommit={onDisplayNameCommit} />
              </label>
              <div className={`inline-flex min-h-11 min-w-0 items-center gap-2 rounded-md border px-3 py-2 text-sm ${syncClass(syncStatus)}`} title={visibleSyncMessage}>
                <span className="shrink-0">{syncIcon(syncStatus)}</span>
                <span className="min-w-0 truncate">{visibleSyncMessage}</span>
              </div>
            </div>
          ) : (
            <div className="grid gap-5 lg:grid-cols-2">
              <div className="space-y-3">
                <p className="text-sm font-semibold text-ink">Sign in</p>
                <SignInMethodToggle
                  value={signInMethod}
                  onChange={(next) => {
                    setSignInMethod(next);
                    setAuthHint(null);
                  }}
                />
                <label className="block text-xs font-semibold text-ink/65">
                  {signInMethod === "email" ? "Email" : "Display name"}
                  <input
                    className="mt-1 min-h-11 w-full rounded-md border border-ink/15 px-3 py-2 text-base sm:text-sm"
                    type="text"
                    autoComplete={signInMethod === "email" ? "username" : "off"}
                    placeholder={signInMethod === "email" ? "you@example.com" : "Example: Chantel"}
                    value={signInIdentifier}
                    onChange={(event) => {
                      setSignInIdentifier(event.target.value);
                      if (authHint) setAuthHint(null);
                    }}
                  />
                </label>
                <label className="block text-xs font-semibold text-ink/65">
                  Password
                  <input
                    className="mt-1 min-h-11 w-full rounded-md border border-ink/15 px-3 py-2 text-base sm:text-sm"
                    type="password"
                    autoComplete="current-password"
                    placeholder="Password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                </label>
                <button
                  className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-marine px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 sm:w-auto"
                  type="button"
                  disabled={isLoading || !signInIdentifier.trim() || !password}
                  onClick={handleSignIn}
                >
                  <LogIn className="h-4 w-4" aria-hidden /> Sign in
                </button>
                {signInMethod === "displayName" ? (
                  <p className="text-xs text-ink/55">Use the display name saved to your cloud portfolio. New accounts must sign up with email first.</p>
                ) : null}
              </div>
              <div className="space-y-3 border-t border-ink/10 pt-5 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
                <p className="text-sm font-semibold text-ink">Create account</p>
                <label className="block text-xs font-semibold text-ink/65">
                  Display name
                  <input
                    className="mt-1 min-h-11 w-full rounded-md border border-ink/15 px-3 py-2 text-base sm:text-sm"
                    type="text"
                    placeholder="Example: Daniel"
                    value={signupDisplayName}
                    onChange={(event) => setSignupDisplayName(event.target.value)}
                  />
                </label>
                <label className="block text-xs font-semibold text-ink/65">
                  Email
                  <input
                    className="mt-1 min-h-11 w-full rounded-md border border-ink/15 px-3 py-2 text-base sm:text-sm"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={signupEmail}
                    onChange={(event) => setSignupEmail(event.target.value)}
                  />
                </label>
                <p className="text-xs text-ink/55">Uses the same password entered above.</p>
                <button
                  className="min-h-11 w-full rounded-md border border-ink/15 px-4 py-2 text-sm font-semibold disabled:opacity-50 sm:w-auto"
                  type="button"
                  disabled={isLoading || !signupEmail.trim() || !password}
                  onClick={handleSignUp}
                >
                  Create account
                </button>
              </div>
              {authHint ? <p className="text-sm text-coral lg:col-span-2">{authHint}</p> : null}
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
