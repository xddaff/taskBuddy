'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { loadOlderMessages } from '@/app/(app)/c/actions';
import type { SuggestedTaskDto, WireMessage } from '@/lib/chat-types';
import { Composer } from './Composer';
import { MessageList } from './MessageList';
import { RelatedTasks } from './RelatedTasks';
import { useSocket } from './useSocket';
import type { ChatMember, OutgoingMessage, PendingMessage } from './types';

interface Props {
  conversationId: string;
  currentUserId: string;
  members: ChatMember[];
  initialMessages: WireMessage[];
  initialHasMore: boolean;
  realtimeUrl: string;
  /// Used in the composer placeholder, e.g. "Message #infra".
  conversationLabel: string;
}

interface Typist {
  userId: string;
  name: string | null;
  at: number;
}

/// A received typing signal is only good for a few seconds; the sender does not
/// send a "stopped" event, and pretending otherwise leaves the indicator stuck.
const TYPING_TTL_MS = 3000;
/// How long to wait for the server to broadcast our own message back before
/// treating the send as lost.
const SEND_TIMEOUT_MS = 10_000;
/// Distance from the bottom that still counts as "following the conversation".
const NEAR_BOTTOM_PX = 120;

export function ChatView({
  conversationId,
  currentUserId,
  members,
  initialMessages,
  initialHasMore,
  realtimeUrl,
  conversationLabel,
}: Props) {
  const { socket, status } = useSocket(realtimeUrl);

  const [messages, setMessages] = useState<WireMessage[]>(initialMessages);
  const [pending, setPending] = useState<PendingMessage[]>([]);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [typists, setTypists] = useState<Typist[]>([]);
  const [announcement, setAnnouncement] = useState('');
  const [unseen, setUnseen] = useState(0);
  const [following, setFollowing] = useState(true);
  const [replyTo, setReplyTo] = useState<WireMessage | null>(null);
  const [restoredDraft, setRestoredDraft] = useState<{ value: string; token: number } | null>(null);
  const [suggestionRevision, setSuggestionRevision] = useState(0);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const followingRef = useRef(true);
  const messagesRef = useRef(messages);
  const sendTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const lastTypingEmit = useRef(0);
  const draftToken = useRef(0);

  messagesRef.current = messages;

  const scrollToLatest = useCallback((behavior: ScrollBehavior = 'auto') => {
    const element = scrollRef.current;
    if (!element) return;
    element.scrollTo({ top: element.scrollHeight, behavior });
    followingRef.current = true;
    setFollowing(true);
    setUnseen(0);
  }, []);

  const handleScroll = useCallback(() => {
    const element = scrollRef.current;
    if (!element) return;
    const distance = element.scrollHeight - element.scrollTop - element.clientHeight;
    const near = distance <= NEAR_BOTTOM_PX;
    followingRef.current = near;
    setFollowing(near);
    if (near) setUnseen(0);
  }, []);

  const upsert = useCallback((incoming: WireMessage) => {
    setMessages((current) => {
      const index = current.findIndex((message) => message.id === incoming.id);
      const next = index === -1 ? [...current, incoming] : current.slice();
      if (index !== -1) next[index] = incoming;
      next.sort(byCreatedAt);
      return next;
    });
  }, []);

  const emitRead = useCallback(
    (messageId?: string) => {
      if (!socket?.connected) return;
      socket.emit('conversation:read', { conversationId, messageId });
    },
    [socket, conversationId],
  );

  const clearSendTimer = useCallback((clientId: string) => {
    const timer = sendTimers.current.get(clientId);
    if (timer) clearTimeout(timer);
    sendTimers.current.delete(clientId);
  }, []);

  /// Drops the optimistic copy of a message once the real one arrives.
  ///
  /// The wire format carries no client id, so the match is made on content and
  /// kind, oldest first: the service processes one socket's sends in order, so
  /// the oldest unresolved match is the right one.
  const resolvePending = useCallback(
    (message: WireMessage) => {
      setPending((current) => {
        const index = current.findIndex(
          (entry) => entry.kind === message.kind && entry.body === message.body,
        );
        if (index === -1) return current;
        const entry = current[index];
        if (entry) clearSendTimer(entry.clientId);
        return [...current.slice(0, index), ...current.slice(index + 1)];
      });
    },
    [clearSendTimer],
  );

  /// Rolls the oldest unresolved send back into the composer.
  ///
  /// Losing what you typed is far worse than seeing it again, so the body is
  /// handed back rather than discarded with the failed bubble.
  const rollbackOldestPending = useCallback(() => {
    setPending((current) => {
      const [oldest, ...rest] = current;
      if (!oldest) return current;
      clearSendTimer(oldest.clientId);
      if (oldest.kind === 'TEXT' && oldest.body) {
        draftToken.current += 1;
        setRestoredDraft({ value: oldest.body, token: draftToken.current });
      }
      return rest;
    });
  }, [clearSendTimer]);

  useEffect(() => {
    if (!socket) return;

    const onReady = () => {
      // Covers a conversation created after this socket connected, and every
      // reconnect: the service re-derives membership before joining.
      socket.emit('conversation:subscribe', { conversationId });
      emitRead(lastOf(messagesRef.current)?.id);
    };

    const onNew = (payload: unknown) => {
      const message = asWireMessage(payload);
      if (!message || message.conversationId !== conversationId) return;

      upsert(message);

      if (message.authorId === currentUserId) {
        resolvePending(message);
      } else {
        setTypists((current) => current.filter((typist) => typist.userId !== message.authorId));
        setAnnouncement(`${message.author.name ?? 'Someone'} said: ${preview(message)}`);
        if (!followingRef.current) setUnseen((count) => count + 1);
        if (typeof document !== 'undefined' && document.hasFocus()) emitRead(message.id);
      }

      if (message.kind === 'TEXT' && !message.deletedAt) {
        setSuggestionRevision((revision) => revision + 1);
      }
    };

    const onUpdated = (payload: unknown) => {
      const message = asWireMessage(payload);
      if (!message || message.conversationId !== conversationId) return;
      upsert(message);
    };

    const onTyping = (payload: unknown) => {
      const record = asRecord(payload);
      if (record?.conversationId !== conversationId) return;
      const userId = typeof record.userId === 'string' ? record.userId : null;
      if (!userId || userId === currentUserId) return;
      const name = typeof record.name === 'string' ? record.name : null;

      setTypists((current) => [
        ...current.filter((typist) => typist.userId !== userId),
        { userId, name, at: Date.now() },
      ]);
    };

    const onPresenceLeft = (payload: unknown) => {
      const record = asRecord(payload);
      const userId = typeof record?.userId === 'string' ? record.userId : null;
      if (!userId) return;
      setTypists((current) => current.filter((typist) => typist.userId !== userId));
    };

    const onError = (payload: unknown) => {
      const record = asRecord(payload);
      const message = typeof record?.message === 'string' ? record.message : 'Something went wrong.';
      setError(message);
      rollbackOldestPending();
    };

    socket.on('ready', onReady);
    socket.on('message:new', onNew);
    socket.on('message:updated', onUpdated);
    socket.on('typing', onTyping);
    socket.on('presence:left', onPresenceLeft);
    socket.on('error:chat', onError);

    return () => {
      socket.off('ready', onReady);
      socket.off('message:new', onNew);
      socket.off('message:updated', onUpdated);
      socket.off('typing', onTyping);
      socket.off('presence:left', onPresenceLeft);
      socket.off('error:chat', onError);
    };
  }, [socket, conversationId, currentUserId, upsert, resolvePending, rollbackOldestPending, emitRead]);

  useEffect(() => {
    if (typists.length === 0) return;
    const timer = setInterval(() => {
      setTypists((current) => current.filter((typist) => Date.now() - typist.at < TYPING_TTL_MS));
    }, 1000);
    return () => clearInterval(timer);
  }, [typists.length]);

  useEffect(() => {
    const onFocus = () => emitRead(lastOf(messagesRef.current)?.id);
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [emitRead]);

  useEffect(() => {
    const timers = sendTimers.current;
    return () => {
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
    };
  }, []);

  useEffect(() => {
    scrollToLatest();
    // Only on mount: afterwards the list follows the conversation only while
    // the reader is already at the bottom.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lastMessageId = lastOf(messages)?.id;
  useEffect(() => {
    if (followingRef.current) scrollToLatest('smooth');
  }, [lastMessageId, pending.length, scrollToLatest]);

  const send = useCallback(
    (outgoing: OutgoingMessage) => {
      if (!socket?.connected) {
        setError('Not connected to chat. Your message has not been sent.');
        return;
      }

      const clientId = makeClientId();
      const entry: PendingMessage = {
        ...outgoing,
        clientId,
        createdAt: new Date().toISOString(),
        replyToLabel: replyTo ? (replyTo.author.name ?? 'Unknown') : null,
      };

      setPending((current) => [...current, entry]);
      setError(null);
      setReplyTo(null);

      socket.emit('message:send', {
        conversationId,
        body: outgoing.body,
        replyToId: outgoing.replyToId ?? undefined,
        attachmentIds: outgoing.attachments.map((attachment) => attachment.id),
        kind: outgoing.kind,
        metadata: outgoing.metadata,
      });

      sendTimers.current.set(
        clientId,
        setTimeout(() => {
          sendTimers.current.delete(clientId);
          setPending((current) => current.filter((item) => item.clientId !== clientId));
          setError('That message did not send. Check your connection and try again.');
          if (entry.kind === 'TEXT' && entry.body) {
            draftToken.current += 1;
            setRestoredDraft({ value: entry.body, token: draftToken.current });
          }
        }, SEND_TIMEOUT_MS),
      );

      scrollToLatest('smooth');
    },
    [socket, conversationId, replyTo, scrollToLatest],
  );

  const shareTask = useCallback(
    (task: SuggestedTaskDto) => {
      send({
        body: task.title,
        replyToId: null,
        attachments: [],
        kind: 'TASK_CARD',
        metadata: {
          issueId: task.issueId,
          title: task.title,
          webUrl: task.webUrl,
          projectPath: task.projectPath,
          labels: task.labels,
          estimatedHours: task.estimatedHours,
        },
      });
    },
    [send],
  );

  const notifyTyping = useCallback(() => {
    if (!socket?.connected) return;
    const now = Date.now();
    // The receiving side keeps an indicator alive for 3s, so re-announcing
    // every couple of seconds is enough and one event per keystroke is not.
    if (now - lastTypingEmit.current < 2000) return;
    lastTypingEmit.current = now;
    socket.emit('typing', { conversationId });
  }, [socket, conversationId]);

  const react = useCallback(
    (messageId: string, emoji: string) => {
      if (!socket?.connected) {
        setError('Not connected to chat.');
        return;
      }
      socket.emit('reaction:toggle', { messageId, emoji });
    },
    [socket],
  );

  const editMessage = useCallback(
    (messageId: string, body: string) => {
      if (!socket?.connected) {
        setError('Not connected to chat.');
        return;
      }
      socket.emit('message:edit', { messageId, body });
    },
    [socket],
  );

  const deleteMessage = useCallback(
    (messageId: string) => {
      if (!socket?.connected) {
        setError('Not connected to chat.');
        return;
      }
      socket.emit('message:delete', { messageId });
    },
    [socket],
  );

  const loadOlder = useCallback(() => {
    const oldest = messagesRef.current[0];
    if (!oldest || loadingOlder) return;

    setLoadingOlder(true);
    const element = scrollRef.current;
    const anchor = element ? element.scrollHeight - element.scrollTop : null;

    void loadOlderMessages(conversationId, oldest.id)
      .then((page) => {
        if (page.error) {
          setError(page.error);
          return;
        }
        setHasMore(page.hasMore);
        setMessages((current) => {
          const known = new Set(current.map((message) => message.id));
          const additions = page.messages.filter((message) => !known.has(message.id));
          return [...additions, ...current].sort(byCreatedAt);
        });

        // Restore the reading position: prepending content otherwise jerks the
        // viewport up by the height of the page just added.
        if (element && anchor !== null) {
          requestAnimationFrame(() => {
            element.scrollTop = element.scrollHeight - anchor;
          });
        }
      })
      .finally(() => setLoadingOlder(false));
  }, [conversationId, loadingOlder]);

  const typingLabel = useMemo(() => describeTypists(typists), [typists]);

  return (
    <div className="flex min-h-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col">
        {status === 'offline' || status === 'reconnecting' ? (
          <p
            role="status"
            className="border-b border-(--color-border-subtle) bg-(--color-surface-raised) px-6 py-1.5 text-center text-xs text-(--color-warning)"
          >
            {status === 'reconnecting'
              ? 'Reconnecting to chat…'
              : 'Not connected to chat. New messages will not appear until this reconnects.'}
          </p>
        ) : null}

        <div className="relative flex min-h-0 flex-1 flex-col">
          <MessageList
            messages={messages}
            pending={pending}
            currentUserId={currentUserId}
            members={members}
            hasMore={hasMore}
            loadingOlder={loadingOlder}
            onLoadOlder={loadOlder}
            onReact={react}
            onReply={setReplyTo}
            onEdit={editMessage}
            onDelete={deleteMessage}
            scrollRef={scrollRef}
            onScroll={handleScroll}
          />

          {!following && (
            <button
              type="button"
              onClick={() => scrollToLatest('smooth')}
              className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full border border-(--color-border-subtle) bg-(--color-surface-raised) px-3 py-1.5 text-xs shadow-lg shadow-black/40 transition hover:bg-(--color-surface-hover)"
            >
              Jump to latest
              {unseen > 0 && (
                <span className="ml-2 rounded-full bg-(--color-accent) px-1.5 py-0.5 text-[10px] font-medium text-white">
                  {unseen > 99 ? '99+' : unseen}
                  <span className="sr-only"> new messages</span>
                </span>
              )}
            </button>
          )}
        </div>

        <div aria-live="polite" className="sr-only">
          {announcement}
        </div>

        {error && (
          <div
            role="alert"
            className="flex items-start gap-3 border-t border-(--color-danger)/40 bg-(--color-danger)/10 px-6 py-2 text-xs text-(--color-danger)"
          >
            <span className="flex-1">{error}</span>
            <button
              type="button"
              onClick={() => setError(null)}
              className="shrink-0 rounded px-1 underline-offset-2 hover:underline"
            >
              Dismiss
            </button>
          </div>
        )}

        <p
          aria-live="polite"
          className="h-5 shrink-0 truncate px-6 text-xs text-(--color-ink-faint)"
        >
          {typingLabel}
        </p>

        <Composer
          members={members}
          conversationLabel={conversationLabel}
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
          onSend={send}
          onTyping={notifyTyping}
          restoredDraft={restoredDraft}
          disabled={status === 'offline'}
        />
      </div>

      <RelatedTasks
        conversationId={conversationId}
        revision={suggestionRevision}
        onShare={shareTask}
      />
    </div>
  );
}

function byCreatedAt(a: WireMessage, b: WireMessage): number {
  if (a.createdAt === b.createdAt) return a.id < b.id ? -1 : 1;
  return a.createdAt < b.createdAt ? -1 : 1;
}

function lastOf<T>(items: T[]): T | undefined {
  return items.length === 0 ? undefined : items[items.length - 1];
}

function describeTypists(typists: Typist[]): string {
  if (typists.length === 0) return '';
  const names = typists.map((typist) => typist.name ?? 'Someone');
  if (names.length === 1) return `${names[0]} is typing…`;
  if (names.length === 2) return `${names[0]} and ${names[1]} are typing…`;
  return 'Several people are typing…';
}

function preview(message: WireMessage): string {
  if (message.kind === 'TASK_CARD') return `shared a task, ${message.metadata?.title ?? message.body}`;
  if (message.body) return message.body.slice(0, 140);
  if (message.attachments.length > 0) return 'sent an attachment';
  return 'sent a message';
}

function makeClientId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function asRecord(payload: unknown): Record<string, unknown> | null {
  if (typeof payload !== 'object' || payload === null) return null;
  return payload as Record<string, unknown>;
}

/// Socket payloads are untrusted input like any other. Only the fields the list
/// cannot render without are required; the rest fall back to empty.
function asWireMessage(payload: unknown): WireMessage | null {
  const record = asRecord(payload);
  if (!record) return null;
  if (typeof record.id !== 'string' || typeof record.conversationId !== 'string') return null;
  if (typeof record.createdAt !== 'string' || typeof record.authorId !== 'string') return null;
  if (typeof record.author !== 'object' || record.author === null) return null;

  return record as unknown as WireMessage;
}
