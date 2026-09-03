/**
 * Guards the one Next.js mistake that `tsc` and `next build` both miss.
 *
 * A Server Component may import a COMPONENT from a `"use client"` module — that
 * is the whole point of the boundary. It may not import a plain VALUE (a const
 * array, object, string, number, or a helper function) out of one: React hands
 * the server a client-reference Proxy instead of the real thing, and the first
 * property access throws at request time.
 *
 *     Error: Attempted to call includes() from the server but includes is on
 *     the client.
 *
 * Neither existing check can see this. The import is perfectly type-correct, so
 * `tsc --noEmit` passes; and nearly every admin page is `force-dynamic`, so it
 * is never prerendered and `next build` never executes it. That combination
 * shipped a production 500 on /admin/orders (digest 2782115159) in Aug 2026.
 *
 * Run: `pnpm check:boundaries` (also wired into the Vercel build command).
 * Exits non-zero and names the file, the symbol and the fix when it finds one.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname, normalize, relative } from "node:path";

const SRC = "src";

/** Strip comments so directives and declarations aren't matched inside them. */
function stripComments(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(p)) out.push(p);
  }
  return out;
}

/** True when the file opens with the "use client" directive. */
function isClientModule(code: string): boolean {
  return /^\s*["']use client["']/.test(stripComments(code));
}

/** Resolve an import specifier to a file in src, or null for packages. */
function resolveImport(spec: string, fromFile: string): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = join(SRC, spec.slice(2));
  else if (spec.startsWith(".")) base = normalize(join(dirname(fromFile), spec));
  else return null;
  for (const cand of [
    `${base}.tsx`,
    `${base}.ts`,
    join(base, "index.tsx"),
    join(base, "index.ts"),
  ]) {
    try {
      if (statSync(cand).isFile()) return cand;
    } catch {
      /* keep trying */
    }
  }
  return null;
}

/**
 * Classify an exported binding in a client module.
 *
 * "component" — a function, arrow, forwardRef/memo wrapper, or class. Safe to
 * import from a server component: React renders it across the boundary.
 * "value" — a literal array/object/string/number/boolean, i.e. something whose
 * properties a server module would try to read directly. Not safe.
 * "unknown" — anything we can't prove. Deliberately NOT reported: this gates
 * deploys, so it only fires on a positively identified plain value.
 */
function classifyExport(code: string, name: string): "component" | "value" | "unknown" {
  const src = stripComments(code);
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  // export function Foo(...) / export async function / export class
  if (new RegExp(`export\\s+(async\\s+)?(function|class)\\s+${esc}\\b`).test(src)) {
    return "component";
  }

  // export const Foo = <initialiser>   (also picks up `let`/`var`)
  const decl = new RegExp(
    `export\\s+(?:const|let|var)\\s+${esc}\\s*(?::[^=]+)?=\\s*([\\s\\S]{0,120})`,
  ).exec(src);

  // Non-exported declaration later re-exported via `export { Foo }`.
  const localDecl =
    decl ??
    (new RegExp(`export\\s*{[^}]*\\b${esc}\\b[^}]*}`).test(src)
      ? new RegExp(
          `(?:^|\\n)\\s*(?:const|let|var)\\s+${esc}\\s*(?::[^=]+)?=\\s*([\\s\\S]{0,120})`,
        ).exec(src)
      : null);

  if (new RegExp(`(?:^|\\n)\\s*(?:async\\s+)?function\\s+${esc}\\b`).test(src)) {
    return "component";
  }

  const init = localDecl?.[1]?.trimStart();
  if (init === undefined) return "unknown";

  // React.forwardRef(...) / memo(...) / styled wrappers → component
  if (/^(React\.)?(forwardRef|memo|lazy)\s*[<(]/.test(init)) return "component";
  // Arrow function or function expression → callable, crosses the boundary
  if (/^(\(|async\s|function\b)/.test(init)) return "component";
  // A bare identifier or call we can't see through
  if (/^[A-Za-z_$][\w$]*\s*[(<]/.test(init)) return "unknown";

  // Literals — the dangerous case.
  if (/^[[{'"`]/.test(init) || /^-?\d/.test(init) || /^(true|false)\b/.test(init)) {
    return "value";
  }
  return "unknown";
}

type Violation = {
  file: string;
  symbol: string;
  spec: string;
  target: string;
};

const files = walk(SRC);
const clientModules = new Map<string, string>(); // path -> source
const sources = new Map<string, string>();

for (const f of files) {
  const code = readFileSync(f, "utf8");
  sources.set(f, code);
  if (isClientModule(code)) clientModules.set(f, code);
}

const IMPORT_RE =
  /import\s+(type\s+)?([\s\S]*?)\s+from\s*["']([^"']+)["']/g;

const violations: Violation[] = [];

for (const [file, code] of sources) {
  if (clientModules.has(file)) continue; // client → client is fine
  const src = stripComments(code);

  for (const m of src.matchAll(IMPORT_RE)) {
    const [, typeKeyword, clause, spec] = m;
    if (typeKeyword) continue; // `import type { ... }` is erased
    if (!spec) continue;

    const target = resolveImport(spec, file);
    if (!target || !clientModules.has(target)) continue;

    const braced = /{([\s\S]*)}/.exec(clause ?? "");
    if (!braced?.[1]) continue; // default/namespace import — treat as component

    for (const rawName of braced[1].split(",")) {
      const part = rawName.trim();
      if (!part || part.startsWith("type ")) continue; // inline type specifier
      const imported = part.split(/\s+as\s+/)[0]?.trim();
      if (!imported) continue;

      if (classifyExport(clientModules.get(target)!, imported) === "value") {
        violations.push({ file, symbol: imported, spec, target });
      }
    }
  }
}

const serverCount = sources.size - clientModules.size;

if (violations.length === 0) {
  console.log(
    `✓ client boundary clean — ${serverCount} server modules checked against ` +
      `${clientModules.size} "use client" modules`,
  );
  process.exit(0);
}

console.error(
  `\n✗ ${violations.length} server module import(s) reach into a "use client" module for a plain value.\n` +
    `  The server receives a client-reference Proxy, not the value, and throws on first use.\n`,
);
for (const v of violations) {
  console.error(`  ${relative(".", v.file)}`);
  console.error(`    imports  ${v.symbol}  from "${v.spec}"  (${relative(".", v.target)} is "use client")`);
}
console.error(
  `\n  Fix: move the value into a plain module with no "use client" directive and\n` +
    `  import it from both sides. See src/lib/pagination.ts for the pattern.\n`,
);
process.exit(1);
