/**
 * Bearer-token guard for the AI agent tool endpoints.
 *
 * The AI orchestrator (D-Zero or any other LLM service) presents this token
 * in the Authorization header on every server-to-server call. We compare
 * against the AI_AGENT_TOKEN env value using a constant-time check so any
 * timing signal is removed.
 *
 * Per CLAUDE.md §21 this will eventually be a signed JWT with a dedicated
 * `ai_agent` scope, rotatable from the admin AI page. For now a long shared
 * secret in env is enough — the only caller is our own AI orchestrator.
 */

import "server-only";

import type { NextRequest } from "next/server";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";

class AiAuthError extends AppError {
  constructor(message: string) {
    super("AI_UNAUTHORIZED", message, 401);
  }
}

/** Constant-time string compare to avoid timing oracles. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * Throws if the request doesn't carry a valid `Authorization: Bearer <token>`
 * header matching AI_AGENT_TOKEN. Use at the top of every /ai/tools/* route.
 */
export function requireAiAgent(req: NextRequest): void {
  const configured = env.AI_AGENT_TOKEN;
  if (!configured) {
    throw new AppError(
      "AI_NOT_CONFIGURED",
      "AI_AGENT_TOKEN is not set — the AI tool API is disabled in this environment.",
      503,
    );
  }
  const header = req.headers.get("authorization") ?? "";
  if (!header.toLowerCase().startsWith("bearer ")) {
    throw new AiAuthError("Missing Bearer token");
  }
  const presented = header.slice("Bearer ".length).trim();
  if (!safeEqual(presented, configured)) {
    throw new AiAuthError("Invalid AI agent token");
  }
}
