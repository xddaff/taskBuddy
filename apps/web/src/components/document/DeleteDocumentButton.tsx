'use client';

import { useState, useTransition } from 'react';
import { deleteDocument } from '@/app/(app)/d/[documentId]/actions';

export function DeleteDocumentButton({
  documentId,
  title,
}: {
  documentId: string;
  title: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const remove = () => {
    startTransition(async () => {
      const result = await deleteDocument({ documentId });
      // A successful delete redirects, so anything returned here is a refusal.
      if (result && !result.ok) {
        setError(result.message);
        setConfirming(false);
      }
    });
  };

  if (!confirming) {
    return (
      <div className="text-right">
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="rounded-md px-2 py-1 text-xs text-(--color-ink-faint) transition hover:text-(--color-danger)"
        >
          Delete document
        </button>
        {error && (
          <p role="alert" className="mt-1 text-xs text-(--color-danger)">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-(--color-ink-muted)">Delete “{title}” for everyone?</span>
      <button
        type="button"
        disabled={pending}
        onClick={remove}
        className="rounded-md bg-(--color-danger) px-2.5 py-1 text-xs font-medium text-white transition hover:opacity-90 disabled:opacity-50"
      >
        Delete
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => setConfirming(false)}
        className="rounded-md px-2 py-1 text-xs text-(--color-ink-faint) transition hover:text-(--color-ink)"
      >
        Cancel
      </button>
    </div>
  );
}
