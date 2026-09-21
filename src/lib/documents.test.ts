import { describe, expect, it } from "vitest";
import {
  ALLOWED_MIME_TYPES,
  DOCUMENT_CATEGORIES,
  MAX_UPLOAD_BYTES,
  categoryLabel,
  contentDispositionFilename,
  formatFileSize,
  isAllowedMimeType,
  isDocumentCategory,
  resolveMimeType,
  sanitizeExtension,
  validateMetadata,
  validateUpload,
} from "@/lib/documents";

const KB = 1024;
const MB = 1024 * 1024;

describe("formatFileSize", () => {
  it("reports whole bytes below a kilobyte", () => {
    expect(formatFileSize(0)).toBe("0 B");
    expect(formatFileSize(1)).toBe("1 B");
    expect(formatFileSize(512)).toBe("512 B");
    expect(formatFileSize(1023)).toBe("1023 B");
  });

  it("switches unit at each 1024 boundary", () => {
    expect(formatFileSize(KB)).toBe("1 KB");
    expect(formatFileSize(1536)).toBe("1.5 KB");
    expect(formatFileSize(MB - 1)).toBe("1024 KB");
    expect(formatFileSize(MB)).toBe("1 MB");
    expect(formatFileSize(Math.round(1.2 * MB))).toBe("1.2 MB");
    expect(formatFileSize(10 * MB)).toBe("10 MB");
    expect(formatFileSize(1024 * MB)).toBe("1 GB");
  });

  it("falls back to zero for nonsense input", () => {
    expect(formatFileSize(-5)).toBe("0 B");
    expect(formatFileSize(Number.NaN)).toBe("0 B");
    expect(formatFileSize(Number.POSITIVE_INFINITY)).toBe("0 B");
  });
});

describe("sanitizeExtension", () => {
  it("lowercases the extension", () => {
    expect(sanitizeExtension("REPORT.PDF")).toBe("pdf");
    expect(sanitizeExtension("Syllabus.DocX")).toBe("docx");
  });

  it("keeps only the last extension of a double extension", () => {
    expect(sanitizeExtension("report.pdf.exe")).toBe("exe");
    expect(sanitizeExtension("archive.tar.gz")).toBe("gz");
  });

  it("returns nothing for a path traversal attempt", () => {
    expect(sanitizeExtension("../../etc/passwd")).toBe("");
    expect(sanitizeExtension("..\\..\\windows\\system32\\config")).toBe("");
    expect(sanitizeExtension("/etc/passwd")).toBe("");
    expect(sanitizeExtension("..")).toBe("");
  });

  it("strips characters that are not alphanumeric", () => {
    expect(sanitizeExtension("plan.p df")).toBe("pdf");
    expect(sanitizeExtension("plan.pdf?query=1")).toBe("pdfquery");
    expect(sanitizeExtension("plan.pd/f")).toBe("");
  });

  it("returns an empty string when there is no usable extension", () => {
    expect(sanitizeExtension("")).toBe("");
    expect(sanitizeExtension("noextension")).toBe("");
    expect(sanitizeExtension(".hidden")).toBe("");
    expect(sanitizeExtension("trailing.")).toBe("");
  });

  it("caps the extension length", () => {
    expect(sanitizeExtension("weird.averyverylongextension")).toBe("averyver");
    expect(sanitizeExtension("weird.averyverylongextension").length).toBeLessThanOrEqual(8);
  });
});

describe("isDocumentCategory", () => {
  it("accepts the four category keys", () => {
    expect(isDocumentCategory("plan")).toBe(true);
    expect(isDocumentCategory("syllabus")).toBe(true);
    expect(isDocumentCategory("guide")).toBe(true);
    expect(isDocumentCategory("regulation")).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isDocumentCategory("Plan")).toBe(false);
    expect(isDocumentCategory("plans")).toBe(false);
    expect(isDocumentCategory("")).toBe(false);
    expect(isDocumentCategory(null)).toBe(false);
    expect(isDocumentCategory(undefined)).toBe(false);
    expect(isDocumentCategory(1)).toBe(false);
    expect(isDocumentCategory(["plan"])).toBe(false);
  });

  it("labels every declared category", () => {
    expect(DOCUMENT_CATEGORIES.map((category) => category.key)).toEqual([
      "plan",
      "syllabus",
      "guide",
      "regulation",
    ]);
    expect(categoryLabel("plan")).toBe("Project plan");
    expect(categoryLabel("syllabus")).toBe("Syllabus");
    expect(categoryLabel("guide")).toBe("Guides");
    expect(categoryLabel("regulation")).toBe("Regulations");
  });
});

