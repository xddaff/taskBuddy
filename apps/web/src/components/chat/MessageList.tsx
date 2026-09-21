'use client';

import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Avatar } from '@/components/Avatar';
import type { WireMessage } from '@/lib/chat-types';
import {
  attachmentUrl,
  clockTime,
  dayKey,
  dayLabel,
  formatBytes,
  fullTimestamp,
  minutesBetween,
} from './formatTime';
import type { ChatMember, PendingMessage } from './types';

interface Props {
  messages: WireMessage[];
  pending: PendingMessage[];
  currentUserId: string;
  members: ChatMember[];
  hasMore: boolean;
  loadingOlder: boolean;
  onLoadOlder: () => void;
  onReact: (messageId: string, emoji: string) => void;
  onReply: (message: WireMessage) => void;
  onEdit: (messageId: string, body: string) => void;
  onDelete: (messageId: string) => void;
  scrollRef: RefObject<HTMLDivElement | null>;
  onScroll: () => void;
}

/// Consecutive messages from the same person inside this window are shown as
/// one block, with a single name and timestamp.
const GROUP_WINDOW_MINUTES = 5;

const QUICK_REACTIONS = ['👍', '🎉', '✅', '👀', '❤️', '😄'] as const;

const MENTION_EVERYONE = new Set(['all', 'channel', 'everyone']);

interface Row {
  message: WireMessage;
  showHeader: boolean;
  separator: string | null;
}

