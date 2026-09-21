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
  compact?: boolean;
};

export function IssueCard({
  issue,
  reason,
  rank,
  claimable = false,
  assigned = false,
  compact = false,
}: IssueCardProps) {
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
    <article
      className={`flex h-full flex-col rounded-2xl bg-[#f8f6fc] p-4 ${compact ? "" : "p-5"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className={`font-medium leading-snug tracking-tight ${compact ? "text-sm" : "text-base"}`}>
          {issue.title}
        </h3>
        <span className="shrink-0 rounded-full bg-white px-2 py-0.5 font-mono text-[11px] text-muted">
          #{issue.iid}
        </span>
      </div>

      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {typeof rank === "number" ? <Chip tone="sky">Pick {rank}</Chip> : null}
        {assigned ? <Chip tone="emerald">Assigned to you</Chip> : null}
        {issue.state === "closed" ? <Chip>Closed</Chip> : null}
        {issue.labels.map((label) => (
          <Chip key={label} tone="lavender">
            {label}
          </Chip>
        ))}
      </div>

      {reason && !compact ? <p className="mt-3 text-sm leading-relaxed text-muted">{reason}</p> : null}

      {error ? (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {error}
        </p>
      ) : null}

      <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
        {claimable ? (
          <button
            type="button"
            onClick={claim}
            disabled={busy}
            className="inline-flex items-center rounded-full bg-ink px-4 py-1.5 text-sm font-medium text-white transition hover:bg-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? "Claiming…" : "Claim"}
          </button>
        ) : null}
        <a
          href={issue.webUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center rounded-full px-3 py-1.5 text-sm font-medium text-ink/80 transition hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          View in GitLab
        </a>
      </div>
    </article>
  );
}
