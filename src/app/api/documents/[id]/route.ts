import { NextResponse } from "next/server";
import {
  DocumentValidationError,
  deleteDocument,
  getDocument,
  updateDocument,
  type MetadataInput,
} from "@/lib/documents";
import { getCurrentStudent } from "@/lib/session";
import { isMaintainer, type Student } from "@/lib/types";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

type Guard = { student: Student } | { response: NextResponse };

async function requireInstructor(action: string): Promise<Guard> {
  const student = await getCurrentStudent();
  if (!student) {
    return { response: NextResponse.json({ error: `Sign in to ${action}` }, { status: 401 }) };
  }
  if (!isMaintainer(student)) {
    return {
      response: NextResponse.json(
        { error: `Only instructors can ${action}` },
        { status: 403 },
      ),
    };
  }
  return { student };
}

async function readId(context: RouteContext): Promise<number | null> {
  const { id } = await context.params;
  const parsed = Number.parseInt(id, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function readMetadata(body: Record<string, unknown>): MetadataInput {
  const input: MetadataInput = {};
  if (typeof body.title === "string") input.title = body.title;
  if (typeof body.category === "string") input.category = body.category;
  if (typeof body.description === "string") input.description = body.description;
  return input;
}

export async function PATCH(request: Request, context: RouteContext) {
  const guard = await requireInstructor("edit course documents");
  if ("response" in guard) return guard.response;

  const id = await readId(context);
  if (id === null) {
    return NextResponse.json({ error: "Unknown document" }, { status: 404 });
  }

  let body: Record<string, unknown> = {};
  try {
    const parsed: unknown = await request.json();
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      body = parsed as Record<string, unknown>;
    }
  } catch {
    // An unparseable body means no fields to change, which fails validation below.
  }

  const input = readMetadata(body);
  if (Object.keys(input).length === 0) {
    return NextResponse.json(
      { error: "Send a title, category or description to change" },
      { status: 400 },
    );
  }

  try {
    const document = await updateDocument(id, input);
    if (!document) {
      return NextResponse.json({ error: "Unknown document" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, document });
  } catch (cause) {
    if (cause instanceof DocumentValidationError) {
      return NextResponse.json({ error: cause.message }, { status: 400 });
    }
    throw cause;
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const guard = await requireInstructor("delete course documents");
  if ("response" in guard) return guard.response;

  const id = await readId(context);
  if (id === null) {
    return NextResponse.json({ error: "Unknown document" }, { status: 404 });
  }

  const existing = await getDocument(id);
  if (!existing) {
    return NextResponse.json({ error: "Unknown document" }, { status: 404 });
  }

  await deleteDocument(id);
  return NextResponse.json({ ok: true });
}
