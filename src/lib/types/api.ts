// ── Re-export domain enum types for convenience ────────────────────
export type {
  DocumentSourceType,
  DocumentStatus,
  BlockType,
  ImportBatchStatus,
  IngestStatus,
  ImportKind,
} from "@/lib/domain";

// ── API response types ─────────────────────────────────────────────

import type {
  DocumentSourceType,
  DocumentStatus,
  BlockType,
  ImportBatchStatus,
  IngestStatus,
} from "@/lib/domain";

/** Document list item returned by GET /api/documents */
export type DocumentItem = {
  id: string;
  title: string;
  sourceType: DocumentSourceType;
  status: DocumentStatus;
  parserVersion: string;
  wordCount: number;
  createdAt: string;
  updatedAt: string;
};

/** Single content block returned by GET /api/documents/:id/blocks */
export type Block = {
  id: string;
  index: number;
  type: BlockType;
  text: string | null;
  level: number | null;
  attrs: Record<string, unknown> | null;
  image: {
    id: string;
    url: string;
    mimeType: string;
    width: number | null;
    height: number | null;
  } | null;
};

/** Response shape for GET /api/documents/:id/blocks (paginated) */
export type BlocksResponse = {
  data: Block[];
  nextCursor: number | null;
};

/** Response shape for GET /api/documents (paginated) */
export type DocumentsResponse = {
  data: DocumentItem[];
  nextCursor: string | null;
};

/** Document meta returned by GET /api/documents/:id */
export type DocumentMeta = {
  id: string;
  title: string;
  sourceType: DocumentSourceType;
  status: DocumentStatus;
  parserVersion: string;
  wordCount: number;
  createdAt: string;
  updatedAt: string;
};

/** Outline heading item from GET /api/documents/:id/outline */
export type OutlineItem = {
  id: string;
  index: number;
  text: string | null;
  level: number | null;
};

/** Search hit from GET /api/documents/:id/search */
export type SearchResult = {
  id: string;
  index: number;
  type: BlockType;
  snippet: string;
};

/** Progress payload from GET /api/documents/:id/progress */
export type ProgressPayload = {
  data: {
    lastBlockIndex: number;
    lastOffset: number;
    percent: number;
    updatedAt: string | null;
  };
};

/** Response from POST /api/documents/upload-url */
export type UploadUrlResponse = {
  uploadUrl: string;
  objectKey: string;
  sourceType: DocumentSourceType;
  maxBytes: number;
};

/** Response from POST /api/documents/ingest */
export type IngestResponse = {
  documentId: string;
  jobId: string;
  queueJobId: string;
};

/** Response from GET /api/jobs/:jobId */
export type JobStatusResponse = {
  data: {
    id: string;
    status: IngestStatus;
    errorCode: string | null;
    errorText: string | null;
  };
};

/** Single item inside an import batch */
export type ImportBatchItem = {
  id: string;
  documentId: string | null;
  status: ImportBatchStatus;
  fileName: string;
  errorCode: string | null;
};

/** Import batch from GET /api/imports/:batchId */
export type ImportBatch = {
  id: string;
  status: ImportBatchStatus;
  totalCount: number;
  successCount: number;
  failedCount: number;
  skippedCount: number;
};

/** Import mode used in API request bodies (lowercase) */
export type ApiImportMode = "single" | "folder" | "archive";

// ── Zod validation schemas ─────────────────────────────────────────

import { z } from "zod";

const importKindSchema = z.enum(["single", "folder", "archive"]);

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  displayName: z.string().min(1).max(120).optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

export const uploadUrlSchema = z.object({
  fileName: z.string().min(1).max(255),
  contentType: z.string().min(1).max(255),
  size: z.number().int().nonnegative(),
});

export const ingestSchema = z.object({
  objectKey: z.string().min(1),
  fileName: z.string().min(1).max(255),
});

export const importUploadUrlSchema = uploadUrlSchema.extend({
  importKind: importKindSchema,
});

export const importIngestSchema = z.object({
  objectKey: z.string().min(1),
  fileName: z.string().min(1).max(255),
  importKind: importKindSchema.refine((v) => v !== "single"),
  rootName: z.string().min(1).max(255).optional(),
});

export const progressSchema = z.object({
  lastBlockIndex: z.number().int().min(0),
  lastOffset: z.number().int().min(0).default(0),
  percent: z.number().min(0).max(100),
});
