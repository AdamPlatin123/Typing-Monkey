import { NextResponse } from "next/server";

import { requireDocumentAccess } from "@/lib/auth/access";
import { toErrorResponse } from "@/lib/http/errors";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const { doc } = await requireDocumentAccess(id);

    return NextResponse.json({
      data: {
        id: doc.id,
        ownerId: doc.ownerId,
        title: doc.title,
        sourceType: doc.sourceType,
        status: doc.status,
        parserVersion: doc.parserVersion,
        wordCount: doc.wordCount,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
      },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

