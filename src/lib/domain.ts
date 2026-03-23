export const DOCUMENT_SOURCE = {
  PDF: "PDF",
  DOCX: "DOCX",
  PPTX: "PPTX",
  PPT: "PPT",
  MD: "MD",
  TXT: "TXT",
} as const;

export type DocumentSourceType =
  (typeof DOCUMENT_SOURCE)[keyof typeof DOCUMENT_SOURCE];

export const DOCUMENT_STATUS = {
  QUEUED: "QUEUED",
  PROCESSING: "PROCESSING",
  READY: "READY",
  FAILED: "FAILED",
} as const;

export type DocumentStatus =
  (typeof DOCUMENT_STATUS)[keyof typeof DOCUMENT_STATUS];

export const INGEST_STATUS = {
  QUEUED: "QUEUED",
  PROCESSING: "PROCESSING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
} as const;

export type IngestStatus = (typeof INGEST_STATUS)[keyof typeof INGEST_STATUS];

export const BLOCK_TYPE = {
  HEADING: "HEADING",
  PARAGRAPH: "PARAGRAPH",
  LIST_ITEM: "LIST_ITEM",
  CODE: "CODE",
  QUOTE: "QUOTE",
  IMAGE: "IMAGE",
  HR: "HR",
} as const;

export type BlockType = (typeof BLOCK_TYPE)[keyof typeof BLOCK_TYPE];

export const ASSET_KIND = {
  IMAGE: "IMAGE",
} as const;

export type AssetKind = (typeof ASSET_KIND)[keyof typeof ASSET_KIND];

export const IMPORT_KIND = {
  SINGLE: "SINGLE",
  FOLDER: "FOLDER",
  ARCHIVE: "ARCHIVE",
} as const;

export type ImportKind = (typeof IMPORT_KIND)[keyof typeof IMPORT_KIND];

export const ARCHIVE_FORMAT = {
  ZIP: "ZIP",
  SEVEN_Z: "SEVEN_Z",
  RAR: "RAR",
  UNKNOWN: "UNKNOWN",
} as const;

export type ArchiveFormat = (typeof ARCHIVE_FORMAT)[keyof typeof ARCHIVE_FORMAT];

export const IMPORT_BATCH_STATUS = {
  QUEUED: "QUEUED",
  PROCESSING: "PROCESSING",
  PARTIAL_SUCCESS: "PARTIAL_SUCCESS",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
} as const;

export type ImportBatchStatus =
  (typeof IMPORT_BATCH_STATUS)[keyof typeof IMPORT_BATCH_STATUS];
