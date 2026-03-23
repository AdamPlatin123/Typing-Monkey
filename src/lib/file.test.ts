import { describe, expect, it } from "vitest";

import {
  detectArchiveFormat,
  sanitizeFileName,
  sanitizeRelativePath,
  sourceTypeFromFileName,
} from "@/lib/file";

describe("file helpers", () => {
  it("maps source types from extensions", () => {
    expect(sourceTypeFromFileName("a.PDF")).toBe("PDF");
    expect(sourceTypeFromFileName("a.docx")).toBe("DOCX");
    expect(sourceTypeFromFileName("a.pptx")).toBe("PPTX");
    expect(sourceTypeFromFileName("a.ppt")).toBe("PPT");
    expect(sourceTypeFromFileName("a.md")).toBe("MD");
    expect(sourceTypeFromFileName("a.txt")).toBe("TXT");
  });

  it("detects archive formats", () => {
    expect(detectArchiveFormat("a.zip")).toBe("ZIP");
    expect(detectArchiveFormat("a.7z")).toBe("SEVEN_Z");
    expect(detectArchiveFormat("a.rar")).toBe("RAR");
    expect(detectArchiveFormat("a.tar")).toBe("UNKNOWN");
  });

  it("sanitizes names", () => {
    expect(sanitizeFileName("Exam Notes (Final).pdf")).toBe("exam-notes-final.pdf");
  });

  it("sanitizes relative path", () => {
    expect(sanitizeRelativePath("docs/guide.md")).toBe("docs/guide.md");
    expect(() => sanitizeRelativePath("docs/../README.md")).toThrow();
    expect(() => sanitizeRelativePath("../../secret.txt")).toThrow();
  });
});
