import { NextResponse } from "next/server";

import { requireDocumentExists } from "@/lib/auth/access";
import { prisma } from "@/lib/db";
import { toErrorResponse } from "@/lib/http/errors";
import { parseJsonBody } from "@/lib/http/json";
import { progressSchema } from "@/lib/types/api";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const { user } = await requireDocumentExists(id);

    const progress = await prisma.readingProgress.findUnique({
      where: {
        userId_documentId: {
          userId: user.id,
          documentId: id,
        },
      },
      select: {
        lastBlockIndex: true,
        lastOffset: true,
        percent: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      data: progress ?? {
        lastBlockIndex: 0,
        lastOffset: 0,
        percent: 0,
        updatedAt: null,
      },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const { user } = await requireDocumentExists(id);

    const input = await parseJsonBody(request, progressSchema);

    const progress = await prisma.readingProgress.upsert({
      where: {
        userId_documentId: {
          userId: user.id,
          documentId: id,
        },
      },
      create: {
        userId: user.id,
        documentId: id,
        lastBlockIndex: input.lastBlockIndex,
        lastOffset: input.lastOffset,
        percent: input.percent,
      },
      update: {
        lastBlockIndex: input.lastBlockIndex,
        lastOffset: input.lastOffset,
        percent: input.percent,
      },
      select: {
        lastBlockIndex: true,
        lastOffset: true,
        percent: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ data: progress });
  } catch (error) {
    return toErrorResponse(error);
  }
}

