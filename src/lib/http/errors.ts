import { NextResponse } from "next/server";

export class UnauthorizedError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function badRequest(code: string, message: string, details?: unknown) {
  return new ApiError(400, code, message, details);
}

export function unauthorized(message = "Unauthorized") {
  return new ApiError(401, "UNAUTHORIZED", message);
}

export function notFound(message = "Not found") {
  return new ApiError(404, "NOT_FOUND", message);
}

export function forbidden(message = "Forbidden") {
  return new ApiError(403, "FORBIDDEN", message);
}

export function conflict(message = "Conflict") {
  return new ApiError(409, "CONFLICT", message);
}

export function payloadTooLarge(message = "Payload too large") {
  return new ApiError(413, "PAYLOAD_TOO_LARGE", message);
}

export function toErrorResponse(error: unknown) {
  if (error instanceof ApiError) {
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      },
      { status: error.status },
    );
  }

  if (error instanceof UnauthorizedError) {
    return NextResponse.json(
      {
        error: {
          code: "UNAUTHORIZED",
          message: error.message,
        },
      },
      { status: 401 },
    );
  }

  if (error instanceof Error && error.message === "UNAUTHORIZED") {
    return NextResponse.json(
      {
        error: {
          code: "UNAUTHORIZED",
          message: "Unauthorized",
        },
      },
      { status: 401 },
    );
  }

  console.error(error);
  return NextResponse.json(
    {
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Unexpected error",
      },
    },
    { status: 500 },
  );
}
