"use client";

import * as React from "react";
import { ArrowRight, Check, Loader2 } from "lucide-react";

/** Storefront newsletter form. Posts to /api/v1/newsletter. */
export function NewsletterSignup({ source = "homepage-footer" }: { source?: string }) {
  const [email, setEmail] = React.useState("");
  const [state, setState] = React.useState<"idle" | "submitting" | "done">("idle");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !email.includes("@")) return;
    setState("submitting");
    try {
      await fetch("/api/v1/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), source }),
      });
      setState("done");
    } catch {
      // Hide errors — the endpoint is idempotent and we'd rather not flash
      // failure to a casual signup user. Reset so they can try again.
      setState("idle");
    }
  }

  if (state === "done") {
    return (
      <p className="inline-flex items-center gap-2 text-sm font-semibold">
        <Check className="size-4" /> Subscribed — thanks!
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col sm:flex-row gap-2">
      <input
        type="email"
        placeholder="you@email.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full sm:flex-1 min-w-0 h-12 px-4 rounded-md bg-white/10 text-white placeholder:text-white/50 text-sm border-0 focus:outline-none focus:ring-2 focus:ring-white/40"
        required
      />
      <button
        type="submit"
        disabled={state === "submitting"}
        className="w-full sm:w-auto shrink-0 px-6 h-12 rounded-md bg-bg text-fg font-bold text-sm hover:bg-white/95 inline-flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {state === "submitting" ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <>
            Subscribe <ArrowRight className="size-4" />
          </>
        )}
      </button>
    </form>
  );
}
