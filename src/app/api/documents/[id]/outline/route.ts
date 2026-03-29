import { NextResponse } from "next/server";

import { requireDocumentExists } from "@/lib/auth/access";
import { BLOCK_TYPE } from "@/lib/domain";
import { prisma } from "@/lib/db";
import { toErrorResponse } from "@/lib/http/errors";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;

    await requireDocumentExists(id);

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

