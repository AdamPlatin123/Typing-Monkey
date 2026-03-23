import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().url().default("redis://127.0.0.1:6379"),
  S3_ENDPOINT: z.string().url(),
  S3_REGION: z.string().default("us-east-1"),
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  S3_FORCE_PATH_STYLE: z
    .string()
    .optional()
    .transform((v) => v !== "false"),
  SESSION_SECRET: z.string().min(32),
  SINGLE_USER_MODE: z
    .string()
    .optional()
    .transform((v) => v !== "false"),
  SINGLE_USER_EMAIL: z.string().email().default("local@typingmonkey.local"),
  SINGLE_USER_NAME: z.string().min(1).default("Local User"),
  MAX_FILE_SIZE_MB: z.coerce.number().int().positive().default(50),
  MAX_ARCHIVE_SIZE_MB: z.coerce.number().int().positive().default(200),
  MAX_ARCHIVE_ENTRIES: z.coerce.number().int().positive().default(3000),
  MAX_EXTRACTED_TOTAL_MB: z.coerce.number().int().positive().default(1024),
  UPLOAD_URL_EXPIRES_SECONDS: z.coerce.number().int().positive().default(900),
  DOWNLOAD_URL_EXPIRES_SECONDS: z.coerce.number().int().positive().default(900),
  INGEST_QUEUE_NAME: z.string().default("document-ingest"),
  LIBREOFFICE_PATH: z.string().default("soffice"),
  SEVEN_ZIP_PATH: z.string().default("7z"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment variables");
}

export const env = parsed.data;
