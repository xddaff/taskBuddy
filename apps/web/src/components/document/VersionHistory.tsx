'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { restoreVersion } from '@/app/(app)/d/[documentId]/actions';
import { Avatar } from '@/components/Avatar';
import { absoluteTime, relativeTime } from '@/lib/format';

export interface VersionSummary {
  id: string;
  label: string | null;
  createdAt: string;
  preview: string;
  author: { id: string; name: string | null; image: string | null };
}

interface Props {
  documentId: string;
  versions: VersionSummary[];
  current: { updatedAt: string; preview: string };
}

export function VersionHistory({ documentId, versions, current }: Props) {
  const router = useRouter();
  const [confirming, setConfirming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const restore = (versionId: string) => {
    setError(null);
    startTransition(async () => {
      const result = await restoreVersion({ documentId, versionId });
      if (!result.ok) {
        setError(result.message ?? 'Could not restore that version.');
        return;
      }
      setConfirming(null);
      router.push(`/d/${documentId}`);
      router.refresh();
    });
  };

  return (
    <div className="space-y-3">
      <p aria-live="polite" className="sr-only">
        {pending ? 'Restoring version.' : ''}
      </p>

      {error && (
        <p role="alert" className="rounded-lg border border-(--color-danger) p-3 text-sm text-(--color-danger)">
          {error}
        </p>
      )}

      <article className="rounded-xl border border-(--color-accent) bg-(--color-surface-raised) p-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-medium">Current version</h2>
          <time
            dateTime={current.updatedAt}
            title={absoluteTime(current.updatedAt)}
            className="text-xs text-(--color-ink-faint)"
          >
            edited {relativeTime(current.updatedAt)}
          </time>
        </div>
        <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-(--color-ink-muted)">
          {current.preview || 'This document is empty.'}
        </p>
      </article>

      {versions.length === 0 ? (
        <p className="rounded-xl border border-(--color-border-subtle) bg-(--color-surface-raised) p-4 text-sm text-(--color-ink-muted)">
          No earlier versions yet. One is kept automatically as the document is edited, at most one
          every few minutes per person, and you can save one by hand from the editor.
        </p>
      ) : (
        <ul className="space-y-3">
          {versions.map((version) => (
            <li
              key={version.id}
              className="rounded-xl border border-(--color-border-subtle) bg-(--color-surface-raised) p-4"
            >
              <div className="flex items-start gap-3">
                <Avatar name={version.author.name} image={version.author.image} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-sm">{version.author.name ?? 'Unknown'}</span>
                    <time
                      dateTime={version.createdAt}
                      title={absoluteTime(version.createdAt)}
                      className="text-xs text-(--color-ink-faint)"
                    >
                      {relativeTime(version.createdAt)}
                    </time>
                    {version.label && (
                      <span className="rounded-full border border-(--color-border-subtle) px-2 py-0.5 text-[11px] text-(--color-ink-faint)">
                        {version.label}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 line-clamp-3 text-sm leading-relaxed text-(--color-ink-muted)">
                    {version.preview || 'Empty document.'}
                  </p>
                </div>

                {confirming === version.id ? (
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => restore(version.id)}
                      className="rounded-md bg-(--color-accent) px-3 py-1.5 text-xs font-medium text-white transition hover:opacity-90 disabled:opacity-50"
                    >
                      Confirm restore
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => setConfirming(null)}
                      className="rounded-md px-2 py-1.5 text-xs text-(--color-ink-faint) transition hover:text-(--color-ink)"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => setConfirming(version.id)}
                    className="shrink-0 rounded-md border border-(--color-border-subtle) px-3 py-1.5 text-xs transition hover:bg-(--color-surface-hover) disabled:opacity-50"
                  >
                    Restore
                    <span className="sr-only">
                      {' '}
                      the version by {version.author.name ?? 'Unknown'} from{' '}
                      {absoluteTime(version.createdAt)}
                    </span>
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs leading-relaxed text-(--color-ink-faint)">
        Restoring keeps a snapshot of the current text first, so a restore can itself be undone
        from this list.
      </p>
    </div>
  );
}
