'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import { dismissSuggestionAction } from '@/app/(app)/c/actions';
import type { SuggestedTaskDto, SuggestionsDto } from '@/lib/chat-types';

interface Props {
  conversationId: string;
  /// Bumped once per incoming text message. The panel debounces off this rather
  /// than refetching per message: what a conversation is about changes over a
  /// few exchanges, not with every line.
  revision: number;
  onShare: (task: SuggestedTaskDto) => void;
}

const REFRESH_DEBOUNCE_MS = 4000;

export function RelatedTasks({ conversationId, revision, onShare }: Props) {
  const [data, setData] = useState<SuggestionsDto | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const load = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const response = await fetch(
          `/api/chat/suggestions?conversationId=${encodeURIComponent(conversationId)}`,
          { signal },
        );
        if (!response.ok) throw new Error(`status ${response.status}`);
        const payload = (await response.json()) as SuggestionsDto;
        setData(payload);
        setError(null);
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === 'AbortError') return;
        setError('Could not load related tasks.');
      }
    },
    [conversationId],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  useEffect(() => {
    if (revision === 0) return;
    const controller = new AbortController();
    const timer = setTimeout(() => void load(controller.signal), REFRESH_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [revision, load]);

  const tasks = (data?.tasks ?? []).filter((task) => !dismissed.includes(task.issueId));

  // Nothing at all when the conversation has not said enough to rank against.
  // A permanently empty panel taking up a column would read as broken.
  if (!data?.confident || tasks.length === 0) return null;

  if (collapsed) {
    return (
      <div className="flex w-11 shrink-0 justify-center border-l border-(--color-border-subtle) bg-(--color-surface-raised) py-4">
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          aria-pressed={false}
          className="flex items-center gap-2 rounded px-1 py-2 text-xs text-(--color-ink-muted) transition hover:text-(--color-ink) [writing-mode:vertical-rl]"
        >
          Related tasks
          <span className="rounded-full bg-(--color-accent) px-1.5 py-0.5 text-[10px] font-medium text-white [writing-mode:horizontal-tb]">
            {tasks.length}
          </span>
        </button>
      </div>
    );
  }

  return (
    <aside
      aria-labelledby="related-tasks-heading"
      className="flex w-72 shrink-0 flex-col border-l border-(--color-border-subtle) bg-(--color-surface-raised)"
    >
      <div className="flex items-center gap-2 border-b border-(--color-border-subtle) px-3 py-2.5">
        <h2
          id="related-tasks-heading"
          className="flex-1 text-xs font-medium uppercase tracking-wider text-(--color-ink-faint)"
        >
          Related tasks
        </h2>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          aria-pressed={true}
          aria-label="Hide related tasks"
          className="rounded px-1.5 py-0.5 text-xs text-(--color-ink-faint) transition hover:text-(--color-ink)"
        >
          <span aria-hidden="true">›</span>
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {data.topics.length > 0 && (
          <p className="mb-3 text-xs leading-relaxed text-(--color-ink-muted)">
            Picked from what this conversation is about:{' '}
            <span className="text-(--color-ink)">{data.topics.join(', ')}</span>.
          </p>
        )}

        {error && (
          <p role="alert" className="mb-3 text-xs text-(--color-danger)">
            {error}
          </p>
        )}

        <ul className="space-y-2">
          {tasks.map((task) => (
            <li
              key={task.issueId}
              className="rounded-lg border border-(--color-border-subtle) bg-(--color-surface) p-3"
            >
              <h3 className="text-sm font-medium leading-snug">
                <a
                  href={task.webUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-(--color-accent) hover:underline"
                >
                  {task.title}
                </a>
              </h3>

              <p className="mt-1 truncate text-[11px] text-(--color-ink-faint)">
                {task.projectPath}
              </p>

              {task.reason && (
                <p className="mt-2 text-xs text-(--color-ink-muted)">{task.reason}</p>
              )}

              {task.labels.length > 0 && (
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {task.labels.slice(0, 4).map((label) => (
                    <li
                      key={label}
                      className="rounded-full border border-(--color-border-subtle) px-2 py-0.5 text-[10px] text-(--color-ink-faint)"
                    >
                      {label}
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onShare(task)}
                  className="rounded-md bg-(--color-accent) px-2.5 py-1 text-xs font-medium text-white transition hover:opacity-90"
                >
                  Share to chat
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDismissed((current) => [...current, task.issueId]);
                    startTransition(async () => {
                      const result = await dismissSuggestionAction(conversationId, task.issueId);
                      if (result.error) setError(result.error);
                    });
                  }}
                  className="ml-auto rounded-md px-2 py-1 text-xs text-(--color-ink-faint) transition hover:text-(--color-ink)"
                >
                  Not relevant
                </button>
              </div>
            </li>
          ))}
        </ul>

        <p className="mt-3 text-[11px] leading-relaxed text-(--color-ink-faint)">
          Dismissing hides a task for everybody in this conversation.
        </p>
      </div>
    </aside>
  );
}
