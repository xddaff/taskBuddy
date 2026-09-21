'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Avatar } from '@/components/Avatar';
import type { SuggestedTaskDto, WireMessage } from '@/lib/chat-types';
import { ACCEPT_ATTRIBUTE } from '@/lib/uploads';
import { formatBytes } from './formatTime';
import type { ChatMember, OutgoingMessage, UploadedAttachment } from './types';

interface Props {
  members: ChatMember[];
  conversationLabel: string;
  replyTo: WireMessage | null;
  onCancelReply: () => void;
  onSend: (outgoing: OutgoingMessage) => void;
  onTyping: () => void;
  /// Set when a send failed and the body is being handed back, so nothing the
  /// student typed is lost. The token changes even if the text repeats.
  restoredDraft: { value: string; token: number } | null;
  disabled: boolean;
}

interface UploadItem {
  localId: string;
  filename: string;
  byteSize: number;
  progress: number;
  status: 'uploading' | 'ready' | 'failed';
  error: string | null;
  attachment: UploadedAttachment | null;
}

interface MentionOption {
  key: string;
  username: string;
  label: string;
  detail: string;
  image: string | null;
}

const MAX_TEXTAREA_HEIGHT = 200;
const TASK_LOOKUP_DEBOUNCE_MS = 220;
const MENTION_EVERYONE: MentionOption = {
  key: 'all',
  username: 'all',
  label: '@all',
  detail: 'Notify everybody in this conversation',
  image: null,
};

