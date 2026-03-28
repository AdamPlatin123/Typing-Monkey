import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { clearSessionCookie } from "@/lib/auth/cookies";
import { deleteSessionByRawToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { toErrorResponse } from "@/lib/http/errors";

export const runtime = "nodejs";

export async function POST() {
  try {
    if (env.SINGLE_USER_MODE) {
      return NextResponse.json({ ok: true, mode: "single-user" });
    }

    const store = await cookies();
    const rawToken = store.get(SESSION_COOKIE_NAME)?.value;
    if (rawToken) {
      await deleteSessionByRawToken(rawToken);
    }

    const response = NextResponse.json({ ok: true });
    clearSessionCookie(response);
    return response;
  } catch (error) {
    return toErrorResponse(error);
  }
}
