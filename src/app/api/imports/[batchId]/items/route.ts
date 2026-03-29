import { NextResponse } from "next/server";

import { requireBatchExists } from "@/lib/auth/access";
import { prisma } from "@/lib/db";
import { toErrorResponse } from "@/lib/http/errors";

export const runtime = "nodejs";

const DEFAULT_LIMIT = 50;

export async function GET(request: Request, context: { params: Promise<{ batchId: string }> }) {
  try {
    const { batchId } = await context.params;
    const url = new URL(request.url);

    const cursor = url.searchParams.get("cursor");
    const requestedTake = Number(url.searchParams.get("take") ?? DEFAULT_LIMIT);
    const take = Number.isNaN(requestedTake) ? DEFAULT_LIMIT : Math.max(1, Math.min(requestedTake, 200));

    await requireBatchExists(batchId);

    const items = await prisma.importItem.findMany({
      where: {
        batchId,
      },
      orderBy: {
        createdAt: "asc",
      },
      take,
      ...(cursor
        ? {
            skip: 1,
            cursor: {
              id: cursor,
            },
          }
        : {}),
      select: {
        id: true,
        relativePath: true,
        sourceType: true,
        status: true,
        errorCode: true,
        errorText: true,
        documentId: true,
        ingestJobId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const nextCursor = items.length === take ? (items[items.length - 1]?.id ?? null) : null;

    return NextResponse.json({
      data: items,
      nextCursor,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
