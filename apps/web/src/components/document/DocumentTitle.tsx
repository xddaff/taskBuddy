'use client';

import { useRef, useState, type FormEvent } from 'react';
import { renameDocument } from '@/app/(app)/d/[documentId]/actions';

interface Props {
  documentId: string;
  title: string;
}

export function DocumentTitle({ documentId, title }: Props) {
  const [value, setValue] = useState(title);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const committed = useRef(title);

  const commit = async (event?: FormEvent) => {
    event?.preventDefault();
    const next = value.trim();

    if (next === committed.current) {
      setEditing(false);
      setError(null);
      return;
    }

    const result = await renameDocument({ documentId, title: next });
    if (!result.ok) {
      setError(result.message ?? 'Could not rename this document.');
      return;
    }

    committed.current = result.title ?? next;
    setValue(committed.current);
    setEditing(false);
    setError(null);
  };

  if (!editing) {
    return (
      <div className="min-w-0">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="max-w-full truncate rounded text-left text-lg font-semibold tracking-tight hover:text-(--color-accent)"
        >
          {value}
          <span className="sr-only"> — rename this document</span>
        </button>
        {error && (
          <p role="alert" className="text-xs text-(--color-danger)">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={(event) => void commit(event)} className="min-w-0">
      <label htmlFor="document-title" className="sr-only">
        Document title
      </label>
      <input
        id="document-title"
        autoFocus
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onBlur={() => void commit()}
        onKeyDown={(event) => {
          if (event.key !== 'Escape') return;
          setValue(committed.current);
          setEditing(false);
          setError(null);
        }}
        className="w-full rounded-md border border-(--color-border-subtle) bg-(--color-surface-raised) px-2 py-1 text-lg font-semibold tracking-tight outline-none focus:border-(--color-accent)"
      />
      {error && (
        <p role="alert" className="mt-1 text-xs text-(--color-danger)">
          {error}
        </p>
      )}
    </form>
  );
}
