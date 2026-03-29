import { NextResponse } from "next/server";

import { requireBatchAccess } from "@/lib/auth/access";
import { toErrorResponse } from "@/lib/http/errors";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ batchId: string }> }) {
  try {
    const { batchId } = await context.params;
    const { batch } = await requireBatchAccess(batchId);

    return NextResponse.json({
      data: {
        id: batch.id,
        kind: batch.kind,
        archiveFormat: batch.archiveFormat,
        status: batch.status,
        totalCount: batch.totalCount,
        successCount: batch.successCount,
        failedCount: batch.failedCount,
        skippedCount: batch.skippedCount,
        startedAt: batch.startedAt,
        finishedAt: batch.finishedAt,
        createdAt: batch.createdAt,
        updatedAt: batch.updatedAt,
      },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
