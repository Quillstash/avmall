import { NextResponse } from "next/server";
import { AppError } from "./errors";

/** Standard success envelope. */
export function apiSuccess<T>(data: T, meta?: Record<string, unknown>) {
  return meta ? { data, meta } : { data };
}

/**
 * Maps thrown errors to the standard API error shape. Use at the top of every
 * route handler's catch block — see CLAUDE.md §7.
 */
export function handleApiError(err: unknown): NextResponse {
  if (err instanceof AppError) {
    return NextResponse.json(
      {
        error: {
          code: err.code,
          message: err.message,
          ...(err.details && { details: err.details }),
        },
      },
      { status: err.statusCode },
    );
  }

  // Unexpected — log to Sentry once wired (Phase 5).
  console.error("[api] unexpected error:", err);
  return NextResponse.json(
    { error: { code: "INTERNAL", message: "Something went wrong" } },
    { status: 500 },
  );
}
