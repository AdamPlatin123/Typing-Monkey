import { NextResponse } from "next/server";

import { resolveActiveUser } from "@/lib/auth/active-user";
import { prisma } from "@/lib/db";
import { removeFileExtension, sourceTypeFromFileName } from "@/lib/file";
import { toErrorResponse } from "@/lib/http/errors";
import { parseJsonBody } from "@/lib/http/json";
import { getIngestQueue } from "@/lib/queue";
import { ingestSchema } from "@/lib/types/api";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await resolveActiveUser();
    const input = await parseJsonBody(request, ingestSchema);

    const sourceType = sourceTypeFromFileName(input.fileName);
    const title = removeFileExtension(input.fileName);

    const [document, ingestJob] = await prisma.$transaction(async (tx) => {
      const createdDocument = await tx.documentMeta.create({
        data: {
          ownerId: user.id,
          title,
          sourceType,
          objectKey: input.objectKey,
        },
      });

      const createdJob = await tx.ingestJob.create({
        data: {
          documentId: createdDocument.id,
        },
      });

      return [createdDocument, createdJob] as const;
    });

    const queueJob = await getIngestQueue().add("ingest", {
      kind: "SINGLE",
      documentId: document.id,
      ingestJobId: ingestJob.id,
      sourceType,
      objectKey: input.objectKey,
      ownerId: user.id,
      fileName: input.fileName,
    });

    return NextResponse.json(
      {
        documentId: document.id,
        jobId: ingestJob.id,
        queueJobId: queueJob.id,
      },
      { status: 201 },
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
