import { NextResponse } from "next/server";

import { resolveActiveUser } from "@/lib/auth/active-user";
import { prisma } from "@/lib/db";
import { notFound, toErrorResponse } from "@/lib/http/errors";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await resolveActiveUser();
    const { id } = await context.params;

    const document = await prisma.documentMeta.findFirst({
      where: {
        id,
        ownerId: user.id,
      },
      select: {
        id: true,
        ownerId: true,
        title: true,
        sourceType: true,
        status: true,
        parserVersion: true,
        wordCount: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!document) {
      throw notFound("Document not found");
    }

    return NextResponse.json({ data: document });
  } catch (error) {
    return toErrorResponse(error);
  }
}

