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
    <div className="flex items-center gap-2">
      {error ? (
        <span role="alert" className="max-w-[10rem] truncate text-xs text-red-600">
          {error}
        </span>
      ) : null}
      <button
        type="button"
        onClick={sync}
        disabled={busy}
        className="inline-flex items-center rounded-full bg-ink px-3.5 py-2 text-sm font-medium text-white transition hover:bg-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? "Syncing…" : "Sync from GitLab"}
      </button>
    </div>
  );
}
