"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { errorMessage } from "@/components/post-json";
import type { DocumentView } from "@/lib/documents";

type CategoryOption = { key: string; label: string };

type DocumentActionsProps = {
  document: DocumentView;
  categories: readonly CategoryOption[];
};

type Mode = "idle" | "editing" | "confirming";

async function sendJson(url: string, method: "PATCH" | "DELETE", body?: unknown): Promise<void> {
  const response = await fetch(url, {
    method,
    ...(body === undefined
      ? {}
      : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  });
  if (response.ok) return;

  let message = `Request to ${url} failed`;
  try {
    const parsed: unknown = await response.json();
    if (parsed && typeof parsed === "object" && "error" in parsed) {
      const error = (parsed as { error: unknown }).error;
      if (typeof error === "string" && error.length > 0) message = error;
    }
  } catch {
    // Non-JSON error responses fall through to the generic message.
  }
  throw new Error(message);
}

export function DocumentActions({ document, categories }: DocumentActionsProps) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("idle");
  const [pending, startTransition] = useTransition();
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const busy = working || pending;

  function reset() {
    setMode("idle");
    setError(null);
  }

  async function onSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setError(null);
    setWorking(true);
    try {
      await sendJson(`/api/documents/${document.id}`, "PATCH", {
        title: String(data.get("title") ?? ""),
        category: String(data.get("category") ?? ""),
        description: String(data.get("description") ?? ""),
      });
      setMode("idle");
      startTransition(() => router.refresh());
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setWorking(false);
    }
  }

  async function onDelete() {
    setError(null);
    setWorking(true);
    try {
      await sendJson(`/api/documents/${document.id}`, "DELETE");
      setMode("idle");
      startTransition(() => router.refresh());
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setWorking(false);
    }
  }

  if (mode === "editing") {
    return (
      <form onSubmit={onSave} className="mt-4 grid gap-3 border-t border-slate-200 pt-4">
        <div>
          <label htmlFor={`edit-title-${document.id}`} className="block text-sm font-medium">
            Title
          </label>
          <input
            id={`edit-title-${document.id}`}
            name="title"
            type="text"
            defaultValue={document.title}
            required
            maxLength={200}
            className="mt-2 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-ink focus:ring-1 focus:ring-ink"
          />
        </div>
        <div>
          <label htmlFor={`edit-category-${document.id}`} className="block text-sm font-medium">
            Category
          </label>
          <select
            id={`edit-category-${document.id}`}
            name="category"
            defaultValue={document.category}
            className="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-ink focus:ring-1 focus:ring-ink"
          >
            {categories.map((category) => (
              <option key={category.key} value={category.key}>
                {category.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`edit-description-${document.id}`} className="block text-sm font-medium">
            Description
          </label>
          <textarea
            id={`edit-description-${document.id}`}
            name="description"
            rows={2}
            maxLength={1000}
            defaultValue={document.description}
            className="mt-2 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-ink focus:ring-1 focus:ring-ink"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center rounded-lg bg-ink px-3 py-1.5 text-sm font-medium text-white transition hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? "Saving…" : "Save changes"}
          </button>
          <button
            type="button"
            onClick={reset}
            disabled={busy}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted transition hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            Cancel
          </button>
          {error ? (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          ) : null}
        </div>
      </form>
    );
  }

  return (
    <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-200 pt-4">
      {mode === "confirming" ? (
        <>
          <p className="text-sm font-medium">Delete “{document.title}” for everyone?</p>
          <button
            type="button"
            onClick={onDelete}
            disabled={busy}
            className="inline-flex items-center rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? "Deleting…" : "Yes, delete"}
          </button>
          <button
            type="button"
            onClick={reset}
            disabled={busy}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted transition hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            Keep it
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setMode("editing")}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-ink transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            Edit details
          </button>
          <button
            type="button"
            onClick={() => setMode("confirming")}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
          >
            Delete
          </button>
        </>
      )}
      {error ? (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
