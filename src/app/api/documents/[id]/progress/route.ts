import { NextResponse } from "next/server";

import { resolveActiveUser } from "@/lib/auth/active-user";
import { prisma } from "@/lib/db";
import { notFound, toErrorResponse } from "@/lib/http/errors";
import { parseJsonBody } from "@/lib/http/json";
import { progressSchema } from "@/lib/types/api";

export const runtime = "nodejs";

async function ensureDocumentAccess(documentId: string, userId: string) {
  const document = await prisma.documentMeta.findFirst({
    where: {
      id: documentId,
      ownerId: userId,
    },
    select: { id: true },
  });

  if (!document) {
    throw notFound("Document not found");
  }
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await resolveActiveUser();
    const { id } = await context.params;

    await ensureDocumentAccess(id, user.id);

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
    const user = await resolveActiveUser();
    const { id } = await context.params;

    await ensureDocumentAccess(id, user.id);

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

