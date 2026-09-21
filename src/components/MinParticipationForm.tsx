"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { errorMessage, postJson } from "@/components/post-json";

type MinParticipationFormProps = {
  initialPct: number;
};

export function MinParticipationForm({ initialPct }: MinParticipationFormProps) {
  const router = useRouter();
  const [value, setValue] = useState(String(initialPct));
  const [pending, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaved(false);

    const pct = Number(value);
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      setError("Enter a percentage between 0 and 100");
      return;
    }

    setSaving(true);
    try {
      await postJson("/api/config", { minParticipationPct: pct });
      setSaved(true);
      startTransition(() => router.refresh());
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setSaving(false);
    }
  }

  const busy = saving || pending;

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-4">
      <div>
        <label htmlFor="min-participation" className="block text-sm font-medium">
          Minimum participation
        </label>
        <div className="mt-2 flex items-center gap-2">
          <input
            id="min-participation"
            type="number"
            inputMode="numeric"
            min={0}
            max={100}
            step={1}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            className="w-28 rounded-full border border-black/10 bg-[#f8f6fc] px-4 py-2 text-sm outline-none focus:border-ink/30 focus:bg-white"
          />
          <span className="text-sm text-muted">% of all issues per student</span>
        </div>
      </div>

      <button
        type="submit"
        disabled={busy}
        className="inline-flex items-center rounded-full bg-ink px-4 py-2 text-sm font-medium text-white transition hover:bg-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? "Saving…" : "Update target"}
      </button>

      {saved && !busy ? <p className="text-sm text-[#0d652d]">Target updated</p> : null}
      {error ? (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}
    </form>
  );
}
