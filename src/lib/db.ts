/**
 * Prisma client singleton. Survives Next.js hot reload in dev by stashing on
 * the global object.
 */

import { PrismaClient, Prisma } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}

/** True when DATABASE_URL is set so callers can gracefully fall back to mock data. */
export const hasDatabase = !!process.env.DATABASE_URL;

/**
 * Retry transient Neon cold-start failures. PrismaClientInitializationError
 * fires before any query lands, so a wider catch is needed than the usual
 * P-code errors. Retries 3× with linear backoff (1s, 2s, 3s).
 */
export async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const isConnError =
        err instanceof Prisma.PrismaClientInitializationError ||
        (err instanceof Error && /Can't reach database server|ECONNREFUSED|ETIMEDOUT/.test(err.message));
      if (!isConnError || i === attempts - 1) throw err;
      await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
    }
  }
  throw lastErr;
}
