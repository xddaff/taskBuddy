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
  variant?: "chat" | "note";
};

export function IssueCard({
  issue,
  reason,
  rank,
  claimable = false,
  assigned = false,
  variant = "chat",
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

  if (variant === "note") {
    return (
      <article className="rounded-2xl bg-sand/80 p-3.5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-medium leading-snug">{issue.title}</h3>
          <span className="shrink-0 font-mono text-[11px] text-muted">#{issue.iid}</span>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {assigned ? <Chip tone="emerald">Assigned</Chip> : null}
          {issue.labels.slice(0, 3).map((label) => (
            <Chip key={label} tone="lavender">
              {label}
            </Chip>
          ))}
        </div>
        <a
          href={issue.webUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex text-xs font-medium text-accent hover:underline"
        >
          Open in GitLab
        </a>
      </article>
    );
  }

  return (
    <article id={`issue-${issue.iid}`} className="border-b border-black/[0.06] py-5 last:border-b-0">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-[17px] font-medium leading-snug tracking-tight">{issue.title}</h3>
        <span className="shrink-0 rounded-full bg-[#f1f3f4] px-2 py-0.5 font-mono text-[11px] text-muted">
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

      {reason ? <p className="mt-3 text-sm leading-relaxed text-muted">{reason}</p> : null}

      {error ? (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {error}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {claimable ? (
          <button
            type="button"
            onClick={claim}
            disabled={busy}
            className="inline-flex items-center rounded-full bg-ink px-4 py-1.5 text-sm font-medium text-white transition hover:bg-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? "Claiming…" : "Claim issue"}
          </button>
        ) : null}
        <a
          href={issue.webUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center rounded-full px-3 py-1.5 text-sm font-medium text-ink/80 transition hover:bg-black/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          View in GitLab
        </a>
      </div>
    </article>
  );
}
