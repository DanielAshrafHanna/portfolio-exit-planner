"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type Variant = "primary" | "secondary" | "settings";

const variantClasses: Record<Variant, string> = {
  primary: "border-l-4 border-l-marine bg-surface-elevated shadow-soft-lg",
  secondary: "border border-mint/50 bg-surface-muted",
  settings: "border border-ink/10 bg-white shadow-soft"
};

type Props = {
  variant?: Variant;
  icon?: LucideIcon;
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
};

export function SectionCard({
  variant = "settings",
  icon: Icon,
  eyebrow,
  title,
  description,
  action,
  children,
  className = "",
  id
}: Props) {
  return (
    <section className={`rounded-lg ${variantClasses[variant]} ${className}`} id={id}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-ink/8 px-4 py-4 sm:px-5">
        <div className="min-w-0">
          {eyebrow ? (
            <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-marine">
              {Icon ? <Icon className="h-4 w-4 shrink-0" aria-hidden /> : null}
              {eyebrow}
            </div>
          ) : null}
          <h2 className="text-xl font-semibold text-ink">{title}</h2>
          {description ? <p className="mt-1 max-w-3xl text-sm text-ink/60">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="px-4 py-4 sm:px-5">{children}</div>
    </section>
  );
}
