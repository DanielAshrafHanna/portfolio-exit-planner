"use client";

import { Download, Share, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const DISMISS_KEY = "portfolio-exit-planner:install-hint-dismissed";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandaloneDisplay() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches
    || ("standalone" in navigator && (navigator as Navigator & { standalone?: boolean }).standalone === true);
}

function isIosSafari() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/i.test(ua) && !/CriOS|FxiOS|EdgiOS/i.test(ua);
}

export function InstallAppHint() {
  const [visible, setVisible] = useState(false);
  const [iosHint, setIosHint] = useState(false);
  const installPrompt = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (isStandaloneDisplay()) return;
    if (localStorage.getItem(DISMISS_KEY) === "1") return;

    if (isIosSafari()) {
      setIosHint(true);
      setVisible(true);
      return;
    }

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      installPrompt.current = event as BeforeInstallPromptEvent;
      setVisible(true);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  };

  const install = async () => {
    const prompt = installPrompt.current;
    if (!prompt) return;
    await prompt.prompt();
    await prompt.userChoice;
    installPrompt.current = null;
    dismiss();
  };

  if (!visible) return null;

  return (
    <div className="rounded-md border border-marine/20 bg-mint/30 px-4 py-3 text-sm text-ink/80">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <p className="font-semibold text-ink">Install this app</p>
          {iosHint ? (
            <p className="flex items-start gap-2 text-ink/70">
              <Share className="mt-0.5 h-4 w-4 shrink-0 text-marine" aria-hidden />
              <span>
                On iPhone, tap <strong>Share</strong> in Safari, then choose <strong>Add to Home Screen</strong>.
              </span>
            </p>
          ) : (
            <p className="text-ink/70">
              Add Portfolio Exit Planner to your home screen for a full-screen app experience.
            </p>
          )}
        </div>
        <button
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-ink/55 hover:bg-white/70 hover:text-ink"
          type="button"
          aria-label="Dismiss install hint"
          onClick={dismiss}
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
      {!iosHint ? (
        <button
          className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-md bg-marine px-3 py-2 text-sm font-semibold text-white"
          type="button"
          onClick={() => void install()}
        >
          <Download className="h-4 w-4" aria-hidden />
          Install app
        </button>
      ) : null}
    </div>
  );
}
