import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { resolveActiveUser } from "@/lib/auth/active-user";
import { env } from "@/lib/env";
import { sanitizeFileName } from "@/lib/file";
import { payloadTooLarge, toErrorResponse } from "@/lib/http/errors";
import { parseJsonBody } from "@/lib/http/json";
import { getSignedUploadUrl } from "@/lib/storage";
import { importUploadUrlSchema } from "@/lib/types/api";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await resolveActiveUser();
    const input = await parseJsonBody(request, importUploadUrlSchema);

    const isBatch = input.importKind !== "single";
    const maxMb = isBatch ? env.MAX_ARCHIVE_SIZE_MB : env.MAX_FILE_SIZE_MB;
    const maxBytes = maxMb * 1024 * 1024;

    if (input.size > maxBytes) {
      throw payloadTooLarge(`File size exceeds ${maxMb}MB limit`);
    }

    const key = `imports/${user.id}/${Date.now()}-${randomUUID()}-${sanitizeFileName(input.fileName)}`;

    const uploadUrl = await getSignedUploadUrl({
      key,
      contentType: input.contentType,
      contentLength: input.size,
    });

    return NextResponse.json({
      uploadUrl,
      objectKey: key,
      maxBytes,
      importKind: input.importKind,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
