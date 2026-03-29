import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import { cookies } from "next/headers";

import { prisma } from "@/lib/db";
import { UnauthorizedError } from "@/lib/http/errors";

export const SESSION_COOKIE_NAME = "typingmonkey_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 14;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function createRawToken() {
  return randomBytes(32).toString("base64url");
}

export async function createSession(userId: string) {
  const token = createRawToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await prisma.session.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
    },
  });

  return { token, expiresAt };
}

export async function deleteSessionByRawToken(token: string) {
  const tokenHash = hashToken(token);
  await prisma.session.deleteMany({ where: { tokenHash } });
}

export async function getUserFromRawSessionToken(rawToken: string) {
  const tokenHash = hashToken(rawToken);
  const session = await prisma.session.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!session) {
    return null;
  }

  if (session.expiresAt <= new Date()) {
    await prisma.session.delete({ where: { id: session.id } });
    return null;
  }

  return session.user;
}

export async function getCurrentUser() {
  const store = await cookies();
  const rawToken = store.get(SESSION_COOKIE_NAME)?.value;
  if (!rawToken) {
    return null;
  }

  return getUserFromRawSessionToken(rawToken);
}

export async function requireCurrentUser() {
  const user = await getCurrentUser();
  if (!user) {
    throw new UnauthorizedError();
  }

  return user;
}

export function safeTokenEquals(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(left, right);
}
