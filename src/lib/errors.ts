/**
 * Typed application errors. Use these instead of raw `throw new Error()`
 * so the API route handler can map them to the right HTTP status + body.
 *
 * See CLAUDE.md §13.
 */

export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 400,
    public readonly details?: Record<string, string>,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class ValidationError extends AppError {
  constructor(details: Record<string, string>) {
    super("VALIDATION", "Some fields are invalid", 400, details);
  }
}

export class NotFoundError extends AppError {
  constructor(entity: string) {
    super("NOT_FOUND", `${entity} not found`, 404);
  }
}

export class ForbiddenError extends AppError {
  constructor(detail?: string) {
    super("FORBIDDEN", detail ?? "You do not have permission", 403);
  }
}

export class UnauthorizedError extends AppError {
  constructor(detail?: string) {
    super("UNAUTHORIZED", detail ?? "Not authenticated", 401);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: Record<string, string>) {
    super("CONFLICT", message, 409, details);
  }
}

export class StockUnavailableError extends AppError {
  constructor(productId: string, available: number, requested: number) {
    super(
      "STOCK_UNAVAILABLE",
      `Only ${available} units available, ${requested} requested`,
      409,
      { productId: `Available: ${available}` },
    );
  }
}

export class RateLimitedError extends AppError {
  constructor(detail?: string) {
    super("RATE_LIMITED", detail ?? "Too many requests", 429);
  }
}

export class BlacklistedError extends AppError {
  constructor() {
    super("BLACKLISTED", "Customer is blacklisted", 403);
  }
}

export class IdempotencyConflictError extends AppError {
  constructor() {
    super("IDEMPOTENCY_CONFLICT", "Idempotency key reused with different body", 409);
  }
}
