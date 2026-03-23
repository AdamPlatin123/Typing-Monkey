import { NextResponse } from "next/server";

import { resolveActiveUser } from "@/lib/auth/active-user";
import { BLOCK_TYPE } from "@/lib/domain";
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
      },
    });

    if (!document) {
      throw notFound("Document not found");
    }

    const outline = await prisma.documentBlock.findMany({
      where: {
        documentId: id,
        type: BLOCK_TYPE.HEADING,
      },
      orderBy: {
        index: "asc",
      },
      select: {
        id: true,
        index: true,
        text: true,
        level: true,
      },
    });

    return NextResponse.json({ data: outline });
  } catch (error) {
    return toErrorResponse(error);
  }
}

