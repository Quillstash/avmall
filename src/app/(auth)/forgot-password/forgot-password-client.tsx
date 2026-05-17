"use client";

import * as React from "react";
import Link from "next/link";
import { Mail, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";

export function ForgotPasswordClient() {
  const [email, setEmail] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [done, setDone] = React.useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await fetch("/api/v1/staff/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      setDone(true);
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-lg border border-border bg-surface p-6">
        <div className="flex items-center gap-2 mb-2">
          <Mail className="size-5 text-brand-accent" />
          <h1 className="font-bold text-lg">Check your inbox</h1>
        </div>
        <p className="text-sm text-fg-muted leading-relaxed mb-4">
          If <span className="font-mono">{email}</span> belongs to an active
          staff account, we&apos;ve sent a reset link. The link is valid for 30
          minutes.
        </p>
        <Link
          href="/admin-login"
          className="text-sm font-semibold text-brand-primary hover:underline"
        >
          ← Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-6">
      <h1 className="font-bold text-lg mb-1">Forgot password</h1>
      <p className="text-sm text-fg-muted mb-5">
        Enter your staff email and we&apos;ll send a reset link.
      </p>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <Field id="email" label="Email">
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@avmall.ng"
            autoFocus
          />
        </Field>
        <Button type="submit" disabled={submitting || !email.trim()}>
          {submitting && <Loader2 className="size-4 animate-spin" />}
          <Mail className="size-4" /> Send reset link
        </Button>
        <div className="text-center mt-2">
          <Link
            href="/admin-login"
            className="text-xs text-fg-muted hover:text-fg"
          >
            Back to sign in
          </Link>
        </div>
      </form>
    </div>
  );
}
