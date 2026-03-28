import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { env } from "@/lib/env";

const globalForS3 = globalThis as unknown as { s3: S3Client | undefined };

export const s3Client =
  globalForS3.s3 ??
  new S3Client({
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION,
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    },
  });

if (process.env.NODE_ENV !== "production") {
  globalForS3.s3 = s3Client;
}

export async function getSignedUploadUrl(params: {
  key: string;
  contentType: string;
  contentLength?: number;
}) {
  const command = new PutObjectCommand({
    Bucket: env.S3_BUCKET,
    Key: params.key,
    ContentType: params.contentType,
    ContentLength: params.contentLength,
  });

  return getSignedUrl(s3Client, command, {
    expiresIn: env.UPLOAD_URL_EXPIRES_SECONDS,
  });
}

export async function getSignedDownloadUrl(key: string) {
  const command = new GetObjectCommand({
    Bucket: env.S3_BUCKET,
    Key: key,
  });

  return getSignedUrl(s3Client, command, {
    expiresIn: env.DOWNLOAD_URL_EXPIRES_SECONDS,
  });
}

export function getObjectCommand(key: string) {
  return new GetObjectCommand({
    Bucket: env.S3_BUCKET,
    Key: key,
  });
}

export function putObjectCommand(params: {
  key: string;
  contentType: string;
  body: Buffer;
}) {
  return new PutObjectCommand({
    Bucket: env.S3_BUCKET,
    Key: params.key,
    ContentType: params.contentType,
    Body: params.body,
  });
}
