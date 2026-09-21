import { randomUUID } from "node:crypto";
import { mkdir, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/db";
import type { Student } from "@/lib/types";

export const DOCUMENT_CATEGORIES = [
  {
    key: "plan",
    label: "Project plan",
    blurb: "The plan the course project follows, with milestones and deliverables.",
  },
  {
    key: "syllabus",
    label: "Syllabus",
    blurb: "What the course covers, how it is graded, and the schedule.",
  },
  {
    key: "guide",
    label: "Guides",
    blurb: "How-to material: writing issues, submitting work, using the tooling.",
  },
  {
    key: "regulation",
    label: "Regulations",
    blurb: "Official rules: deadlines, attendance, academic integrity.",
  },
] as const;

export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number]["key"];

export type DocumentView = {
  id: number;
  title: string;
  category: DocumentCategory;
  description: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedByName: string;
  createdAt: string;
};

export type DocumentFile = {
  id: number;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  storedName: string;
  filePath: string;
};

export type UploadInput = {
  title: string;
  category: string;
  description?: string;
  file: File;
  uploader: Student;
};

export type MetadataInput = {
  title?: string;
  category?: string;
  description?: string;
};

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/x-markdown",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
] as const;

/** Value for the file input's `accept` attribute, mirroring the allow-list. */
export const UPLOAD_ACCEPT = [
  ...ALLOWED_MIME_TYPES,
  ".pdf",
  ".txt",
  ".md",
  ".markdown",
  ".doc",
  ".docx",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
].join(",");

export const MAX_TITLE_LENGTH = 200;
export const MAX_DESCRIPTION_LENGTH = 1000;

/**
 * Browsers leave the type blank (or fall back to octet-stream) for extensions
 * they do not recognise, Markdown being the common case here, so the extension
 * decides the type whenever the browser did not commit to one.
 */
const EXTENSION_MIME_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  txt: "text/plain",
  md: "text/markdown",
  markdown: "text/markdown",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
};

const UNKNOWN_MIME_TYPES = new Set(["", "application/octet-stream", "binary/octet-stream"]);

export const DEFAULT_MIME_TYPE = "application/octet-stream";

export class DocumentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DocumentValidationError";
  }
}

export function isDocumentCategory(value: unknown): value is DocumentCategory {
  return (
    typeof value === "string" &&
    DOCUMENT_CATEGORIES.some((category) => category.key === value)
  );
}

export function categoryLabel(category: DocumentCategory): string {
  return DOCUMENT_CATEGORIES.find((entry) => entry.key === category)?.label ?? category;
}

/**
 * Reduces a client-supplied filename to a harmless extension: the on-disk name
 * is generated separately, so this only ever decorates it.
 */
export function sanitizeExtension(filename: string): string {
  if (typeof filename !== "string") return "";
  const base = filename.split(/[\\/]/).pop() ?? "";
  const dot = base.lastIndexOf(".");
  if (dot <= 0 || dot === base.length - 1) return "";
  return base
    .slice(dot + 1)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 8);
}

export function resolveMimeType(declaredType: string, filename: string): string {
  const declared = declaredType.split(";")[0].trim().toLowerCase();
  if (!UNKNOWN_MIME_TYPES.has(declared)) return declared;
  return EXTENSION_MIME_TYPES[sanitizeExtension(filename)] ?? declared;
}

export function isAllowedMimeType(mimeType: string): boolean {
  return (ALLOWED_MIME_TYPES as readonly string[]).includes(mimeType);
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  if (unit === 0) return `${Math.round(value)} B`;
  const rounded = Math.round(value * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)} ${units[unit]}`;
}

export function allowedTypesSummary(): string {
  return "PDF, text, Markdown, Word documents, and images";
}

/**
 * Pure validation shared by the upload route and `saveDocument`. Returns the
 * message to show the uploader, or null when the upload is acceptable.
 */
export function validateUpload(input: {
  title: string;
  category: string;
  description?: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
}): string | null {
  const title = input.title.trim();
  if (title.length === 0) return "A title is required";
  if (title.length > MAX_TITLE_LENGTH) {
    return `The title must be at most ${MAX_TITLE_LENGTH} characters`;
  }
  if ((input.description ?? "").length > MAX_DESCRIPTION_LENGTH) {
    return `The description must be at most ${MAX_DESCRIPTION_LENGTH} characters`;
  }
  if (!isDocumentCategory(input.category)) {
    return `Pick one of: ${DOCUMENT_CATEGORIES.map((entry) => entry.label).join(", ")}`;
  }
  if (input.filename.trim().length === 0) return "A file is required";
  if (input.sizeBytes <= 0) return "The file is empty";
  if (input.sizeBytes > MAX_UPLOAD_BYTES) {
    return `The file is larger than the ${formatFileSize(MAX_UPLOAD_BYTES)} limit`;
  }
  if (!isAllowedMimeType(resolveMimeType(input.mimeType, input.filename))) {
    return `That file type is not allowed. Upload ${allowedTypesSummary()}`;
  }
  return null;
}

export function validateMetadata(input: MetadataInput): string | null {
  if (input.title !== undefined) {
    const title = input.title.trim();
    if (title.length === 0) return "A title is required";
    if (title.length > MAX_TITLE_LENGTH) {
      return `The title must be at most ${MAX_TITLE_LENGTH} characters`;
    }
  }
  if (input.description !== undefined && input.description.length > MAX_DESCRIPTION_LENGTH) {
    return `The description must be at most ${MAX_DESCRIPTION_LENGTH} characters`;
  }
  if (input.category !== undefined && !isDocumentCategory(input.category)) {
    return `Pick one of: ${DOCUMENT_CATEGORIES.map((entry) => entry.label).join(", ")}`;
  }
  return null;
}

/**
 * Builds the `Content-Disposition` value: quotes, backslashes and control
 * characters would let a filename break out of the header.
 */
export function contentDispositionFilename(originalName: string): string {
  const base = (originalName ?? "").split(/[\\/]/).pop() ?? "";
  // eslint-disable-next-line no-control-regex
  const ascii = base.replace(/[\u0000-\u001f\u007f"\\]/g, "").trim();
  return ascii.length > 0 ? ascii.slice(0, 200) : "document";
}

export function contentDispositionHeader(originalName: string): string {
  const filename = contentDispositionFilename(originalName);
  return `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

