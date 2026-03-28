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
