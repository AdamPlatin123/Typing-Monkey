import { NextResponse } from "next/server";

import { resolveActiveUser } from "@/lib/auth/active-user";
import { prisma } from "@/lib/db";
import { notFound, toErrorResponse } from "@/lib/http/errors";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ batchId: string }> }) {
  try {
    const user = await resolveActiveUser();
    const { batchId } = await context.params;

    const batch = await prisma.importBatch.findFirst({
      where: {
        id: batchId,
        ownerId: user.id,
      },
      select: {
        id: true,
        kind: true,
        archiveFormat: true,
        status: true,
        totalCount: true,
        successCount: true,
        failedCount: true,
        skippedCount: true,
        startedAt: true,
        finishedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!batch) {
      throw notFound("Import batch not found");
    }

    return NextResponse.json({ data: batch });
  } catch (error) {
    return toErrorResponse(error);
  }
}