export function uploadsDirectory(): string {
  return path.join(process.cwd(), "uploads");
}

export function documentFilePath(storedName: string): string {
  return path.join(uploadsDirectory(), path.basename(storedName));
}

type DocumentRow = {
  id: number;
  title: string;
  category: string;
  description: string;
  originalName: string;
  storedName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedByName: string;
  createdAt: Date;
};

function toView(row: DocumentRow): DocumentView {
  return {
    id: row.id,
    title: row.title,
    category: isDocumentCategory(row.category) ? row.category : "guide",
    description: row.description,
    originalName: row.originalName,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    uploadedByName: row.uploadedByName,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listDocuments(): Promise<DocumentView[]> {
  const rows = await prisma.document.findMany({ orderBy: { createdAt: "desc" } });
  return rows.map(toView);
}

export async function getDocument(id: number): Promise<DocumentView | null> {
  if (!Number.isInteger(id)) return null;
  const row = await prisma.document.findUnique({ where: { id } });
  return row ? toView(row) : null;
}

export async function getDocumentFile(id: number): Promise<DocumentFile | null> {
  if (!Number.isInteger(id)) return null;
  const row = await prisma.document.findUnique({ where: { id } });
  if (!row) return null;
  return {
    id: row.id,
    originalName: row.originalName,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    storedName: row.storedName,
    filePath: documentFilePath(row.storedName),
  };
}

export async function documentFileExists(filePath: string): Promise<boolean> {
  try {
    const stats = await stat(filePath);
    return stats.isFile();
  } catch {
    return false;
  }
}

export async function saveDocument(input: UploadInput): Promise<DocumentView> {
  const description = (input.description ?? "").trim();
  const mimeType = resolveMimeType(input.file.type ?? "", input.file.name ?? "");
  const problem = validateUpload({
    title: input.title,
    category: input.category,
    description,
    filename: input.file.name ?? "",
    mimeType: input.file.type ?? "",
    sizeBytes: input.file.size,
  });
  if (problem) throw new DocumentValidationError(problem);

  const bytes = Buffer.from(await input.file.arrayBuffer());
  // The declared size is client-controlled, so the limit is re-checked on the bytes.
  if (bytes.byteLength > MAX_UPLOAD_BYTES) {
    throw new DocumentValidationError(
      `The file is larger than the ${formatFileSize(MAX_UPLOAD_BYTES)} limit`,
    );
  }

  const extension = sanitizeExtension(input.file.name ?? "");
  const storedName = `${randomUUID()}${extension ? `.${extension}` : ""}`;

  await mkdir(uploadsDirectory(), { recursive: true });
  await writeFile(documentFilePath(storedName), bytes);

  try {
    const row = await prisma.document.create({
      data: {
        title: input.title.trim(),
        category: input.category,
        description,
        originalName: contentDispositionFilename(input.file.name ?? ""),
        storedName,
        mimeType: mimeType || DEFAULT_MIME_TYPE,
        sizeBytes: bytes.byteLength,
        uploadedByUserId: input.uploader.gitlabUserId,
        uploadedByName: input.uploader.name,
      },
    });
    return toView(row);
  } catch (cause) {
    await unlink(documentFilePath(storedName)).catch(() => undefined);
    throw cause;
  }
}

export async function updateDocument(
  id: number,
  input: MetadataInput,
): Promise<DocumentView | null> {
  if (!Number.isInteger(id)) return null;
  const problem = validateMetadata(input);
  if (problem) throw new DocumentValidationError(problem);

  const existing = await prisma.document.findUnique({ where: { id } });
  if (!existing) return null;

  const row = await prisma.document.update({
    where: { id },
    data: {
      ...(input.title !== undefined ? { title: input.title.trim() } : {}),
      ...(input.category !== undefined ? { category: input.category } : {}),
      ...(input.description !== undefined ? { description: input.description.trim() } : {}),
    },
  });
  return toView(row);
}

export async function deleteDocument(id: number): Promise<void> {
  const row = await prisma.document.findUnique({ where: { id } });
  if (!row) return;
  await prisma.document.delete({ where: { id } });
  await unlink(documentFilePath(row.storedName)).catch(() => undefined);
}

export function groupByCategory(
  documents: DocumentView[],
): Array<{ key: DocumentCategory; label: string; blurb: string; documents: DocumentView[] }> {
  return DOCUMENT_CATEGORIES.map((category) => ({
    key: category.key,
    label: category.label,
    blurb: category.blurb,
    documents: documents.filter((document) => document.category === category.key),
  }));
}
