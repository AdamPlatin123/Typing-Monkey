import { NextResponse } from "next/server";

import { setSessionCookie } from "@/lib/auth/cookies";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { badRequest, toErrorResponse, unauthorized } from "@/lib/http/errors";
import { parseJsonBody } from "@/lib/http/json";
import { loginSchema } from "@/lib/types/api";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    if (env.SINGLE_USER_MODE) {
      throw badRequest(
        "DISABLED_IN_SINGLE_USER_MODE",
        "Auth login is disabled when SINGLE_USER_MODE=true",
      );
    }

    const input = await parseJsonBody(request, loginSchema);

    const user = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
    if (!user) {
      throw unauthorized("Invalid credentials");
    }

    const valid = await verifyPassword(input.password, user.passwordHash);
    if (!valid) {
      throw unauthorized("Invalid credentials");
    }

    const session = await createSession(user.id);
    const response = NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
      },
    });

    setSessionCookie(response, session.token, session.expiresAt);
    return response;
  } catch (error) {
    return toErrorResponse(error);
  }
}
