"use client";

import { Settings2, X } from "lucide-react";
import { useEffect, type ReactNode } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
};

export function SettingsDialog({ open, onClose, children }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 hidden md:block" role="presentation">
      <button
        className="absolute inset-0 bg-ink/40"
        type="button"
        aria-label="Close settings"
        onClick={onClose}
      />
      <div
        className="absolute right-0 top-0 flex h-full w-full max-w-xl flex-col border-l border-ink/10 bg-white shadow-soft-lg"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-dialog-title"
      >
        <div className="flex items-center justify-between gap-3 border-b border-ink/10 px-5 py-4">
          <h2 className="inline-flex items-center gap-2 text-lg font-semibold text-ink" id="settings-dialog-title">
            <Settings2 className="h-5 w-5 text-marine" aria-hidden />
            Settings and tools
          </h2>
          <button
            className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-md border border-ink/15 text-ink/70 hover:bg-paper"
            type="button"
            aria-label="Close settings"
            onClick={onClose}
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {children}
        </div>
      </div>
    </div>
  );
}
