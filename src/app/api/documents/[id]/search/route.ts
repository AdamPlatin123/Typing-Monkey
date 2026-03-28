import { NextResponse } from "next/server";

import { resolveActiveUser } from "@/lib/auth/active-user";
import { prisma } from "@/lib/db";
import { badRequest, notFound, toErrorResponse } from "@/lib/http/errors";

export const runtime = "nodejs";

const DEFAULT_LIMIT = 30;

function snippet(text: string, query: string) {
  const lower = text.toLowerCase();
  const idx = lower.indexOf(query.toLowerCase());
  if (idx < 0) {
    return text.slice(0, 140);
  }

  const start = Math.max(0, idx - 40);
  const end = Math.min(text.length, idx + query.length + 80);
  return text.slice(start, end);
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await resolveActiveUser();
    const { id } = await context.params;
    const url = new URL(request.url);

    const q = (url.searchParams.get("q") ?? "").trim();
    if (!q) {
      throw badRequest("MISSING_QUERY", "Query parameter q is required");
    }

    const limitParam = Number(url.searchParams.get("limit") ?? DEFAULT_LIMIT);
    const limit = Number.isNaN(limitParam) ? DEFAULT_LIMIT : Math.max(1, Math.min(limitParam, 100));

    const exists = await prisma.documentMeta.findFirst({
      where: {
        id,
        ownerId: user.id,
      },
      select: { id: true },
    });

    if (!exists) {
      throw notFound("Document not found");
    }

    const matches = await prisma.documentBlock.findMany({
      where: {
        documentId: id,
        text: {
          contains: q,
        },
      },
      orderBy: {
        index: "asc",
      },
      take: limit,
      select: {
        id: true,
        index: true,
        text: true,
        type: true,
      },
    });

    return NextResponse.json({
      data: matches.map((item) => ({
        id: item.id,
        index: item.index,
        type: item.type,
        snippet: snippet(item.text ?? "", q),
      })),
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

