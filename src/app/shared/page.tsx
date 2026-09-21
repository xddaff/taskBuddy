import { redirect } from "next/navigation";
import { DocumentList } from "@/components/DocumentList";
import { DocumentUploadForm } from "@/components/DocumentUploadForm";
import { NavBar } from "@/components/NavBar";
import { Pane } from "@/components/Pane";
import {
  MAX_UPLOAD_BYTES,
  SHARED_CATEGORIES,
  UPLOAD_ACCEPT,
  allowedTypesSummary,
  formatFileSize,
  listDocuments,
} from "@/lib/documents";
import { getCurrentStudent } from "@/lib/session";

export const dynamic = "force-dynamic";

const CATEGORY_OPTIONS = SHARED_CATEGORIES.map((category) => ({
  key: category.key,
  label: category.label,
}));

export default async function SharedFilesPage() {
  const student = await getCurrentStudent();
  if (!student) redirect("/");

  const documents = await listDocuments("shared");

  return (
    <div className="flex min-h-dvh flex-col">
      <NavBar student={student} active="shared" />

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-3 p-3">
        <div className="px-2 pt-1">
          <h1 className="text-2xl font-medium tracking-tight">Shared files</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted">
            A class dropbox for notes, resources, and anything else students want to pass around.
            Anyone in the course can upload and download. Official paperwork stays on Bureaucracy.
          </p>
        </div>

        <Pane title="Share a file">
          <p className="mb-4 text-sm text-muted">
            The class will see your name on the file. You can edit or remove what you posted; the
            instructor can moderate anything.
          </p>
          <DocumentUploadForm
            endpoint="/api/shared-files"
            categories={CATEGORY_OPTIONS}
            accept={UPLOAD_ACCEPT}
            maxBytes={MAX_UPLOAD_BYTES}
            maxSizeLabel={formatFileSize(MAX_UPLOAD_BYTES)}
            allowedTypesLabel={allowedTypesSummary()}
            titlePlaceholder="e.g. Week 2 lecture notes"
            descriptionPlaceholder="What classmates should know about this file"
            submitLabel="Share file"
            idPrefix="shared"
          />
        </Pane>

        <DocumentList
          documents={documents}
          collection="shared"
          viewer={student}
          endpoint="/api/shared-files"
        />
      </main>
    </div>
  );
}