describe("resolveMimeType", () => {
  it("trusts a type the browser declared", () => {
    expect(resolveMimeType("application/pdf", "plan.pdf")).toBe("application/pdf");
    expect(resolveMimeType("text/plain; charset=utf-8", "notes.txt")).toBe("text/plain");
  });

  it("falls back to the extension when the browser did not recognise the file", () => {
    expect(resolveMimeType("", "guide.md")).toBe("text/markdown");
    expect(resolveMimeType("application/octet-stream", "guide.MD")).toBe("text/markdown");
    expect(resolveMimeType("", "rules.docx")).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
  });

  it("leaves an unknown extension unresolved", () => {
    expect(resolveMimeType("", "malware.exe")).toBe("");
    expect(isAllowedMimeType(resolveMimeType("", "malware.exe"))).toBe(false);
  });
});

describe("validateUpload", () => {
  const valid = {
    title: "Project plan 2026",
    category: "plan",
    description: "The official plan",
    filename: "plan.pdf",
    mimeType: "application/pdf",
    sizeBytes: 2 * MB,
  };

  it("accepts a well formed upload", () => {
    expect(validateUpload(valid)).toBeNull();
  });

  it("accepts every allowed type", () => {
    for (const mimeType of ALLOWED_MIME_TYPES) {
      expect(validateUpload({ ...valid, mimeType, filename: "file.bin" })).toBeNull();
    }
  });

  it("rejects a disallowed type", () => {
    expect(validateUpload({ ...valid, mimeType: "application/x-msdownload" })).toMatch(
      /not allowed/i,
    );
    expect(
      validateUpload({ ...valid, mimeType: "application/zip", filename: "plan.zip" }),
    ).toMatch(/not allowed/i);
  });

  it("rejects a disguised executable whose declared type is unknown", () => {
    expect(
      validateUpload({ ...valid, mimeType: "", filename: "report.pdf.exe" }),
    ).toMatch(/not allowed/i);
  });

  it("rejects a file over the size limit", () => {
    expect(validateUpload({ ...valid, sizeBytes: MAX_UPLOAD_BYTES + 1 })).toMatch(/larger than/i);
    expect(validateUpload({ ...valid, sizeBytes: MAX_UPLOAD_BYTES })).toBeNull();
  });

  it("rejects an empty file", () => {
    expect(validateUpload({ ...valid, sizeBytes: 0 })).toMatch(/empty/i);
  });

  it("rejects a missing title", () => {
    expect(validateUpload({ ...valid, title: "   " })).toMatch(/title/i);
    expect(validateUpload({ ...valid, title: "x".repeat(201) })).toMatch(/at most/i);
  });

  it("rejects an unknown category", () => {
    expect(validateUpload({ ...valid, category: "misc" })).toMatch(/Project plan/);
  });

  it("rejects a missing filename", () => {
    expect(validateUpload({ ...valid, filename: "" })).toMatch(/file is required/i);
  });

  it("rejects an overlong description", () => {
    expect(validateUpload({ ...valid, description: "x".repeat(1001) })).toMatch(/description/i);
  });
});

describe("validateMetadata", () => {
  it("accepts a partial update", () => {
    expect(validateMetadata({})).toBeNull();
    expect(validateMetadata({ title: "New title" })).toBeNull();
    expect(validateMetadata({ category: "regulation" })).toBeNull();
    expect(validateMetadata({ description: "" })).toBeNull();
  });

  it("rejects an empty title or an unknown category", () => {
    expect(validateMetadata({ title: " " })).toMatch(/title/i);
    expect(validateMetadata({ category: "other" })).toMatch(/Project plan/);
  });
});

describe("contentDispositionFilename", () => {
  it("keeps a normal filename", () => {
    expect(contentDispositionFilename("Course syllabus.pdf")).toBe("Course syllabus.pdf");
  });

  it("drops quotes, backslashes, control characters and directories", () => {
    expect(contentDispositionFilename('evil".pdf')).toBe("evil.pdf");
    expect(contentDispositionFilename("a\r\nContent-Length: 0\r\n\r\n.pdf")).toBe(
      "aContent-Length: 0.pdf",
    );
    expect(contentDispositionFilename("../../etc/passwd")).toBe("passwd");
    expect(contentDispositionFilename("C:\\temp\\plan.pdf")).toBe("plan.pdf");
  });

  it("falls back when nothing usable is left", () => {
    expect(contentDispositionFilename("")).toBe("document");
    expect(contentDispositionFilename('"""')).toBe("document");
  });
});
