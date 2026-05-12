/**
 * Append-only audit log helper. Per CLAUDE.md §2.3, every state-changing
 * action writes a row here. Never DELETE or UPDATE.
 */

import { db } from "./db";

export interface AuditEntry {
  actorUserId?: string | null;
  actorType: "staff" | "customer" | "ai" | "system";
  action: string;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  metadata?: {
    ip?: string;
    userAgent?: string;
    channel?: string;
    [key: string]: unknown;
  };
}

/**
 * Write a single audit log row. Fire-and-forget — never throws into the caller.
 *
 * NOTE: Pass through a transaction client (`tx.auditLog.create`) when called
 * inside a transaction so the entry is committed atomically with the change
 * it describes. The default path uses the global db client.
 */
export async function writeAudit(
  entry: AuditEntry,
  tx: { auditLog: typeof db.auditLog } = db,
): Promise<void> {
  try {
    await tx.auditLog.create({
      data: {
        actorUserId: entry.actorUserId ?? null,
        actorType: entry.actorType,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        before: (entry.before ?? null) as never,
        after: (entry.after ?? null) as never,
        metadata: (entry.metadata ?? {}) as never,
      },
    });
  } catch (err) {
    // Audit failures shouldn't break the request. Log and move on.
    console.error("[audit] failed to write log:", err);
  }
}
