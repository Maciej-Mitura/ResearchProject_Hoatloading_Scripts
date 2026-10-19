import type { Context, Next } from "jsr:@hono/hono@4.6.5";
import type { ApiError } from "../domain/types.ts";

export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export async function errorMiddleware(c: Context, next: Next) {
  try {
    await next();
  } catch (err) {
    if (err instanceof AppError) {
      const body: ApiError = {
        error: { code: err.code, message: err.message, details: err.details },
      };
      return c.json(body, err.status as 400);
    }
    console.error("[api] unhandled error", err);
    const body: ApiError = {
      error: {
        code: "internal_error",
        message: "An unexpected error occurred",
      },
    };
    return c.json(body, 500);
  }
}

export function jsonError(
  c: Context,
  status: number,
  code: string,
  message: string,
  details?: unknown,
) {
  const body: ApiError = { error: { code, message, details } };
  return c.json(body, status as 400);
}