export function MessageList({
  messages,
  pending,
  currentUserId,
  members,
  hasMore,
  loadingOlder,
  onLoadOlder,
  onReact,
  onReply,
  onEdit,
  onDelete,
  scrollRef,
  onScroll,
}: Props) {
  const [editing, setEditing] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);

  const rows = useMemo(() => buildRows(messages), [messages]);
  const me = members.find((member) => member.id === currentUserId) ?? null;
  const lastRealMessage = rows.length > 0 ? rows[rows.length - 1]?.message : undefined;

  return (
    <div
      ref={scrollRef}
      onScroll={onScroll}
      className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
    >
      <div className="mx-auto w-full max-w-3xl px-4 py-4">
        <div className="pb-3 text-center">
          {hasMore ? (
            <button
              type="button"
              onClick={onLoadOlder}
              disabled={loadingOlder}
              className="rounded-md border border-(--color-border-subtle) px-3 py-1.5 text-xs text-(--color-ink-muted) transition hover:bg-(--color-surface-hover) hover:text-(--color-ink) disabled:opacity-50"
            >
              {loadingOlder ? 'Loading earlier messages…' : 'Load earlier messages'}
            </button>
          ) : (
            <p className="text-xs text-(--color-ink-faint)">This is the start of the conversation.</p>
          )}
        </div>

        <ol className="space-y-0.5">
          {rows.map((row) => (
            <li key={row.message.id}>
              {row.separator && <DaySeparator label={row.separator} iso={row.message.createdAt} />}
              <MessageRow
                message={row.message}
                showHeader={row.showHeader}
                currentUserId={currentUserId}
                members={members}
                editing={editing === row.message.id}
                confirmingDelete={confirmingDelete === row.message.id}
                onStartEdit={() => {
                  setConfirmingDelete(null);
                  setEditing(row.message.id);
                }}
                onCancelEdit={() => setEditing(null)}
                onSubmitEdit={(body) => {
                  setEditing(null);
                  onEdit(row.message.id, body);
                }}
                onAskDelete={() => {
                  setEditing(null);
                  setConfirmingDelete(row.message.id);
                }}
                onCancelDelete={() => setConfirmingDelete(null)}
                onConfirmDelete={() => {
                  setConfirmingDelete(null);
                  onDelete(row.message.id);
                }}
                onReact={(emoji) => onReact(row.message.id, emoji)}
                onReply={() => onReply(row.message)}
              />
            </li>
          ))}

          {pending.map((entry) => (
            <li key={entry.clientId}>
              <PendingRow
                entry={entry}
                author={me}
                showHeader={
                  !lastRealMessage ||
                  lastRealMessage.authorId !== currentUserId ||
                  entry.kind !== 'TEXT'
                }
              />
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function buildRows(messages: WireMessage[]): Row[] {
  const rows: Row[] = [];
  let previous: WireMessage | null = null;

  for (const message of messages) {
    const separator =
      !previous || dayKey(previous.createdAt) !== dayKey(message.createdAt)
        ? dayLabel(message.createdAt)
        : null;

    // A reply, a task card and a system notice each carry their own framing, so
    // they never fold into the block above them.
    const showHeader =
      separator !== null ||
      previous === null ||
      previous.authorId !== message.authorId ||
      message.kind !== 'TEXT' ||
      previous.kind !== 'TEXT' ||
      message.replyToId !== null ||
      minutesBetween(previous.createdAt, message.createdAt) > GROUP_WINDOW_MINUTES;

    rows.push({ message, showHeader, separator });
    previous = message;
  }

  return rows;
}

function DaySeparator({ label, iso }: { label: string; iso: string }) {
  return (
    <div className="flex items-center gap-3 py-4">
      <span aria-hidden="true" className="h-px flex-1 bg-(--color-border-subtle)" />
      <time
        dateTime={iso}
        suppressHydrationWarning
        className="text-[11px] font-medium uppercase tracking-wider text-(--color-ink-faint)"
      >
        {label}
      </time>
      <span aria-hidden="true" className="h-px flex-1 bg-(--color-border-subtle)" />
    </div>
  );
}

interface RowProps {
  message: WireMessage;
  showHeader: boolean;
  currentUserId: string;
  members: ChatMember[];
  editing: boolean;
  confirmingDelete: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSubmitEdit: (body: string) => void;
  onAskDelete: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
  onReact: (emoji: string) => void;
  onReply: () => void;
}

function MessageRow({
  message,
  showHeader,
  currentUserId,
  members,
  editing,
  confirmingDelete,
  onStartEdit,
  onCancelEdit,
  onSubmitEdit,
  onAskDelete,
  onCancelDelete,
  onConfirmDelete,
  onReact,
  onReply,
}: RowProps) {
  const mine = message.authorId === currentUserId;
  const deleted = message.deletedAt !== null;
  const mentionsMe = message.mentions.some((mention) => mention.userId === currentUserId);

  if (message.kind === 'SYSTEM') {
    return (
      <p className="py-1.5 text-center text-xs text-(--color-ink-faint)">
        {message.body}{' '}
        <time dateTime={message.createdAt} suppressHydrationWarning>
          {clockTime(message.createdAt)}
        </time>
      </p>
    );
  }

  return (
    <article
      className={`group relative flex gap-3 rounded-md px-2 py-0.5 transition ${
        mentionsMe && !deleted
          ? 'bg-(--color-accent-soft)/40 hover:bg-(--color-accent-soft)/60'
          : 'hover:bg-(--color-surface-raised)/60'
      } ${showHeader ? 'mt-3 first:mt-0' : ''}`}
    >
      <div className="w-8 shrink-0 pt-1">
        {showHeader ? (
          <Avatar name={message.author.name} image={message.author.image} />
        ) : (
          <time
            dateTime={message.createdAt}
            suppressHydrationWarning
            className="hidden pt-0.5 text-[10px] leading-5 text-(--color-ink-faint) group-hover:block"
          >
            {clockTime(message.createdAt)}
          </time>
        )}
      </div>

      <div className="min-w-0 flex-1">
        {message.replyTo && <ReplyQuote replyTo={message.replyTo} />}

        {showHeader && (
          <p className="flex items-baseline gap-2">
            <span className="text-sm font-medium">{message.author.name ?? 'Unknown'}</span>
            <time
              dateTime={message.createdAt}
              title={fullTimestamp(message.createdAt)}
              suppressHydrationWarning
              className="text-[11px] text-(--color-ink-faint)"
            >
              {clockTime(message.createdAt)}
            </time>
          </p>
        )}

        {deleted ? (
          <p className="py-0.5 text-sm italic text-(--color-ink-faint)">
            This message was deleted
          </p>
        ) : editing ? (
          <EditForm initialValue={message.body} onCancel={onCancelEdit} onSubmit={onSubmitEdit} />
        ) : message.kind === 'TASK_CARD' ? (
          <TaskCardMessage message={message} />
        ) : (
          <p className="whitespace-pre-wrap break-words py-0.5 text-sm leading-relaxed text-(--color-ink)">
            <MessageBody body={message.body} members={members} currentUserId={currentUserId} />
            {message.editedAt && (
              <span className="ml-1.5 align-baseline text-[10px] text-(--color-ink-faint)">
                (edited)
              </span>
            )}
          </p>
        )}

        {!deleted && message.attachments.length > 0 && (
          <Attachments attachments={message.attachments} />
        )}

        {message.reactions.length > 0 && (
          <Reactions
            reactions={message.reactions}
            currentUserId={currentUserId}
            members={members}
            onReact={onReact}
          />
        )}

        {confirmingDelete && (
          <div className="mt-1.5 flex items-center gap-2 text-xs">
            <span className="text-(--color-ink-muted)">Delete this message?</span>
            <button
              type="button"
              onClick={onConfirmDelete}
              className="rounded-md bg-(--color-danger) px-2 py-1 font-medium text-white transition hover:opacity-90"
            >
              Delete
            </button>
            <button
              type="button"
              onClick={onCancelDelete}
              className="rounded-md border border-(--color-border-subtle) px-2 py-1 transition hover:bg-(--color-surface-hover)"
            >
              Keep
            </button>
          </div>
        )}
      </div>

      {!deleted && !editing && (
        <HoverActions
          canModify={mine}
          authorName={message.author.name ?? 'this message'}
          onReact={onReact}
          onReply={onReply}
          onEdit={message.kind === 'TEXT' ? onStartEdit : null}
          onDelete={onAskDelete}
        />
      )}
    </article>
  );
}

function ReplyQuote({ replyTo }: { replyTo: NonNullable<WireMessage['replyTo']> }) {
  return (
    <p className="flex items-center gap-1.5 truncate pt-1 text-xs text-(--color-ink-faint)">
      <span aria-hidden="true" className="text-(--color-ink-faint)">
        ↳
      </span>
      <span className="sr-only">Replying to</span>
      <span className="font-medium text-(--color-ink-muted)">
        {replyTo.author.name ?? 'Unknown'}
      </span>
      <span className="truncate">
        {replyTo.deletedAt ? 'message was deleted' : replyTo.body || 'attachment'}
      </span>
    </p>
  );
}

function TaskCardMessage({ message }: { message: WireMessage }) {
  const metadata = message.metadata;

  return (
    <div className="my-1 rounded-lg border border-(--color-border-subtle) border-l-2 border-l-(--color-accent) bg-(--color-surface-raised) p-3">
      <p className="text-[10px] font-medium uppercase tracking-wider text-(--color-accent)">
        Shared task
      </p>

      <h4 className="mt-1 text-sm font-medium leading-snug">
        {metadata ? (
          <a
            href={metadata.webUrl}
            target="_blank"
            rel="noreferrer"
            className="hover:text-(--color-accent) hover:underline"
          >
            {metadata.title}
          </a>
        ) : (
          message.body
        )}
      </h4>

      {metadata && (
        <>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-(--color-ink-faint)">
            <span className="truncate">{metadata.projectPath}</span>
            {metadata.estimatedHours !== null && (
              <>
                <span aria-hidden="true">·</span>
                <span>about {metadata.estimatedHours}h</span>
              </>
            )}
          </p>

          {metadata.labels.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {metadata.labels.slice(0, 5).map((label) => (
                <li
                  key={label}
                  className="rounded-full border border-(--color-border-subtle) px-2 py-0.5 text-[11px] text-(--color-ink-faint)"
                >
                  {label}
                </li>
              ))}
            </ul>
          )}

          <a
            href={metadata.webUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-block text-xs text-(--color-accent) hover:underline"
          >
            Open in GitLab
          </a>
        </>
      )}
    </div>
  );
}

function Attachments({ attachments }: { attachments: WireMessage['attachments'] }) {
  return (
    <ul className="mt-1.5 flex flex-wrap gap-2">
      {attachments.map((attachment) => {
        const url = attachmentUrl(attachment.storageKey);
        const isImage = attachment.mimeType.startsWith('image/');

        return (
          <li key={attachment.id}>
            {isImage ? (
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="block overflow-hidden rounded-lg border border-(--color-border-subtle)"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- served
                    from an authorised route the image optimiser cannot fetch. */}
                <img
                  src={url}
                  alt={attachment.filename}
                  width={attachment.width ?? undefined}
                  height={attachment.height ?? undefined}
                  className="max-h-80 w-auto max-w-full object-contain"
                />
              </a>
            ) : (
              <a
                href={url}
                className="flex items-center gap-2 rounded-lg border border-(--color-border-subtle) bg-(--color-surface-raised) px-3 py-2 text-xs transition hover:bg-(--color-surface-hover)"
              >
                <span
                  aria-hidden="true"
                  className="rounded bg-(--color-surface-hover) px-1.5 py-0.5 text-[10px] uppercase text-(--color-ink-faint)"
                >
                  {extensionOf(attachment.filename)}
                </span>
                <span className="max-w-60 truncate">{attachment.filename}</span>
                <span className="text-(--color-ink-faint)">{formatBytes(attachment.byteSize)}</span>
                <span className="sr-only">Download</span>
              </a>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function Reactions({
  reactions,
  currentUserId,
  members,
  onReact,
}: {
  reactions: WireMessage['reactions'];
  currentUserId: string;
  members: ChatMember[];
  onReact: (emoji: string) => void;
}) {
  const grouped = useMemo(() => {
    const byEmoji = new Map<string, string[]>();
    for (const reaction of reactions) {
      const existing = byEmoji.get(reaction.emoji);
      if (existing) existing.push(reaction.userId);
      else byEmoji.set(reaction.emoji, [reaction.userId]);
    }
    return [...byEmoji.entries()];
  }, [reactions]);

  const nameOf = (userId: string) =>
    members.find((member) => member.id === userId)?.name ?? 'Someone';

  return (
    <ul className="mt-1.5 flex flex-wrap gap-1.5">
      {grouped.map(([emoji, userIds]) => {
        const mine = userIds.includes(currentUserId);
        const who = userIds.map(nameOf).join(', ');

        return (
          <li key={emoji}>
            <button
              type="button"
              onClick={() => onReact(emoji)}
              aria-pressed={mine}
              title={`${who} reacted with ${emoji}`}
              className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition ${
                mine
                  ? 'border-(--color-accent) bg-(--color-accent-soft) text-(--color-ink)'
                  : 'border-(--color-border-subtle) bg-(--color-surface-raised) text-(--color-ink-muted) hover:bg-(--color-surface-hover)'
              }`}
            >
              <span aria-hidden="true">{emoji}</span>
              <span className="tabular-nums">{userIds.length}</span>
              <span className="sr-only">
                {emoji} reaction, {userIds.length} from {who}
                {mine ? ', including you' : ''}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function HoverActions({
  canModify,
  authorName,
  onReact,
  onReply,
  onEdit,
  onDelete,
}: {
  canModify: boolean;
  authorName: string;
  onReact: (emoji: string) => void;
  onReply: () => void;
  onEdit: (() => void) | null;
  onDelete: () => void;
}) {
  const [picking, setPicking] = useState(false);
  const pickerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!picking) return;
    pickerRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
  }, [picking]);

  const close = (returnFocus: boolean) => {
    setPicking(false);
    if (returnFocus) triggerRef.current?.focus();
  };

  return (
    <div className="absolute -top-3 right-2 flex items-center gap-1 rounded-lg border border-(--color-border-subtle) bg-(--color-surface-raised) p-0.5 opacity-0 shadow-lg shadow-black/30 transition group-focus-within:opacity-100 group-hover:opacity-100">
      {picking && (
        <div
          ref={pickerRef}
          role="group"
          aria-label="Pick a reaction"
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.stopPropagation();
              close(true);
              return;
            }
            if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
            event.preventDefault();
            const buttons = [...(pickerRef.current?.querySelectorAll('button') ?? [])];
            const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
            const step = event.key === 'ArrowRight' ? 1 : -1;
            const next = buttons[(index + step + buttons.length) % buttons.length];
            next?.focus();
          }}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) close(false);
          }}
          className="flex items-center gap-0.5 pr-1"
        >
          {QUICK_REACTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => {
                onReact(emoji);
                close(true);
              }}
              className="rounded px-1 py-0.5 text-sm transition hover:bg-(--color-surface-hover)"
            >
              <span aria-hidden="true">{emoji}</span>
              <span className="sr-only">React with {emoji}</span>
            </button>
          ))}
        </div>
      )}

      <ActionButton
        ref={triggerRef}
        label={`Add a reaction to the message from ${authorName}`}
        expanded={picking}
        onClick={() => setPicking((open) => !open)}
      >
        ☺
      </ActionButton>

      <ActionButton label={`Reply to ${authorName}`} onClick={onReply}>
        ↩
      </ActionButton>

      {canModify && onEdit && (
        <ActionButton label="Edit your message" onClick={onEdit}>
          ✎
        </ActionButton>
      )}

      {canModify && (
        <ActionButton label="Delete your message" onClick={onDelete} danger>
          ✕
        </ActionButton>
      )}
    </div>
  );
}

function ActionButton({
  ref,
  label,
  onClick,
  children,
  danger = false,
  expanded,
}: {
  ref?: RefObject<HTMLButtonElement | null>;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  danger?: boolean;
  expanded?: boolean;
}) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-expanded={expanded}
      className={`rounded px-1.5 py-0.5 text-xs transition hover:bg-(--color-surface-hover) ${
        danger ? 'text-(--color-danger)' : 'text-(--color-ink-muted) hover:text-(--color-ink)'
      }`}
    >
      <span aria-hidden="true">{children}</span>
    </button>
  );
}

function EditForm({
  initialValue,
  onCancel,
  onSubmit,
}: {
  initialValue: string;
  onCancel: () => void;
  onSubmit: (body: string) => void;
}) {
  const [value, setValue] = useState(initialValue);
  const ref = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.focus();
    element.setSelectionRange(element.value.length, element.value.length);
  }, []);

  const submit = () => {
    const body = value.trim();
    if (!body) return;
    onSubmit(body);
  };

  return (
    <div className="py-1">
      <label className="sr-only" htmlFor="edit-message">
        Edit your message
      </label>
      <textarea
        id="edit-message"
        ref={ref}
        value={value}
        rows={2}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            onCancel();
          }
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            submit();
          }
        }}
        className="w-full resize-none rounded-md border border-(--color-border-subtle) bg-(--color-surface) px-3 py-2 text-sm outline-none focus:border-(--color-accent)"
      />
      <div className="mt-1.5 flex items-center gap-2 text-xs">
        <button
          type="button"
          onClick={submit}
          disabled={value.trim().length === 0}
          className="rounded-md bg-(--color-accent) px-2.5 py-1 font-medium text-white transition hover:opacity-90 disabled:opacity-50"
        >
          Save
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-(--color-border-subtle) px-2.5 py-1 transition hover:bg-(--color-surface-hover)"
        >
          Cancel
        </button>
        <span className="text-(--color-ink-faint)">Enter to save, Escape to cancel</span>
      </div>
    </div>
  );
}

function PendingRow({
  entry,
  author,
  showHeader,
}: {
  entry: PendingMessage;
  author: ChatMember | null;
  showHeader: boolean;
}) {
  return (
    <article className="mt-3 flex gap-3 px-2 py-0.5 opacity-60">
      <div className="w-8 shrink-0 pt-1">
        {showHeader && <Avatar name={author?.name ?? null} image={author?.image ?? null} />}
      </div>
      <div className="min-w-0 flex-1">
        {entry.replyToLabel && (
          <p className="truncate pt-1 text-xs text-(--color-ink-faint)">
            <span aria-hidden="true">↳ </span>
            Replying to {entry.replyToLabel}
          </p>
        )}
        {showHeader && (
          <p className="flex items-baseline gap-2">
            <span className="text-sm font-medium">{author?.name ?? 'You'}</span>
            <span className="text-[11px] text-(--color-ink-faint)">Sending…</span>
          </p>
        )}
        <p className="whitespace-pre-wrap break-words py-0.5 text-sm leading-relaxed">
          {entry.body}
        </p>
        {entry.attachments.length > 0 && (
          <p className="text-xs text-(--color-ink-faint)">
            {entry.attachments.length} attachment{entry.attachments.length === 1 ? '' : 's'}
          </p>
        )}
      </div>
    </article>
  );
}

type Token =
  | { type: 'text'; value: string }
  | { type: 'mention'; value: string; username: string }
  | { type: 'link'; value: string };

const TOKEN_PATTERN = /(https?:\/\/[^\s<>"']+)|@([a-zA-Z0-9](?:[a-zA-Z0-9._-]*[a-zA-Z0-9])?)/g;

/// Splits a body into plain text, @mentions and links.
///
/// Mentions are matched syntactically and only highlighted when they resolve to
/// somebody in this conversation, which is the same rule the server uses to
/// decide who actually gets notified.
function tokenise(body: string): Token[] {
  const tokens: Token[] = [];
  let cursor = 0;

  for (const match of body.matchAll(TOKEN_PATTERN)) {
    const index = match.index;
    const [whole, link, username] = match;

    if (username !== undefined) {
      // "you@example.com" and "@@here" are not mentions.
      const before = index === 0 ? '' : (body[index - 1] ?? '');
      if (/[\w@]/.test(before)) continue;
    }

    if (index > cursor) tokens.push({ type: 'text', value: body.slice(cursor, index) });

    if (link !== undefined) {
      // Sentence punctuation sitting against a URL is not part of it.
      const trimmed = link.replace(/[.,;:!?)\]]+$/, '');
      tokens.push({ type: 'link', value: trimmed });
      cursor = index + trimmed.length;
    } else {
      tokens.push({ type: 'mention', value: whole, username: (username ?? '').toLowerCase() });
      cursor = index + whole.length;
    }
  }

  if (cursor < body.length) tokens.push({ type: 'text', value: body.slice(cursor) });
  return tokens;
}

function MessageBody({
  body,
  members,
  currentUserId,
}: {
  body: string;
  members: ChatMember[];
  currentUserId: string;
}) {
  const tokens = useMemo(() => tokenise(body), [body]);

  return (
    <>
      {tokens.map((token, index) => {
        if (token.type === 'text') return <span key={index}>{token.value}</span>;

        if (token.type === 'link') {
          return (
            <a
              key={index}
              href={token.value}
              target="_blank"
              rel="noreferrer nofollow"
              className="text-(--color-accent) underline decoration-(--color-accent)/40 underline-offset-2 hover:decoration-(--color-accent)"
            >
              {token.value}
            </a>
          );
        }

        const everyone = MENTION_EVERYONE.has(token.username);
        const member = members.find(
          (candidate) => candidate.gitlabUsername?.toLowerCase() === token.username,
        );
        if (!everyone && !member) return <span key={index}>{token.value}</span>;

        const aimedAtMe = everyone || member?.id === currentUserId;

        return (
          <span
            key={index}
            title={member?.name ?? undefined}
            className={`rounded px-1 py-0.5 text-sm font-medium ${
              aimedAtMe
                ? 'bg-(--color-accent) text-white'
                : 'bg-(--color-accent-soft) text-(--color-accent)'
            }`}
          >
            {token.value}
          </span>
        );
      })}
    </>
  );
}

function extensionOf(filename: string): string {
  const parts = filename.split('.');
  if (parts.length < 2) return 'file';
  return (parts[parts.length - 1] ?? 'file').slice(0, 4);
}
