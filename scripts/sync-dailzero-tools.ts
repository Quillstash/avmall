/**
 * Push the agent tool list in src/lib/ai/dailzero-tools.ts to Dailzero.
 *
 *   pnpm ai:sync-tools                 dry run: show what would change, touch nothing
 *   pnpm ai:sync-tools --apply         replace the tools on every agent
 *   pnpm ai:sync-tools --apply --agent <id>   one agent only (repeatable)
 *
 * Needs DAILZERO_API_KEY (scope "manage") in .env.local.
 *
 * Which token the tools send: our AI_AGENT_TOKEN as PRODUCTION has it, which is
 * not necessarily what .env.local has. So the script reuses the Bearer token the
 * agent's tools already carry, or DAILZERO_TOOL_TOKEN if you set it (to rotate).
 * Either way it calls the live site with that token first and refuses to push
 * one prod rejects — a wrong token would break every order/payment tool at once.
 *
 * Every run saves each agent's current tools to tmp/dailzero/ (gitignored) before
 * changing anything; those files hold the token, so keep them local.
 *
 * Removing a tool that isn't in our list needs --allow-remove, so a tool someone
 * added in the dashboard is never dropped silently.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildAvmallTools, channelForAgent, DAILZERO_MAX_TOOLS } from "@/lib/ai/dailzero-tools";
import { createDailzeroClient } from "@/lib/dailzero";
import { currentToolToken, planAgentSync, pushAndVerify } from "@/lib/ai/sync-tools";
import { SITE } from "@/lib/site";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const allowRemove = args.includes("--allow-remove");
const onlyAgents = args.flatMap((a, i) => (a === "--agent" && args[i + 1] ? [args[i + 1]!] : []));
const baseArg = args.includes("--base") ? args[args.indexOf("--base") + 1] : undefined;
const baseUrl = (baseArg ?? SITE.url).replace(/\/+$/, "");

function fail(msg: string): never {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
}

/** Prod must accept the token: 404 on a made-up reference = authorised. */
async function checkTokenOnProd(token: string): Promise<void> {
  const res = await fetch(`${baseUrl}/api/v1/ai/tools/payments/sync-check-${Date.now()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401 || res.status === 503) {
    fail(
      `${baseUrl} rejected the tool token (HTTP ${res.status}). Not pushing — every order and payment tool would break. Set DAILZERO_TOOL_TOKEN to the AI_AGENT_TOKEN value from Vercel.`,
    );
  }
  if (res.status !== 404) fail(`Unexpected HTTP ${res.status} while checking the token on ${baseUrl}.`);
}

/**
 * The tool list only works against endpoints from the same change: it sends
 * Naira (`offer`) and line items as a JSON string. Pushing it at an older
 * deploy would break negotiate and every cart/order tool, so probe both with a
 * made-up product: current endpoints answer 404 (no such product), older ones
 * 400 (wrong input shape).
 */
async function siteRunsTheseTools(token: string): Promise<boolean> {
  const post = (path: string, body: unknown) =>
    fetch(`${baseUrl}/api/v1/ai/tools/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    }).then((r) => r.status);
  const slug = `sync-check-${Date.now()}`;
  const [negotiate, quote] = await Promise.all([
    post("negotiate", { productSlug: slug, offer: 1000 }),
    post("cart/quote", { items: JSON.stringify([{ productSlug: slug, quantity: 1 }]) }),
  ]);
  return negotiate === 404 && quote === 404;
}

async function main() {
  const apiKey = process.env.DAILZERO_API_KEY?.trim();
  if (!apiKey) fail("DAILZERO_API_KEY is not set (.env.local).");

  const dz = createDailzeroClient(apiKey);
  const agents = await dz.listAgents();
  const targets = onlyAgents.length ? agents.filter((a) => onlyAgents.includes(a.id)) : agents;
  const missing = onlyAgents.filter((id) => !agents.some((a) => a.id === id));
  if (missing.length) fail(`Not found on this key: ${missing.join(", ")}`);
  if (!targets.length) fail("This key has no agents.");

  console.log(`Site: ${baseUrl}`);
  console.log(`Mode: ${apply ? "APPLY" : "dry run (add --apply to push)"}`);
  console.log("");

  const backupDir = join(process.cwd(), "tmp", "dailzero");
  mkdirSync(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const checkedTokens = new Set<string>();
  let blocked = false;

  for (const agent of targets) {
    console.log(`── ${agent.businessName} (${agent.id})`);
    const current = await dz.getTools(agent.id);
    const backup = join(backupDir, `${agent.id}-${stamp}.json`);
    writeFileSync(backup, JSON.stringify({ tools: current }, null, 2));
    console.log(`   backup: ${backup}`);

    const token = process.env.DAILZERO_TOOL_TOKEN?.trim() || currentToolToken(current);
    if (!token) {
      fail(
        `${agent.businessName}: can't tell which token its tools use (none, or several). Set DAILZERO_TOOL_TOKEN to the AI_AGENT_TOKEN value from Vercel.`,
      );
    }
    if (!checkedTokens.has(token)) {
      await checkTokenOnProd(token);
      checkedTokens.add(token);
    }
    console.log("   token: accepted by the live site");
    if (!(await siteRunsTheseTools(token))) {
      const msg = `${baseUrl} is still running older tool endpoints than this tool list expects. Deploy this change first, then sync.`;
      if (apply) fail(msg);
      console.log(`   ⚠ ${msg}`);
    }

    const desired = buildAvmallTools(baseUrl, token, channelForAgent(agent.businessName));
    if (desired.length > DAILZERO_MAX_TOOLS) fail(`${desired.length} tools; Dailzero allows ${DAILZERO_MAX_TOOLS}.`);

    const plan = planAgentSync(agent, current, desired);
    for (const c of plan.changes) {
      if (c.kind === "added") console.log(`   + ${c.name}  (new)`);
      else if (c.kind === "changed") console.log(`   ~ ${c.name}: ${c.fields.join("; ")}`);
      else
        console.log(
          `   - ${c.name}  (not in our list — ${allowRemove ? "will be removed" : "blocks --apply unless --allow-remove"})`,
        );
    }
    if (!plan.changes.length) {
      console.log("   ✓ already up to date\n");
      continue;
    }
    if (!apply) {
      console.log("");
      continue;
    }
    if (plan.removed.length && !allowRemove) {
      console.log(
        `   ✖ skipped: would remove ${plan.removed.join(", ")}. Add it to dailzero-tools.ts, or re-run with --allow-remove.\n`,
      );
      blocked = true;
      continue;
    }

    const drift = await pushAndVerify(dz, agent.id, desired);
    if (drift.length) {
      console.log(`   ⚠ pushed, but read-back differs:\n     ${drift.join("\n     ")}\n`);
      blocked = true;
    } else {
      console.log(`   ✓ pushed ${desired.length} tools and verified\n`);
    }
  }

  if (blocked) process.exit(1);
}

main().catch((err: unknown) => {
  fail(err instanceof Error ? err.message : String(err));
});
