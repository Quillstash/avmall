/**
 * Prisma client singleton. Survives Next.js hot reload in dev by stashing on
 * the global object.
 */

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}

/** True when DATABASE_URL is set so callers can gracefully fall back to mock data. */
export const hasDatabase = !!process.env.DATABASE_URL;
