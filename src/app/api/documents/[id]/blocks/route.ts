import { NextResponse } from "next/server";

import { requireDocumentExists } from "@/lib/auth/access";
import { prisma } from "@/lib/db";
import { toErrorResponse } from "@/lib/http/errors";
import { getSignedDownloadUrl } from "@/lib/storage";

export const runtime = "nodejs";

const DEFAULT_LIMIT = 120;

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const url = new URL(request.url);

    await requireDocumentExists(id);

    const cursorParam = url.searchParams.get("cursor");
    const limitParam = Number(url.searchParams.get("limit") ?? DEFAULT_LIMIT);

    const limit = Number.isNaN(limitParam) ? DEFAULT_LIMIT : Math.max(1, Math.min(limitParam, 300));
    const cursor = cursorParam ? Number(cursorParam) : null;

    const blocks = await prisma.documentBlock.findMany({
      where: {
        documentId: id,
        ...(cursor !== null && Number.isFinite(cursor)
          ? {
              index: {
                gt: cursor,
              },
            }
          : {}),
      },
      orderBy: {
        index: "asc",
      },
      take: limit,
      select: {
        id: true,
        index: true,
        type: true,
        text: true,
        level: true,
        attrs: true,
      },
    });

    const blockIndices = blocks.map((block) => block.index);

    const assets =
      blockIndices.length > 0
        ? await prisma.documentAsset.findMany({
            where: {
              documentId: id,
              blockIndex: {
                in: blockIndices,
              },
            },
            select: {
              id: true,
              blockIndex: true,
              storageKey: true,
              mimeType: true,
              width: true,
              height: true,
            },
          })
        : [];

    const assetMap = new Map<number, (typeof assets)[number]>();
    for (const asset of assets) {
      assetMap.set(asset.blockIndex, asset);
    }

    const hydratedBlocks = await Promise.all(
      blocks.map(async (block) => {
        const asset = assetMap.get(block.index);
        if (!asset) {
          return {
            ...block,
            image: null,
          };
        }

        const signedUrl = await getSignedDownloadUrl(asset.storageKey);
        return {
          ...block,
          image: {
            id: asset.id,
            url: signedUrl,
            mimeType: asset.mimeType,
            width: asset.width,
            height: asset.height,
          },
        };
      }),
    );

    const nextCursor = hydratedBlocks.length === limit ? hydratedBlocks[hydratedBlocks.length - 1]?.index ?? null : null;

    return NextResponse.json({
      data: hydratedBlocks,
      nextCursor,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

