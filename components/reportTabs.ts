export function reportTabClass(active: boolean) {
  return `min-h-10 shrink-0 rounded-md border px-4 py-2 text-sm font-semibold ${
    active ? "border-marine bg-marine text-white" : "border-ink/10 bg-white text-ink/70 hover:border-marine/30"
  }`;
}

export function reportProfileTabClass(active: boolean) {
  return `min-h-9 shrink-0 rounded-md border px-3 py-1.5 text-sm font-semibold ${
    active ? "border-marine bg-marine text-white" : "border-ink/10 bg-white text-ink/70 hover:border-marine/30"
  }`;
}
