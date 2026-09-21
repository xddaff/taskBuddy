"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { errorMessage, postJson } from "@/components/post-json";

export function SyncButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sync() {
    setError(null);
    setSyncing(true);
    try {
      await postJson("/api/sync");
      startTransition(() => router.refresh());
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setSyncing(false);
    }
  }

  const busy = syncing || pending;

  return (
    <div className="flex items-center gap-3">
      {error ? (
        <span role="alert" className="text-xs text-red-600">
          {error}
        </span>
      ) : null}
      <button
        type="button"
        onClick={sync}
        disabled={busy}
        className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-ink transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? "Syncing…" : "Sync from GitLab"}
      </button>
    </div>
  );
}
