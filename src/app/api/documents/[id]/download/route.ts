import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import {
  DEFAULT_MIME_TYPE,
  contentDispositionHeader,
  getDocumentFile,
} from "@/lib/documents";
import { getCurrentStudent } from "@/lib/session";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const student = await getCurrentStudent();
  if (!student) {
    return NextResponse.json({ error: "Sign in to download this document" }, { status: 401 });
  }

  const { id } = await context.params;
  const documentId = Number.parseInt(id, 10);
  if (!Number.isInteger(documentId) || documentId <= 0) {
    return NextResponse.json({ error: "Unknown document" }, { status: 404 });
  }

  const file = await getDocumentFile(documentId);
  if (!file) {
    return NextResponse.json({ error: "Unknown document" }, { status: 404 });
  }

  let sizeBytes: number;
  try {
    const stats = await stat(file.filePath);
    if (!stats.isFile()) throw new Error("Not a file");
    sizeBytes = stats.size;
  } catch {
    return NextResponse.json({ error: "The stored file is missing" }, { status: 404 });
  }

  const body = Readable.toWeb(
    createReadStream(file.filePath),
  ) as unknown as ReadableStream<Uint8Array>;

  return new Response(body, {
    headers: {
      "Content-Type": file.mimeType || DEFAULT_MIME_TYPE,
      "Content-Length": String(sizeBytes),
      "Content-Disposition": contentDispositionHeader(file.originalName),
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
