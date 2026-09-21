"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Chip } from "@/components/Chip";
import { errorMessage, postJson } from "@/components/post-json";
import type { Issue } from "@/lib/types";

type IssueCardProps = {
  issue: Issue;
  reason?: string;
  rank?: number;
  claimable?: boolean;
  assigned?: boolean;
};

export function IssueCard({ issue, reason, rank, claimable = false, assigned = false }: IssueCardProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function claim() {
    setError(null);
    setClaiming(true);
    try {
      await postJson("/api/claim", { issueIid: issue.iid });
      startTransition(() => router.refresh());
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setClaiming(false);
    }
  }

  const busy = claiming || pending;

  return (
    <article className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base font-semibold leading-snug">{issue.title}</h3>
        <span className="shrink-0 rounded-md bg-slate-100 px-2 py-1 font-mono text-xs text-muted">
          #{issue.iid}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {typeof rank === "number" ? <Chip tone="emerald">Pick {rank}</Chip> : null}
        {assigned ? <Chip tone="emerald">Assigned to you</Chip> : null}
        {issue.state === "closed" ? <Chip>Closed</Chip> : null}
        {issue.labels.map((label) => (
          <Chip key={label}>{label}</Chip>
        ))}
      </div>

      {reason ? <p className="mt-3 text-sm text-muted">{reason}</p> : null}

      {error ? (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {error}
        </p>
      ) : null}

      <div className="mt-auto flex flex-wrap items-center gap-3 pt-5">
        {claimable ? (
          <button
            type="button"
            onClick={claim}
            disabled={busy}
            className="inline-flex items-center rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? "Claiming…" : "Claim"}
          </button>
        ) : null}
        <a
          href={issue.webUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-ink transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          View in GitLab
        </a>
      </div>
    </article>
  );
}
