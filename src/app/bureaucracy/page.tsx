import { redirect } from "next/navigation";
import { DocumentList } from "@/components/DocumentList";
import { DocumentUploadForm } from "@/components/DocumentUploadForm";
import { NavBar } from "@/components/NavBar";
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
    <>
      <NavBar student={student} active="bureaucracy" />

      <main className="mx-auto w-full max-w-6xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Bureaucracy</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted">
            The official paperwork for the course: the project plan, the syllabus, and the guides
            and regulations you are expected to follow. Everything here is published by the
            instructor
            {canManage
              ? ". Upload a file to add it to the course record."
              : " and is read-only for students; open any entry to download it."}
          </p>
        </div>

        {canManage ? (
          <section
            aria-labelledby="upload-heading"
            className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <h2 id="upload-heading" className="text-lg font-semibold">
              Upload a document
            </h2>
            <p className="mt-1 text-sm text-muted">
              Students can read and download whatever you publish here, but only instructors can
              upload, edit or delete.
            </p>
            <div className="mt-5">
              <DocumentUploadForm
                categories={CATEGORY_OPTIONS}
                accept={UPLOAD_ACCEPT}
                maxBytes={MAX_UPLOAD_BYTES}
                maxSizeLabel={formatFileSize(MAX_UPLOAD_BYTES)}
                allowedTypesLabel={allowedTypesSummary()}
              />
            </div>
          </section>
        ) : null}

        <DocumentList documents={documents} canManage={canManage} />
      </main>
    </>
  );
}
