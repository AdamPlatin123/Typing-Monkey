import { NextResponse } from "next/server";

import { resolveActiveUser } from "@/lib/auth/active-user";
import { ARCHIVE_FORMAT, IMPORT_BATCH_STATUS, IMPORT_KIND } from "@/lib/domain";
import { prisma } from "@/lib/db";
import { detectArchiveFormat } from "@/lib/file";
import { badRequest, toErrorResponse } from "@/lib/http/errors";
import { parseJsonBody } from "@/lib/http/json";
import { getIngestQueue } from "@/lib/queue";
import { importIngestSchema } from "@/lib/types/api";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await resolveActiveUser();
    const input = await parseJsonBody(request, importIngestSchema);

    const archiveFormat = detectArchiveFormat(input.fileName);
    if (archiveFormat === ARCHIVE_FORMAT.UNKNOWN) {
      throw badRequest("UNSUPPORTED_ARCHIVE_FORMAT", "Only zip/7z/rar archives are supported");
    }

    const batch = await prisma.importBatch.create({
      data: {
        ownerId: user.id,
        kind: input.importKind === "folder" ? IMPORT_KIND.FOLDER : IMPORT_KIND.ARCHIVE,
        archiveFormat,
        objectKey: input.objectKey,
        status: IMPORT_BATCH_STATUS.QUEUED,
      },
      select: {
        id: true,
      },
    });

    await getIngestQueue().add("batch-ingest", {
      kind: "BATCH",
      batchId: batch.id,
      objectKey: input.objectKey,
      fileName: input.fileName,
      ownerId: user.id,
      importKind: input.importKind === "folder" ? IMPORT_KIND.FOLDER : IMPORT_KIND.ARCHIVE,
      rootName: input.rootName,
    });

    return NextResponse.json(
      {
        batchId: batch.id,
        queuedCount: 1,
      },
      { status: 201 },
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
