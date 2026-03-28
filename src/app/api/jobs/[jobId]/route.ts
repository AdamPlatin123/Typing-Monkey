import { NextResponse } from "next/server";

import { resolveActiveUser } from "@/lib/auth/active-user";
import { prisma } from "@/lib/db";
import { notFound, toErrorResponse } from "@/lib/http/errors";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ jobId: string }> }) {
  try {
    const user = await resolveActiveUser();
    const { jobId } = await context.params;

    const job = await prisma.ingestJob.findFirst({
      where: {
        id: jobId,
        document: {
          ownerId: user.id,
        },
      },
      select: {
        id: true,
        status: true,
        errorCode: true,
        errorText: true,
        retryCount: true,
        startedAt: true,
        finishedAt: true,
        createdAt: true,
        updatedAt: true,
        documentId: true,
      },
    });

    if (!job) {
      throw notFound("Job not found");
    }

    return NextResponse.json({ data: job });
  } catch (error) {
    return toErrorResponse(error);
  }
}

