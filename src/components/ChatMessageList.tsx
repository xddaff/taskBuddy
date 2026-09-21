"use client";

import { useEffect, useRef } from "react";
import { Avatar } from "@/components/Avatar";
import type { ChatMessageView } from "@/lib/chat";

type ChatMessageListProps = {
  messages: ChatMessageView[];
  viewerUserId: number;
  loading?: boolean;
  emptyLabel: string;
};

const GROUP_WINDOW_MS = 5 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const time = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  if (Date.now() - date.getTime() < DAY_MS) return time;
  return `${date.toLocaleDateString([], { month: "short", day: "numeric" })}, ${time}`;
}

function startsGroup(message: ChatMessageView, previous: ChatMessageView | undefined): boolean {
  if (!previous) return true;
  if (previous.gitlabUserId !== message.gitlabUserId) return true;
  const gap = new Date(message.createdAt).getTime() - new Date(previous.createdAt).getTime();
  return !Number.isFinite(gap) || gap > GROUP_WINDOW_MS;
}

export function ChatMessageList({
  messages,
  viewerUserId,
  loading = false,
  emptyLabel,
}: ChatMessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastId = messages.length > 0 ? messages[messages.length - 1].id : 0;

  useEffect(() => {
    const container = scrollRef.current;
    if (container) container.scrollTop = container.scrollHeight;
  }, [lastId]);

  return (
    <div
      ref={scrollRef}
      role="log"
      aria-live="polite"
      aria-label="Messages"
      tabIndex={0}
      className="h-[26rem] overflow-y-auto px-4 py-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink sm:px-6"
    >
      {messages.length === 0 ? (
        <p className="flex h-full items-center justify-center rounded-lg border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-muted">
          {loading ? "Loading messages…" : emptyLabel}
        </p>
      ) : (
        <ul className="space-y-1">
          {messages.map((message, index) => {
            const mine = message.gitlabUserId === viewerUserId;
            const fresh = startsGroup(message, messages[index - 1]);

            return (
              <li
                key={message.id}
                className={`flex items-start gap-3 ${fresh ? "pt-3 first:pt-0" : ""} ${
                  mine ? "flex-row-reverse" : ""
                }`}
              >
                <div className="w-8 shrink-0">
                  {fresh ? (
                    <Avatar
                      student={{
                        name: message.authorName,
                        username: message.authorUsername,
                        avatarUrl: null,
                      }}
                      size="sm"
                    />
                  ) : null}
                </div>

                <div className={`min-w-0 max-w-[80%] ${mine ? "items-end text-right" : ""}`}>
                  {fresh ? (
                    <p
                      className={`flex flex-wrap items-baseline gap-2 text-xs ${
                        mine ? "justify-end" : ""
                      }`}
                    >
                      <span className="font-medium text-ink">
                        {mine ? "You" : message.authorName}
                      </span>
                      <span className="text-muted">@{message.authorUsername}</span>
                      <time dateTime={message.createdAt} className="text-muted" suppressHydrationWarning>
                        {formatTimestamp(message.createdAt)}
                      </time>
                    </p>
                  ) : null}

                  <p
                    className={`mt-1 inline-block whitespace-pre-wrap break-words rounded-xl px-3 py-2 text-left text-sm ring-1 ring-inset ${
                      mine
                        ? "bg-emerald-50 text-ink ring-emerald-200"
                        : "bg-slate-50 text-ink ring-slate-200"
                    }`}
                  >
                    {message.body}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
