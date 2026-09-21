import { DocumentActions } from "@/components/DocumentActions";
import {
  canManageDocument,
  categoriesFor,
  formatFileSize,
  groupByCategory,
  type DocumentCollection,
  type DocumentView,
} from "@/lib/documents";
import type { Student } from "@/lib/types";

type DocumentListProps = {
  documents: DocumentView[];
  collection?: DocumentCollection;
  viewer: Student;
  endpoint?: string;
};

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function DocumentList({
  documents,
  collection = "official",
  viewer,
  endpoint = "/api/documents",
}: DocumentListProps) {
  const groups = groupByCategory(documents, collection);
  const categoryOptions = categoriesFor(collection).map((category) => ({
    key: category.key,
    label: category.label,
  }));

  return (
    <div className="space-y-8">
      {groups.map((group) => (
        <section key={group.key} aria-labelledby={`category-${group.key}`}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id={`category-${group.key}`} className="text-lg font-semibold">
              {group.label}
            </h2>
            <p className="text-sm text-muted">
              {group.documents.length} {group.documents.length === 1 ? "file" : "files"}
            </p>
          </div>
          <p className="mt-1 text-sm text-muted">{group.blurb}</p>

          {group.documents.length > 0 ? (
            <ul className="mt-4 space-y-4">
              {group.documents.map((entry) => {
                const canManage = canManageDocument(viewer, entry);
                return (
                  <li
                    key={entry.id}
                    className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0">
                        <h3 className="text-base font-medium">{entry.title}</h3>
                        {entry.description ? (
                          <p className="mt-1 text-sm text-muted">{entry.description}</p>
                        ) : null}
                        <p className="mt-2 break-words text-xs text-muted">
                          <span className="font-medium text-slate-600">{entry.originalName}</span>
                          {" · "}
                          {formatFileSize(entry.sizeBytes)}
                          {" · "}
                          Uploaded by {entry.uploadedByName} on{" "}
                          <time dateTime={entry.createdAt}>{formatDate(entry.createdAt)}</time>
                        </p>
                      </div>
                      <a
                        href={`/api/documents/${entry.id}/download`}
                        className="inline-flex shrink-0 items-center rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-ink transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                      >
                        Download
                        <span className="sr-only"> {entry.title}</span>
                      </a>
                    </div>

                    {canManage ? (
                      <DocumentActions
                        document={entry}
                        categories={categoryOptions}
                        endpoint={endpoint}
                      />
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-muted">
              Nothing filed under {group.label.toLowerCase()} yet.
            </p>
          )}
        </section>
      ))}
    </div>
  );
}
