import Link from "next/link";

export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-semibold text-ink">You are offline</h1>
      <p className="text-sm text-ink/70">
        Portfolio Exit Planner needs an internet connection for quotes, cloud sync, and AI analysis.
        Reconnect and reopen the app to refresh your holdings.
      </p>
      <Link
        className="inline-flex min-h-11 items-center rounded-md bg-marine px-4 py-2 text-sm font-semibold text-white"
        href="/"
      >
        Try again
      </Link>
    </main>
  );
}
