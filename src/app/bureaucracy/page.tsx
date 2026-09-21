import { redirect } from "next/navigation";
import { DocumentList } from "@/components/DocumentList";
import { DocumentUploadForm } from "@/components/DocumentUploadForm";
import { NavBar } from "@/components/NavBar";
import { Pane } from "@/components/Pane";
import {
  DOCUMENT_CATEGORIES,
  MAX_UPLOAD_BYTES,
  UPLOAD_ACCEPT,
  allowedTypesSummary,
  formatFileSize,
  listDocuments,
} from "@/lib/documents";
import { getCurrentStudent } from "@/lib/session";
import { isMaintainer } from "@/lib/types";

export const dynamic = "force-dynamic";

const CATEGORY_OPTIONS = DOCUMENT_CATEGORIES.map((category) => ({
  key: category.key,
  label: category.label,
}));

export default async function BureaucracyPage() {
  const student = await getCurrentStudent();
  if (!student) redirect("/");

  const canManage = isMaintainer(student);
  const documents = await listDocuments();

  return (
    <div className="flex min-h-dvh flex-col">
      <NavBar student={student} active="bureaucracy" />

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-3 p-3">
        <div className="px-2 pt-1">
          <h1 className="text-2xl font-medium tracking-tight">Bureaucracy</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted">
            Official course paperwork: the project plan, the syllabus, and the guides and
            regulations. The instructor publishes everything here
            {canManage
              ? ". Upload a file to add it to the course record."
              : "; students can read and download only."}
          </p>
        </div>

        {canManage ? (
          <Pane title="Upload a document">
            <p className="mb-4 text-sm text-muted">
              Students can read and download whatever you publish here, but only instructors can
              upload, edit or delete.
            </p>
            <DocumentUploadForm
              categories={CATEGORY_OPTIONS}
              accept={UPLOAD_ACCEPT}
              maxBytes={MAX_UPLOAD_BYTES}
              maxSizeLabel={formatFileSize(MAX_UPLOAD_BYTES)}
              allowedTypesLabel={allowedTypesSummary()}
            />
          </Pane>
        ) : null}

        <DocumentList documents={documents} viewer={student} />
      </main>
    </div>
  );
}
