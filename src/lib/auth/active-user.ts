import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { requireCurrentUser } from "@/lib/auth/session";

let _cachedUser: { id: string; email: string; displayName: string | null } | null = null;
let _cachedAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function resolveActiveUser() {
  if (!env.SINGLE_USER_MODE) {
    return requireCurrentUser();
  }

  if (_cachedUser && Date.now() - _cachedAt < CACHE_TTL_MS) {
    return _cachedUser;
  }

  const user = await prisma.user.upsert({
    where: {
      email: env.SINGLE_USER_EMAIL.toLowerCase(),
    },
    update: {
      displayName: env.SINGLE_USER_NAME,
    },
    create: {
      email: env.SINGLE_USER_EMAIL.toLowerCase(),
      displayName: env.SINGLE_USER_NAME,
      passwordHash: "__single_user_mode__",
    },
  });

  _cachedUser = user;
  _cachedAt = Date.now();
  return user;
}
