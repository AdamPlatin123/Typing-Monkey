import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { resolveActiveUser } from "@/lib/auth/active-user";
import { env } from "@/lib/env";
import { sanitizeFileName, sourceTypeFromFileName } from "@/lib/file";
import { payloadTooLarge, toErrorResponse } from "@/lib/http/errors";
import { parseJsonBody } from "@/lib/http/json";
import { getSignedUploadUrl } from "@/lib/storage";
import { uploadUrlSchema } from "@/lib/types/api";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await resolveActiveUser();
    const input = await parseJsonBody(request, uploadUrlSchema);

    const maxBytes = env.MAX_FILE_SIZE_MB * 1024 * 1024;
    if (input.size > maxBytes) {
      throw payloadTooLarge(`File size exceeds ${env.MAX_FILE_SIZE_MB}MB limit`);
    }

    const sourceType = sourceTypeFromFileName(input.fileName);
    const key = `uploads/${user.id}/${Date.now()}-${randomUUID()}-${sanitizeFileName(input.fileName)}`;

    const uploadUrl = await getSignedUploadUrl({
      key,
      contentType: input.contentType,
      contentLength: input.size,
    });

    return NextResponse.json({
      uploadUrl,
      objectKey: key,
      sourceType,
      maxBytes,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

