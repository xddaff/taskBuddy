"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChatComposer } from "@/components/ChatComposer";
import { ChatMessageList } from "@/components/ChatMessageList";
import type { ChatMessageView, ChatRoom, ChatRoomKey } from "@/lib/chat";

type ChatPanelProps = {
  rooms: ChatRoom[];
  initialRoom: ChatRoomKey;
  initialMessages: ChatMessageView[];
  viewerUserId: number;
  compact?: boolean;
};

const POLL_INTERVAL_MS = 5000;

async function readError(response: Response, fallback: string): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (body && typeof body === "object" && "error" in body) {
      const error = (body as { error: unknown }).error;
      if (typeof error === "string" && error.length > 0) return error;
    }
  } catch {
    // Non-JSON error responses fall through to the generic message.
  }
  return fallback;
}

function readMessages(payload: unknown): ChatMessageView[] {
  if (payload && typeof payload === "object" && "messages" in payload) {
    const messages = (payload as { messages: unknown }).messages;
    if (Array.isArray(messages)) return messages as ChatMessageView[];
  }
  return [];
}

/**
 * A poll started before a message was posted would otherwise drop it from the
 * list until the next tick, so locally known newer messages are kept.
 */
function mergeMessages(
  current: ChatMessageView[],
  incoming: ChatMessageView[],
): ChatMessageView[] {
  if (current.length === 0) return incoming;
  const newestIncomingId = incoming.length > 0 ? incoming[incoming.length - 1].id : 0;
  const incomingIds = new Set(incoming.map((message) => message.id));
  const pending = current.filter(
    (message) => message.id > newestIncomingId && !incomingIds.has(message.id),
  );
  return pending.length > 0 ? [...incoming, ...pending] : incoming;
}

function readMessage(payload: unknown): ChatMessageView | null {
  if (payload && typeof payload === "object" && "message" in payload) {
    const message = (payload as { message: unknown }).message;
    if (message && typeof message === "object") return message as ChatMessageView;
  }
  return null;
}

export function ChatPanel({
  rooms,
  initialRoom,
  initialMessages,
  viewerUserId,
  compact = false,
}: ChatPanelProps) {
  const [room, setRoom] = useState<ChatRoomKey>(initialRoom);
  const [messages, setMessages] = useState<ChatMessageView[]>(initialMessages);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const roomRef = useRef(room);
  roomRef.current = room;

  const activeRoom = rooms.find((entry) => entry.key === room) ?? rooms[0];

  // One interval per active room: it is cleared on unmount and whenever the room
  // changes, so only the visible room is ever polled.
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function refresh() {
      try {
        const response = await fetch(`/api/chat?room=${encodeURIComponent(room)}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(await readError(response, "Could not load messages"));
        }
        const payload: unknown = await response.json();
        if (cancelled) return;
        const incoming = readMessages(payload);
        setMessages((current) => mergeMessages(current, incoming));
        setLoadError(null);
      } catch (cause) {
        if (cancelled || controller.signal.aborted) return;
        setLoadError(cause instanceof Error ? cause.message : "Could not load messages");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void refresh();
    const timer = setInterval(() => void refresh(), POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      controller.abort();
      clearInterval(timer);
    };
  }, [room]);

  function selectRoom(next: ChatRoomKey) {
    if (next === room) return;
    setMessages([]);
    setLoadError(null);
    setLoading(true);
    setRoom(next);
  }

  const send = useCallback(async (body: string) => {
    const target = roomRef.current;
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ room: target, body }),
    });
    if (!response.ok) {
      throw new Error(await readError(response, "Could not send the message"));
    }
    const payload: unknown = await response.json();
    const message = readMessage(payload);
    if (message && roomRef.current === target) {
      setMessages((current) =>
        current.some((entry) => entry.id === message.id) ? current : [...current, message],
      );
    }
  }, []);

  return (
    <section
      className={`flex min-h-0 flex-col overflow-hidden bg-paper ${
        compact ? "h-full" : "rounded-pane shadow-pane"
      }`}
    >
      {rooms.length > 1 ? (
        <div className="flex items-center gap-1 px-3 pt-3 sm:px-4">
          <div role="group" aria-label="Chat rooms" className="flex items-center gap-1">
            {rooms.map((entry) => (
              <button
                key={entry.key}
                type="button"
                aria-pressed={entry.key === room}
                onClick={() => selectRoom(entry.key)}
                className={`rounded-full px-3 py-1 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
                  entry.key === room
                    ? "bg-white text-ink shadow-chip"
                    : "text-ink/70 hover:bg-white/70 hover:text-ink"
                }`}
              >
                {entry.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="px-4 pb-1 pt-3">
        <h2 className="text-[15px] font-medium tracking-tight text-ink">{activeRoom.label}</h2>
        {compact ? null : (
          <p className="mt-0.5 text-xs text-muted">{activeRoom.description}</p>
        )}
      </div>

      {loadError ? (
        <p role="alert" className="mx-3 rounded-2xl bg-peach/80 px-3 py-2 text-sm text-[#8c1d18]">
          {loadError}
        </p>
      ) : null}

      <ChatMessageList
        messages={messages}
        viewerUserId={viewerUserId}
        loading={loading}
        compact={compact}
        emptyLabel={`No messages in ${activeRoom.label.toLowerCase()} yet. Start the conversation.`}
      />

      <ChatComposer key={room} roomLabel={activeRoom.label.toLowerCase()} onSend={send} compact={compact} />
    </section>
  );
}
