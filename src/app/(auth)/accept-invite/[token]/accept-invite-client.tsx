"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShieldCheck, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toaster";

interface Props {
  token: string;
  email: string;
  name: string;
  role: string;
}

export function AcceptInviteClient({ token, email, name, role }: Props) {
  const router = useRouter();
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords don't match.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/v1/staff/accept-invite/${encodeURIComponent(token)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password }),
        },
      );
      const json = await res.json();
      if (!res.ok) {
        toast.error(json?.error?.message ?? "Could not accept invitation");
        return;
      }
      toast.success(`Welcome to Avmall, ${name}. Please sign in.`);
      router.push("/admin-login");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-6">
      <div className="flex items-center gap-2 mb-2">
        <ShieldCheck className="size-5 text-brand-accent" />
        <h1 className="font-bold text-lg">Set your password</h1>
      </div>
      <p className="text-sm text-fg-muted mb-1">
        You&apos;ve been invited as <Badge tone="info">{role.replace(/_/g, " ")}</Badge>.
      </p>
      <p className="text-xs text-fg-muted mb-5">
        Signing in as <span className="font-mono">{email}</span> — pick a password
        you&apos;ll remember.
      </p>

      <form onSubmit={submit} className="flex flex-col gap-3">
        <Field id="password" label="New password">
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            required
          />
        </Field>
        <Field id="confirm" label="Confirm password">
          <Input
            id="confirm"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
        </Field>
        <Button type="submit" disabled={submitting} className="mt-2">
          {submitting && <Loader2 className="size-4 animate-spin" />}
          <KeyRound className="size-4" />
          {submitting ? "Setting up your account…" : "Accept invite"}
        </Button>
      </form>
    </div>
  );
}
