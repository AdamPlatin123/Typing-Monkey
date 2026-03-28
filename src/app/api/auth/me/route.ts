import { NextResponse } from "next/server";

import { resolveActiveUser } from "@/lib/auth/active-user";
import { env } from "@/lib/env";
import { getCurrentUser } from "@/lib/auth/session";
import { toErrorResponse } from "@/lib/http/errors";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = env.SINGLE_USER_MODE ? await resolveActiveUser() : await getCurrentUser();
    if (!user) {
      return NextResponse.json({ user: null });
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
      },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
