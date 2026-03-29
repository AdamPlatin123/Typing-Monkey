import { resolveActiveUser } from "@/lib/auth/active-user";
import { prisma } from "@/lib/db";
import { notFound } from "@/lib/http/errors";

/**
 * Verify the current user owns the given document and return both.
 * Throws NOT_FOUND if the document does not exist or belongs to another user.
 */
export async function requireDocumentAccess(documentId: string) {
  const user = await resolveActiveUser();
  const doc = await prisma.documentMeta.findFirst({
    where: { id: documentId, ownerId: user.id },
  });
  if (!doc) throw notFound("Document not found");
  return { user, doc };
}

/**
 * Verify the current user owns the given document (existence check only).
 * Returns the user and a lightweight document reference.
 * Throws NOT_FOUND if the document does not exist or belongs to another user.
 */
export async function requireDocumentExists(documentId: string) {
  const user = await resolveActiveUser();
  const doc = await prisma.documentMeta.findFirst({
    where: { id: documentId, ownerId: user.id },
    select: { id: true },
  });
  if (!doc) throw notFound("Document not found");
  return { user, doc };
}

/**
 * Verify the current user owns the given import batch and return both.
 * Throws NOT_FOUND if the batch does not exist or belongs to another user.
 */
export async function requireBatchAccess(batchId: string) {
  const user = await resolveActiveUser();
  const batch = await prisma.importBatch.findFirst({
    where: { id: batchId, ownerId: user.id },
  });
  if (!batch) throw notFound("Import batch not found");
  return { user, batch };
}

/**
 * Verify the current user owns the given import batch (existence check only).
 * Returns the user and a lightweight batch reference.
 * Throws NOT_FOUND if the batch does not exist or belongs to another user.
 */
export async function requireBatchExists(batchId: string) {
  const user = await resolveActiveUser();
  const batch = await prisma.importBatch.findFirst({
    where: { id: batchId, ownerId: user.id },
    select: { id: true },
  });
  if (!batch) throw notFound("Import batch not found");
  return { user, batch };
}
