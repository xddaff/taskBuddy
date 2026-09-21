import { NextResponse } from "next/server";
import {
  DocumentValidationError,
  listDocuments,
  saveDocument,
} from "@/lib/documents";
import { getCurrentStudent } from "@/lib/session";

export const dynamic = "force-dynamic";

function readText(form: FormData, field: string): string {
  const value = form.get(field);
  return typeof value === "string" ? value : "";
}

function readFile(form: FormData): File | null {
  const value = form.get("file");
  return value instanceof File ? value : null;
}

export async function GET() {
  const student = await getCurrentStudent();
  if (!student) {
    return NextResponse.json({ error: "Sign in to see shared files" }, { status: 401 });
  }

  const documents = await listDocuments("shared");
  return NextResponse.json({ documents });
}

export async function POST(request: Request) {
  const student = await getCurrentStudent();
  if (!student) {
    return NextResponse.json({ error: "Sign in to share a file" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Send the upload as multipart form data" }, { status: 400 });
  }

  const file = readFile(form);
  if (!file) {
    return NextResponse.json({ error: "Attach a file to upload" }, { status: 400 });
  }

  try {
    const document = await saveDocument({
      collection: "shared",
      title: readText(form, "title"),
      category: readText(form, "category"),
      description: readText(form, "description"),
      file,
      uploader: student,
    });
    return NextResponse.json({ ok: true, document }, { status: 201 });
  } catch (cause) {
    if (cause instanceof DocumentValidationError) {
      return NextResponse.json({ error: cause.message }, { status: 400 });
    }
    throw cause;
  }
}
