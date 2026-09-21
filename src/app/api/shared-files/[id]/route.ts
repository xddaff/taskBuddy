import { NextResponse } from "next/server";
import {
  DocumentValidationError,
  canManageDocument,
  deleteDocument,
  getDocument,
  updateDocument,
  type MetadataInput,
} from "@/lib/documents";
import { getCurrentStudent } from "@/lib/session";
import type { Student } from "@/lib/types";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

async function requireStudent(): Promise<Student | NextResponse> {
  const student = await getCurrentStudent();
  if (!student) {
    return NextResponse.json({ error: "Sign in to manage this file" }, { status: 401 });
  }
  return student;
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
  const student = await requireStudent();
  if (student instanceof NextResponse) return student;

  const id = await readId(context);
  if (id === null) {
    return NextResponse.json({ error: "Unknown file" }, { status: 404 });
  }

  const existing = await getDocument(id);
  if (!existing || existing.collection !== "shared") {
    return NextResponse.json({ error: "Unknown file" }, { status: 404 });
  }
  if (!canManageDocument(student, existing)) {
    return NextResponse.json(
      { error: "You can only edit files you uploaded" },
      { status: 403 },
    );
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
      return NextResponse.json({ error: "Unknown file" }, { status: 404 });
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
  const student = await requireStudent();
  if (student instanceof NextResponse) return student;

  const id = await readId(context);
  if (id === null) {
    return NextResponse.json({ error: "Unknown file" }, { status: 404 });
  }

  const existing = await getDocument(id);
  if (!existing || existing.collection !== "shared") {
    return NextResponse.json({ error: "Unknown file" }, { status: 404 });
  }
  if (!canManageDocument(student, existing)) {
    return NextResponse.json(
      { error: "You can only delete files you uploaded" },
      { status: 403 },
    );
  }

  await deleteDocument(id);
  return NextResponse.json({ ok: true });
}
