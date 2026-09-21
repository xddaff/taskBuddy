"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { errorMessage, postJson } from "@/components/post-json";

type CategorizeResult = {
  issues?: number;
  categorized?: number;
};

export function RecategorizeButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function recategorize() {
    setError(null);
    setResult(null);
    setRunning(true);
    try {
      const response = await postJson<CategorizeResult>("/api/categorize");
      setResult(`Categorized ${response?.categorized ?? 0} of ${response?.issues ?? 0} tasks`);
      startTransition(() => router.refresh());
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setRunning(false);
    }
  }

  const busy = running || pending;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={recategorize}
        disabled={busy}
        className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-ink transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? "Categorizing…" : "Re-run categorization"}
      </button>
      {result && !busy ? <span className="text-xs text-emerald-700">{result}</span> : null}
      {error ? (
        <span role="alert" className="text-xs text-red-600">
          {error}
        </span>
      ) : null}
    </div>
  );
}
