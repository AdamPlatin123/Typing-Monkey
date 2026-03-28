import { ZodSchema } from "zod";

import { badRequest } from "@/lib/http/errors";

export async function parseJsonBody<T>(request: Request, schema: ZodSchema<T>) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    throw badRequest("INVALID_JSON", "Request body is not valid JSON");
  }

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw badRequest("VALIDATION_ERROR", "Invalid request body", parsed.error.flatten());
  }

  return parsed.data;
}
