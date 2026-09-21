"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { errorMessage } from "@/components/post-json";

type CategoryOption = { key: string; label: string };

type DocumentUploadFormProps = {
  endpoint?: string;
  categories: readonly CategoryOption[];
  accept: string;
  maxBytes: number;
  maxSizeLabel: string;
  allowedTypesLabel: string;
  titlePlaceholder?: string;
  descriptionPlaceholder?: string;
  submitLabel?: string;
  idPrefix?: string;
};

async function readError(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (body && typeof body === "object" && "error" in body) {
      const error = (body as { error: unknown }).error;
      if (typeof error === "string" && error.length > 0) return error;
    }
  } catch {
    // Non-JSON error responses fall through to the generic message.
  }
  return "The upload failed";
}

export function DocumentUploadForm({
  endpoint = "/api/documents",
  categories,
  accept,
  maxBytes,
  maxSizeLabel,
  allowedTypesLabel,
  titlePlaceholder = "e.g. Project plan 2026",
  descriptionPlaceholder = "One line on what this document is for",
  submitLabel = "Upload document",
  idPrefix = "document",
}: DocumentUploadFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    const form = event.currentTarget;
    event.preventDefault();
    setError(null);
    setUploaded(null);

    const data = new FormData(form);
    const file = data.get("file");
    if (!(file instanceof File) || file.size === 0) {
      setError("Choose a file to upload");
      return;
    }
    if (file.size > maxBytes) {
      setError(`That file is larger than the ${maxSizeLabel} limit`);
      return;
    }
    if (String(data.get("title") ?? "").trim() === "") {
      setError("Give the document a title");
      return;
    }

    setUploading(true);
    try {
      const response = await fetch(endpoint, { method: "POST", body: data });
      if (!response.ok) throw new Error(await readError(response));
      form.reset();
      setUploaded(file.name);
      startTransition(() => router.refresh());
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setUploading(false);
    }
  }

  const busy = uploading || pending;

  return (
    <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label htmlFor={`${idPrefix}-file`} className="block text-sm font-medium">
          File
        </label>
        <input
          id={`${idPrefix}-file`}
          name="file"
          type="file"
          accept={accept}
          required
          aria-describedby={`${idPrefix}-file-hint`}
          className="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-ink hover:file:bg-slate-200 focus:border-ink focus:ring-1 focus:ring-ink"
        />
        <p id={`${idPrefix}-file-hint`} className="mt-1.5 text-xs text-muted">
          {allowedTypesLabel}. Up to {maxSizeLabel}.
        </p>
      </div>

      <div>
        <label htmlFor={`${idPrefix}-title`} className="block text-sm font-medium">
          Title
        </label>
        <input
          id={`${idPrefix}-title`}
          name="title"
          type="text"
          required
          maxLength={200}
          placeholder={titlePlaceholder}
          className="mt-2 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-ink focus:ring-1 focus:ring-ink"
        />
      </div>

      <div>
        <label htmlFor={`${idPrefix}-category`} className="block text-sm font-medium">
          Category
        </label>
        <select
          id={`${idPrefix}-category`}
          name="category"
          defaultValue={categories[0]?.key}
          className="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-ink focus:ring-1 focus:ring-ink"
        >
          {categories.map((category) => (
            <option key={category.key} value={category.key}>
              {category.label}
            </option>
          ))}
        </select>
      </div>

      <div className="sm:col-span-2">
        <label htmlFor={`${idPrefix}-description`} className="block text-sm font-medium">
          Description <span className="font-normal text-muted">(optional)</span>
        </label>
        <textarea
          id={`${idPrefix}-description`}
          name="description"
          rows={2}
          maxLength={1000}
          placeholder={descriptionPlaceholder}
          className="mt-2 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-ink focus:ring-1 focus:ring-ink"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? "Uploading…" : submitLabel}
        </button>
        {uploaded && !busy ? (
          <p className="text-sm text-emerald-700">Uploaded {uploaded}</p>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        ) : null}
      </div>
    </form>
  );
}
