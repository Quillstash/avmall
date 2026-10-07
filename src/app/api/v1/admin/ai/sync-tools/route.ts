/**
 * POST /api/v1/admin/ai/sync-tools   { apply?: boolean, allowRemove?: boolean }
 *
 * Compares the AI agent tool list in src/lib/ai/dailzero-tools.ts with what each
 * Dailzero agent has, and with `apply: true` pushes ours (read back to verify).
 * Same logic as `pnpm ai:sync-tools`. Without `apply` nothing is changed.
 *
 * The tools send this deployment's AI_AGENT_TOKEN, which is checked against the
 * live site first — a preview deploy with a different token must not push one
 * production would reject. A tool that isn't in our list is only dropped with
 * `allowRemove`. Permission: `ai.settings`.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";
import { apiSuccess, handleApiError } from "@/lib/api-response";
import { AppError, ValidationError } from "@/lib/errors";
import { env } from "@/lib/env";
import { SITE } from "@/lib/site";
import { buildAvmallTools, channelForAgent } from "@/lib/ai/dailzero-tools";
import { createDailzeroClient } from "@/lib/dailzero";
import { planAgentSync, pushAndVerify } from "@/lib/ai/sync-tools";

export const runtime = "nodejs";
export const maxDuration = 60;

const bodySchema = z.object({
  apply: z.boolean().default(false),
  allowRemove: z.boolean().default(false),
});

export async function POST(req: NextRequest) {
  try {
    const session = await requireStaffSession();
    requirePermission(session, "ai.settings");

    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) throw new ValidationError({ body: "Invalid request" });
    const { apply, allowRemove } = parsed.data;

    if (!env.DAILZERO_API_KEY) {
      throw new AppError("DAILZERO_NOT_CONFIGURED", "DAILZERO_API_KEY is not set on this deployment.", 503);
    }
    if (!env.AI_AGENT_TOKEN) {
      throw new AppError("AI_NOT_CONFIGURED", "AI_AGENT_TOKEN is not set on this deployment.", 503);
    }

    // Tools always point at the public site, never at a preview URL.
    const baseUrl = SITE.url.replace(/\/+$/, "");
    const probe = await fetch(`${baseUrl}/api/v1/ai/tools/payments/sync-check-${Date.now()}`, {
      headers: { Authorization: `Bearer ${env.AI_AGENT_TOKEN}` },
      cache: "no-store",
    });
    if (probe.status !== 404) {
      throw new AppError(
        "TOKEN_REJECTED",
        `${baseUrl} doesn't accept this deployment's AI_AGENT_TOKEN (HTTP ${probe.status}), so syncing would break the order and payment tools. Sync from production.`,
        409,
      );
    }

    const dz = createDailzeroClient(env.DAILZERO_API_KEY);
    const agents = await dz.listAgents();

    const results = [];
    for (const agent of agents) {
      const current = await dz.getTools(agent.id);
      const desired = buildAvmallTools(baseUrl, env.AI_AGENT_TOKEN, channelForAgent(agent.businessName));
      const plan = planAgentSync(agent, current, desired);
      let status: "up_to_date" | "pending" | "pushed" | "blocked" | "drift" = plan.changes.length
        ? "pending"
        : "up_to_date";
      let drift: string[] = [];

      if (apply && status === "pending") {
        if (plan.removed.length && !allowRemove) {
          status = "blocked";
        } else {
          drift = await pushAndVerify(dz, agent.id, desired);
          status = drift.length ? "drift" : "pushed";
          await writeAudit({
            actorUserId: session.id,
            actorType: "staff",
            action: "ai.tools_sync",
            entityType: "ai_agent",
            entityId: agent.id,
            before: { tools: current.map((t) => t.name) },
            after: { tools: desired.map((t) => t.name), changes: plan.changes, drift },
          });
        }
      }

      results.push({
        agentId: agent.id,
        name: agent.businessName,
        status,
        changes: plan.changes,
        removed: plan.removed,
        drift,
      });
    }

    return NextResponse.json(apiSuccess({ applied: apply, toolCount: buildAvmallTools(baseUrl, "", "web").length, agents: results }));
  } catch (err) {
    return handleApiError(err);
  }
}
