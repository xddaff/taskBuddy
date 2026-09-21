'use client';

import type { RecommendationStatus } from '@studentproj/db';
import { useTransition } from 'react';
import { setRecommendationStatus } from '@/app/(app)/tasks/actions';

export interface TaskCardData {
  recommendationId: string;
  status: RecommendationStatus;
  score: number;
  reasons: string[];
  breakdown: Record<string, number | null>;
  issue: {
    title: string;
    webUrl: string;
    labels: string[];
    estimatedHours: number | null;
    projectName: string;
    projectPath: string;
    updatedAt: string;
  };
}

/// The score is shown as a coarse band rather than a number.
///
/// A precise "0.58" invites students to compare scores across each other's
/// feeds, which is meaningless: the scale is relative to one profile. A band
/// conveys the same ranking information without implying precision it does not
/// have.
function band(score: number): { label: string; className: string } {
  if (score >= 0.6) return { label: 'Strong match', className: 'text-(--color-positive)' };
  if (score >= 0.45) return { label: 'Good match', className: 'text-(--color-accent)' };
  if (score >= 0.3) return { label: 'Possible match', className: 'text-(--color-ink-muted)' };
  return { label: 'Weak match', className: 'text-(--color-ink-faint)' };
}

export function TaskCard({ data, showUndo = false }: { data: TaskCardData; showUndo?: boolean }) {
  const [pending, startTransition] = useTransition();
  const match = band(data.score);

  const decide = (status: RecommendationStatus) => {
    startTransition(async () => {
      await setRecommendationStatus(data.recommendationId, status);
    });
  };

  return (
    <article
      className={`rounded-xl border border-(--color-border-subtle) bg-(--color-surface-raised) p-4 transition ${
        pending ? 'opacity-50' : 'hover:border-(--color-ink-faint)'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-medium leading-snug">
            <a
              href={data.issue.webUrl}
              target="_blank"
              rel="noreferrer"
              className="hover:text-(--color-accent) hover:underline"
            >
              {data.issue.title}
            </a>
          </h3>
          <p className="mt-1 truncate text-xs text-(--color-ink-faint)">
            {data.issue.projectPath}
          </p>
        </div>

        <span className={`shrink-0 text-xs font-medium ${match.className}`}>{match.label}</span>
      </div>

      {data.reasons.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1">
          {data.reasons.map((reason) => (
            <li key={reason} className="text-xs text-(--color-ink-muted)">
              {reason}
            </li>
          ))}
        </ul>
      )}

      {data.issue.labels.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {data.issue.labels.slice(0, 5).map((label) => (
            <li
              key={label}
              className="rounded-full border border-(--color-border-subtle) px-2 py-0.5 text-[11px] text-(--color-ink-faint)"
            >
              {label}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex items-center gap-2">
        {showUndo ? (
          <>
            <button
              type="button"
              onClick={() => decide('SUGGESTED')}
              disabled={pending}
              className="rounded-md border border-(--color-border-subtle) px-3 py-1.5 text-xs transition hover:bg-(--color-surface-hover)"
            >
              Move back to feed
            </button>
            {data.status !== 'CLAIMED' && (
              <button
                type="button"
                onClick={() => decide('CLAIMED')}
                disabled={pending}
                className="rounded-md bg-(--color-accent) px-3 py-1.5 text-xs font-medium text-white transition hover:opacity-90"
              >
                I am working on this
              </button>
            )}
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => decide('CLAIMED')}
              disabled={pending}
              className="rounded-md bg-(--color-accent) px-3 py-1.5 text-xs font-medium text-white transition hover:opacity-90"
            >
              I am working on this
            </button>
            <button
              type="button"
              onClick={() => decide('SAVED')}
              disabled={pending}
              className="rounded-md border border-(--color-border-subtle) px-3 py-1.5 text-xs transition hover:bg-(--color-surface-hover)"
            >
              Save for later
            </button>
            <button
              type="button"
              onClick={() => decide('DISMISSED')}
              disabled={pending}
              className="ml-auto rounded-md px-2 py-1.5 text-xs text-(--color-ink-faint) transition hover:text-(--color-ink)"
            >
              Not for me
            </button>
          </>
        )}
      </div>
    </article>
  );
}
