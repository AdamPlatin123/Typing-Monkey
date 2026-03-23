import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { requireCurrentUser } from "@/lib/auth/session";

export async function resolveActiveUser() {
  if (!env.SINGLE_USER_MODE) {
    return requireCurrentUser();
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

  return user;
}
