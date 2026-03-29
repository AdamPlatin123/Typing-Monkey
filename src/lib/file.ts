import { ARCHIVE_FORMAT, DOCUMENT_SOURCE, type ArchiveFormat, type DocumentSourceType } from "@/lib/domain";

const EXTENSION_TO_SOURCE: Record<string, DocumentSourceType> = {
  ".pdf": DOCUMENT_SOURCE.PDF,
  ".docx": DOCUMENT_SOURCE.DOCX,
  ".pptx": DOCUMENT_SOURCE.PPTX,
  ".ppt": DOCUMENT_SOURCE.PPT,
  ".md": DOCUMENT_SOURCE.MD,
  ".markdown": DOCUMENT_SOURCE.MD,
  ".txt": DOCUMENT_SOURCE.TXT,
};

const ARCHIVE_EXTENSION_TO_FORMAT: Record<string, ArchiveFormat> = {
  ".zip": ARCHIVE_FORMAT.ZIP,
  ".7z": ARCHIVE_FORMAT.SEVEN_Z,
  ".rar": ARCHIVE_FORMAT.RAR,
};

export function sourceTypeFromFileName(fileName: string): DocumentSourceType {
  const normalized = fileName.toLowerCase();
  const match = Object.entries(EXTENSION_TO_SOURCE).find(([ext]) => normalized.endsWith(ext));

  if (!match) {
    throw new Error("UNSUPPORTED_FILE_TYPE");
  }

  return match[1];
}

export function detectArchiveFormat(fileName: string): ArchiveFormat {
  const normalized = fileName.toLowerCase();
  const match = Object.entries(ARCHIVE_EXTENSION_TO_FORMAT).find(([ext]) => normalized.endsWith(ext));
  return match?.[1] ?? ARCHIVE_FORMAT.UNKNOWN;
}

export function isSupportedDocumentFile(fileName: string) {
  try {
    sourceTypeFromFileName(fileName);
    return true;
  } catch {
    return false;
  }
}

export function sanitizeFileName(fileName: string) {
  return fileName
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .toLowerCase();
}

export function inferMimeType(sourceType: DocumentSourceType) {
  switch (sourceType) {
    case DOCUMENT_SOURCE.PDF:
      return "application/pdf";
    case DOCUMENT_SOURCE.DOCX:
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case DOCUMENT_SOURCE.PPTX:
      return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    case DOCUMENT_SOURCE.PPT:
      return "application/vnd.ms-powerpoint";
    case DOCUMENT_SOURCE.MD:
      return "text/markdown";
    case DOCUMENT_SOURCE.TXT:
      return "text/plain";
    default:
      return "application/octet-stream";
  }
}

export function removeFileExtension(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "");
}

export function normalizePathToUnix(input: string) {
  return input.replace(/\\/g, "/");
}

export function sanitizeRelativePath(input: string) {
  const unix = normalizePathToUnix(input).replace(/^\/+/, "");
  const segments = unix.split("/").filter((v) => v.length > 0 && v !== ".");
  const out: string[] = [];

  for (const part of segments) {
    if (part === "..") {
      throw new Error("INVALID_RELATIVE_PATH");
    }
    out.push(part);
  }

  return out.join("/");
}

const IMAGE_EXTENSION_TO_MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".bmp": "image/bmp",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".tiff": "image/tiff",
  ".tif": "image/tiff",
  ".emf": "image/x-emf",
  ".wmf": "image/x-wmf",
};

const MIME_TO_IMAGE_EXTENSION: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/bmp": "bmp",
  "image/svg+xml": "svg",
  "image/webp": "webp",
  "image/tiff": "tiff",
  "image/x-emf": "emf",
  "image/x-wmf": "wmf",
};

export function getImageMimeType(fileName: string): string | undefined {
  const lower = fileName.toLowerCase();
  const ext = Object.keys(IMAGE_EXTENSION_TO_MIME).find((candidate) => lower.endsWith(candidate));
  return ext ? IMAGE_EXTENSION_TO_MIME[ext] : undefined;
}

export function getImageExtension(mimeType: string): string {
  return MIME_TO_IMAGE_EXTENSION[mimeType] ?? "bin";
}
