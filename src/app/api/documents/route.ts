import { NextResponse } from "next/server";

import { resolveActiveUser } from "@/lib/auth/active-user";
import { prisma } from "@/lib/db";
import { toErrorResponse } from "@/lib/http/errors";

export const runtime = "nodejs";

const DEFAULT_TAKE = 20;

export async function GET(request: Request) {
  try {
    const user = await resolveActiveUser();
    const url = new URL(request.url);

    const cursor = url.searchParams.get("cursor");
    const requestedTake = Number(url.searchParams.get("take") ?? DEFAULT_TAKE);
    const take = Number.isNaN(requestedTake) ? DEFAULT_TAKE : Math.max(1, Math.min(requestedTake, 100));

    const documents = await prisma.documentMeta.findMany({
      where: {
        ownerId: user.id,
      },
      orderBy: {
        createdAt: "desc",
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
        title: true,
        sourceType: true,
        status: true,
        parserVersion: true,
        wordCount: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const nextCursor = documents.length === take ? (documents[documents.length - 1]?.id ?? null) : null;

    return NextResponse.json({
      data: documents,
      nextCursor,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

