"use client";

import { useState, type KeyboardEvent } from "react";
import { errorMessage } from "@/components/post-json";

// Mirrors MESSAGE_MAX_LENGTH in @/lib/chat, which cannot be imported here because
// that module reaches Prisma. The server stays the authority on the limit.
const MESSAGE_MAX_LENGTH = 2000;

type ChatComposerProps = {
  roomLabel: string;
  onSend: (body: string) => Promise<void>;
};

export function ChatComposer({ roomLabel, onSend }: ChatComposerProps) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tooLong = draft.trim().length > MESSAGE_MAX_LENGTH;
  const canSend = draft.trim().length > 0 && !tooLong && !sending;

  async function send() {
    const body = draft.trim();
    if (body.length === 0 || tooLong || sending) return;
    setError(null);
    setSending(true);
    try {
      await onSend(body);
      setDraft("");
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setSending(false);
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void send();
    }
  }

  return (
    <div className="border-t border-slate-200 px-4 py-4 sm:px-6">
      <label htmlFor="chat-composer" className="block text-sm font-medium">
        Message {roomLabel}
      </label>
      <p className="mt-1 text-xs text-muted">Enter sends, Shift+Enter starts a new line.</p>

      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
        <textarea
          id="chat-composer"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          rows={2}
          disabled={sending}
          placeholder="Write a message"
          aria-describedby={error ? "chat-composer-error" : undefined}
          className="min-h-[3rem] flex-1 resize-y rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition placeholder:text-muted focus:border-ink focus:ring-1 focus:ring-ink disabled:cursor-not-allowed disabled:opacity-60"
        />
        <button
          type="button"
          onClick={send}
          disabled={!canSend}
          className="inline-flex items-center justify-center rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-60"
        >
          {sending ? "Sending…" : "Send"}
        </button>
      </div>

      {tooLong ? (
        <p className="mt-2 text-sm text-amber-700">
          {draft.trim().length} of {MESSAGE_MAX_LENGTH} characters. Trim the message before sending.
        </p>
      ) : null}

      {error ? (
        <p id="chat-composer-error" role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
