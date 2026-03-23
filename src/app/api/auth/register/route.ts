import { NextResponse } from "next/server";

import { setSessionCookie } from "@/lib/auth/cookies";
import { hashPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { badRequest, conflict, toErrorResponse } from "@/lib/http/errors";
import { parseJsonBody } from "@/lib/http/json";
import { registerSchema } from "@/lib/types/api";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    if (env.SINGLE_USER_MODE) {
      throw badRequest(
        "DISABLED_IN_SINGLE_USER_MODE",
        "Auth register is disabled when SINGLE_USER_MODE=true",
      );
    }

    const input = await parseJsonBody(request, registerSchema);

    const existing = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
    if (existing) {
      throw conflict("Email already registered");
    }

    const user = await prisma.user.create({
      data: {
        email: input.email.toLowerCase(),
        passwordHash: await hashPassword(input.password),
        displayName: input.displayName,
      },
      select: {
        id: true,
        email: true,
        displayName: true,
        createdAt: true,
      },
    });

    const session = await createSession(user.id);

    const response = NextResponse.json({ user }, { status: 201 });
    setSessionCookie(response, session.token, session.expiresAt);
    return response;
  } catch (error) {
    return toErrorResponse(error);
  }
}