export function Composer({
  members,
  conversationLabel,
  replyTo,
  onCancelReply,
  onSend,
  onTyping,
  restoredDraft,
  disabled,
}: Props) {
  const [value, setValue] = useState('');
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [mention, setMention] = useState<{ query: string; start: number } | null>(null);
  const [taskQuery, setTaskQuery] = useState<string | null>(null);
  const [taskResults, setTaskResults] = useState<SuggestedTaskDto[]>([]);
  const [taskLoading, setTaskLoading] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [dismissedMenu, setDismissedMenu] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const requests = useRef(new Map<string, XMLHttpRequest>());

  const mentionOptions = useMemo(
    () => (mention ? filterMentions(members, mention.query) : []),
    [mention, members],
  );

  const menuKey =
    taskQuery !== null ? `task:${taskQuery}` : mention ? `mention:${mention.query}` : null;
  const suppressed = menuKey !== null && menuKey === dismissedMenu;

  const openMenu: 'task' | 'mention' | null = suppressed
    ? null
    : taskQuery !== null
      ? 'task'
      : mentionOptions.length > 0
        ? 'mention'
        : null;

  const optionCount = openMenu === 'task' ? taskResults.length : mentionOptions.length;

  useEffect(() => {
    const element = textareaRef.current;
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = `${Math.min(element.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`;
  }, [value]);

  useEffect(() => {
    if (!restoredDraft) return;
    setValue(restoredDraft.value);
    textareaRef.current?.focus();
  }, [restoredDraft]);

  useEffect(() => {
    if (replyTo) textareaRef.current?.focus();
  }, [replyTo]);

  useEffect(() => {
    setHighlight((current) => (optionCount === 0 ? 0 : Math.min(current, optionCount - 1)));
  }, [optionCount]);

  useEffect(() => {
    if (taskQuery === null) {
      setTaskResults([]);
      setTaskLoading(false);
      return;
    }

    const query = taskQuery.trim();
    if (!query) {
      setTaskResults([]);
      setTaskLoading(false);
      return;
    }

    const controller = new AbortController();
    setTaskLoading(true);

    // Debounced: the student is still typing the query, and one request per
    // keystroke would mostly be racing itself.
    const timer = setTimeout(() => {
      void fetch(`/api/chat/issues?q=${encodeURIComponent(query)}`, {
        signal: controller.signal,
      })
        .then((response) => (response.ok ? response.json() : Promise.reject(new Error('lookup'))))
        .then((payload: { issues?: SuggestedTaskDto[] }) => {
          setTaskResults(payload.issues ?? []);
          setHighlight(0);
        })
        .catch(() => undefined)
        .finally(() => setTaskLoading(false));
    }, TASK_LOOKUP_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [taskQuery]);

  useEffect(() => {
    const inFlight = requests.current;
    return () => {
      for (const request of inFlight.values()) request.abort();
      inFlight.clear();
    };
  }, []);

  const syncMenus = useCallback((nextValue: string, caret: number) => {
    const slash = /^\/task(?:[ \t]+([^\n]*))?$/i.exec(nextValue);
    if (slash) {
      setTaskQuery(slash[1] ?? '');
      setMention(null);
      return;
    }
    setTaskQuery(null);
    setMention(mentionQueryAt(nextValue, caret));
  }, []);

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const next = event.target.value;
    setValue(next);
    setNotice(null);
    syncMenus(next, event.target.selectionStart ?? next.length);
    if (next.trim()) onTyping();
  };

  const insertMention = (option: MentionOption) => {
    const element = textareaRef.current;
    if (!mention || !element) return;

    const caret = element.selectionStart ?? value.length;
    const before = value.slice(0, mention.start);
    const after = value.slice(caret);
    const inserted = `@${option.username} `;
    const next = `${before}${inserted}${after}`;

    setValue(next);
    setMention(null);
    setDismissedMenu(null);

    const cursor = before.length + inserted.length;
    requestAnimationFrame(() => {
      element.focus();
      element.setSelectionRange(cursor, cursor);
    });
  };

  const shareIssue = (issue: SuggestedTaskDto) => {
    onSend({
      body: issue.title,
      replyToId: replyTo?.id ?? null,
      attachments: [],
      kind: 'TASK_CARD',
      metadata: {
        issueId: issue.issueId,
        title: issue.title,
        webUrl: issue.webUrl,
        projectPath: issue.projectPath,
        labels: issue.labels,
        estimatedHours: issue.estimatedHours,
      },
    });

    setValue('');
    setTaskQuery(null);
    setTaskResults([]);
    textareaRef.current?.focus();
  };

  const choose = (index: number) => {
    if (openMenu === 'task') {
      const issue = taskResults[index];
      if (issue) shareIssue(issue);
      return;
    }
    const option = mentionOptions[index];
    if (option) insertMention(option);
  };

  const submit = () => {
    const body = value.trim();

    if (/^\/task\b/i.test(body)) {
      setNotice('Pick an issue from the list to share it, or clear the command.');
      return;
    }
    if (uploads.some((upload) => upload.status === 'uploading')) {
      setNotice('Wait for the uploads to finish.');
      return;
    }

    const attachments = uploads
      .map((upload) => upload.attachment)
      .filter((attachment): attachment is UploadedAttachment => attachment !== null);

    if (!body && attachments.length === 0) return;

    onSend({ body, replyToId: replyTo?.id ?? null, attachments, kind: 'TEXT' });

    setValue('');
    setUploads([]);
    setMention(null);
    setTaskQuery(null);
    setNotice(null);
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (openMenu) {
      if (event.key === 'ArrowDown' && optionCount > 0) {
        event.preventDefault();
        setHighlight((current) => (current + 1) % optionCount);
        return;
      }
      if (event.key === 'ArrowUp' && optionCount > 0) {
        event.preventDefault();
        setHighlight((current) => (current - 1 + optionCount) % optionCount);
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        setDismissedMenu(menuKey);
        return;
      }
      if ((event.key === 'Enter' || event.key === 'Tab') && optionCount > 0) {
        event.preventDefault();
        choose(highlight);
        return;
      }
    }

    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  const startUpload = (file: File) => {
    const localId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    setUploads((current) => [
      ...current,
      {
        localId,
        filename: file.name,
        byteSize: file.size,
        progress: 0,
        status: 'uploading',
        error: null,
        attachment: null,
      },
    ]);

    const patch = (changes: Partial<UploadItem>) =>
      setUploads((current) =>
        current.map((item) => (item.localId === localId ? { ...item, ...changes } : item)),
      );

    const body = new FormData();
    body.append('file', file);

    // XMLHttpRequest rather than fetch: fetch still cannot report upload
    // progress, and a progress bar is the whole point of showing the file.
    const request = new XMLHttpRequest();
    requests.current.set(localId, request);

    request.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) patch({ progress: event.loaded / event.total });
    });

    request.addEventListener('load', () => {
      requests.current.delete(localId);
      const payload = parseJson(request.responseText);

      if (request.status < 200 || request.status >= 300) {
        const message = typeof payload?.error === 'string' ? payload.error : 'Upload failed.';
        patch({ status: 'failed', error: message, progress: 1 });
        return;
      }

      const attachment = asUploadedAttachment(payload);
      if (!attachment) {
        patch({ status: 'failed', error: 'The server sent back an unexpected reply.' });
        return;
      }

      patch({ status: 'ready', progress: 1, attachment, filename: attachment.filename });
    });

    request.addEventListener('error', () => {
      requests.current.delete(localId);
      patch({ status: 'failed', error: 'Upload failed.', progress: 1 });
    });

    request.addEventListener('abort', () => {
      requests.current.delete(localId);
    });

    request.open('POST', '/api/chat/upload');
    request.send(body);
  };

  const removeUpload = (localId: string) => {
    requests.current.get(localId)?.abort();
    requests.current.delete(localId);
    setUploads((current) => current.filter((item) => item.localId !== localId));
  };

  const listboxId = openMenu === 'task' ? 'chat-task-options' : 'chat-mention-options';
  const canSend =
    !disabled &&
    (value.trim().length > 0 || uploads.some((upload) => upload.status === 'ready')) &&
    !uploads.some((upload) => upload.status === 'uploading');

  return (
    <div className="shrink-0 border-t border-(--color-border-subtle) bg-(--color-surface) px-4 pb-4 pt-2">
      <div className="mx-auto w-full max-w-3xl">
        {replyTo && (
          <div className="mb-2 flex items-center gap-2 rounded-t-md border-l-2 border-l-(--color-accent) bg-(--color-surface-raised) px-3 py-2 text-xs">
            <span className="text-(--color-ink-faint)">Replying to</span>
            <span className="font-medium">{replyTo.author.name ?? 'Unknown'}</span>
            <span className="min-w-0 flex-1 truncate text-(--color-ink-muted)">
              {replyTo.body || 'attachment'}
            </span>
            <button
              type="button"
              onClick={onCancelReply}
              aria-label="Cancel reply"
              className="shrink-0 rounded px-1.5 py-0.5 text-(--color-ink-faint) transition hover:text-(--color-ink)"
            >
              <span aria-hidden="true">✕</span>
            </button>
          </div>
        )}

        {uploads.length > 0 && (
          <ul className="mb-2 space-y-1.5">
            {uploads.map((upload) => (
              <li
                key={upload.localId}
                className="rounded-md border border-(--color-border-subtle) bg-(--color-surface-raised) px-3 py-2"
              >
                <div className="flex items-center gap-2 text-xs">
                  <span className="min-w-0 flex-1 truncate">{upload.filename}</span>
                  <span className="shrink-0 text-(--color-ink-faint)">
                    {formatBytes(upload.byteSize)}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeUpload(upload.localId)}
                    aria-label={`Remove ${upload.filename}`}
                    className="shrink-0 rounded px-1.5 py-0.5 text-(--color-ink-faint) transition hover:text-(--color-ink)"
                  >
                    <span aria-hidden="true">✕</span>
                  </button>
                </div>

                {upload.status === 'uploading' && (
                  <div
                    role="progressbar"
                    aria-label={`Uploading ${upload.filename}`}
                    aria-valuenow={Math.round(upload.progress * 100)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    className="mt-1.5 h-1 overflow-hidden rounded-full bg-(--color-surface-hover)"
                  >
                    <div
                      className="h-full rounded-full bg-(--color-accent) transition-[width]"
                      style={{ width: `${Math.round(upload.progress * 100)}%` }}
                    />
                  </div>
                )}

                {upload.status === 'failed' && (
                  <p className="mt-1 text-xs text-(--color-danger)">{upload.error}</p>
                )}
              </li>
            ))}
          </ul>
        )}

        <div className="relative rounded-xl border border-(--color-border-subtle) bg-(--color-surface-raised) focus-within:border-(--color-accent)">
          {openMenu === 'mention' && (
            <MentionMenu
              id={listboxId}
              options={mentionOptions}
              highlight={highlight}
              onPick={(index) => choose(index)}
            />
          )}

          {openMenu === 'task' && (
            <TaskMenu
              id={listboxId}
              issues={taskResults}
              loading={taskLoading}
              query={taskQuery ?? ''}
              highlight={highlight}
              onPick={(index) => choose(index)}
            />
          )}

          <label className="sr-only" htmlFor="chat-composer">
            Message {conversationLabel}
          </label>
          <textarea
            id="chat-composer"
            ref={textareaRef}
            value={value}
            rows={1}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onClick={(event) =>
              syncMenus(value, event.currentTarget.selectionStart ?? value.length)
            }
            placeholder={`Message ${conversationLabel}`}
            aria-autocomplete={openMenu ? 'list' : undefined}
            aria-controls={openMenu ? listboxId : undefined}
            aria-expanded={openMenu ? true : undefined}
            aria-activedescendant={
              openMenu && optionCount > 0 ? `${listboxId}-option-${highlight}` : undefined
            }
            className="block max-h-50 w-full resize-none bg-transparent px-3 pt-3 text-sm leading-relaxed outline-none placeholder:text-(--color-ink-faint)"
          />

          <div className="flex items-center gap-2 px-2 pb-2">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={ACCEPT_ATTRIBUTE}
              className="sr-only"
              onChange={(event) => {
                for (const file of event.target.files ?? []) startUpload(file);
                event.target.value = '';
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="rounded-md px-2 py-1 text-xs text-(--color-ink-faint) transition hover:bg-(--color-surface-hover) hover:text-(--color-ink)"
            >
              <span aria-hidden="true">📎</span> Attach
            </button>

            <p className="min-w-0 flex-1 truncate text-[11px] text-(--color-ink-faint)">
              {notice ?? 'Enter to send, Shift+Enter for a new line, /task to share an issue'}
            </p>

            <button
              type="button"
              onClick={submit}
              disabled={!canSend}
              className="rounded-md bg-(--color-accent) px-3 py-1.5 text-xs font-medium text-white transition hover:opacity-90 disabled:opacity-40"
            >
              Send
            </button>
          </div>
        </div>

        <p aria-live="polite" className="sr-only">
          {notice ?? ''}
        </p>
      </div>
    </div>
  );
}

function MentionMenu({
  id,
  options,
  highlight,
  onPick,
}: {
  id: string;
  options: MentionOption[];
  highlight: number;
  onPick: (index: number) => void;
}) {
  return (
    <ul
      id={id}
      role="listbox"
      aria-label="People you can mention"
      className="absolute bottom-full left-0 z-10 mb-2 max-h-64 w-full overflow-y-auto rounded-lg border border-(--color-border-subtle) bg-(--color-surface-raised) py-1 shadow-xl shadow-black/40"
    >
      {options.map((option, index) => (
        <li
          key={option.key}
          id={`${id}-option-${index}`}
          role="option"
          aria-selected={index === highlight}
          onMouseDown={(event) => {
            // Keep the caret in the textarea: a blur here would lose the
            // insertion point the choice is relative to.
            event.preventDefault();
            onPick(index);
          }}
          className={`flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm ${
            index === highlight ? 'bg-(--color-surface-hover)' : ''
          }`}
        >
          {option.key === 'all' ? (
            <span
              aria-hidden="true"
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-(--color-accent-soft) text-[10px] text-(--color-accent)"
            >
              @
            </span>
          ) : (
            <Avatar name={option.detail} image={option.image} size="sm" />
          )}
          <span className="font-medium">{option.label}</span>
          <span className="min-w-0 flex-1 truncate text-xs text-(--color-ink-faint)">
            {option.detail}
          </span>
        </li>
      ))}
    </ul>
  );
}

function TaskMenu({
  id,
  issues,
  loading,
  query,
  highlight,
  onPick,
}: {
  id: string;
  issues: SuggestedTaskDto[];
  loading: boolean;
  query: string;
  highlight: number;
  onPick: (index: number) => void;
}) {
  return (
    <div className="absolute bottom-full left-0 z-10 mb-2 w-full rounded-lg border border-(--color-border-subtle) bg-(--color-surface-raised) shadow-xl shadow-black/40">
      <p className="border-b border-(--color-border-subtle) px-3 py-1.5 text-[11px] uppercase tracking-wider text-(--color-ink-faint)">
        Share a GitLab issue
      </p>

      {!query.trim() ? (
        <p className="px-3 py-2 text-xs text-(--color-ink-muted)">
          Keep typing to search open issues, e.g. <code>/task docker</code>.
        </p>
      ) : loading && issues.length === 0 ? (
        <p className="px-3 py-2 text-xs text-(--color-ink-muted)">Searching…</p>
      ) : issues.length === 0 ? (
        <p className="px-3 py-2 text-xs text-(--color-ink-muted)">
          No open issues match “{query.trim()}”.
        </p>
      ) : (
        <ul
          id={id}
          role="listbox"
          aria-label="Open issues matching your search"
          className="max-h-64 overflow-y-auto py-1"
        >
          {issues.map((issue, index) => (
            <li
              key={issue.issueId}
              id={`${id}-option-${index}`}
              role="option"
              aria-selected={index === highlight}
              onMouseDown={(event) => {
                event.preventDefault();
                onPick(index);
              }}
              className={`cursor-pointer px-3 py-1.5 ${
                index === highlight ? 'bg-(--color-surface-hover)' : ''
              }`}
            >
              <p className="truncate text-sm">{issue.title}</p>
              <p className="truncate text-[11px] text-(--color-ink-faint)">
                {issue.projectPath}
                {issue.labels.length > 0 ? ` · ${issue.labels.slice(0, 3).join(', ')}` : ''}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/// Finds the `@word` the caret is currently inside, if any.
function mentionQueryAt(value: string, caret: number): { query: string; start: number } | null {
  const upTo = value.slice(0, caret);
  const match = /(?:^|[^\w@])@([a-zA-Z0-9._-]*)$/.exec(upTo);
  if (!match) return null;
  const query = match[1] ?? '';
  return { query, start: caret - query.length - 1 };
}

function filterMentions(members: ChatMember[], query: string): MentionOption[] {
  const needle = query.toLowerCase();

  const options: MentionOption[] = members
    .filter((member) => member.gitlabUsername)
    .map((member) => ({
      key: member.id,
      username: member.gitlabUsername ?? '',
      label: `@${member.gitlabUsername}`,
      detail: member.name ?? 'Unknown',
      image: member.image,
    }));

  const all = [MENTION_EVERYONE, ...options];
  if (!needle) return all.slice(0, 8);

  return all
    .filter(
      (option) =>
        option.username.toLowerCase().startsWith(needle) ||
        option.detail.toLowerCase().includes(needle),
    )
    .slice(0, 8);
}

function parseJson(text: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed !== 'object' || parsed === null) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function asUploadedAttachment(payload: Record<string, unknown> | null): UploadedAttachment | null {
  if (!payload) return null;
  if (typeof payload.id !== 'string' || typeof payload.url !== 'string') return null;

  return {
    id: payload.id,
    url: payload.url,
    filename: typeof payload.filename === 'string' ? payload.filename : 'attachment',
    mimeType: typeof payload.mimeType === 'string' ? payload.mimeType : 'application/octet-stream',
    byteSize: typeof payload.byteSize === 'number' ? payload.byteSize : 0,
    width: typeof payload.width === 'number' ? payload.width : null,
    height: typeof payload.height === 'number' ? payload.height : null,
  };
}
