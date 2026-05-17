"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { toast } from "@/components/ui/toaster";

export function ResetPasswordClient({
  token,
  email,
}: {
  token: string;
  email: string;
}) {
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
        `/api/v1/staff/reset-password/${encodeURIComponent(token)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password }),
        },
      );
      const json = await res.json();
      if (!res.ok) {
        toast.error(json?.error?.message ?? "Could not reset password");
        return;
      }
      toast.success("Password updated — sign in with your new password.");
      router.push("/admin-login");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-6">
      <h1 className="font-bold text-lg mb-1">Reset your password</h1>
      <p className="text-sm text-fg-muted mb-5">
        Resetting password for <span className="font-mono">{email}</span>.
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
            autoFocus
          />
        </Field>
        <Field id="confirm" label="Confirm new password">
          <Input
            id="confirm"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
        </Field>
        <Button type="submit" disabled={submitting}>
          {submitting && <Loader2 className="size-4 animate-spin" />}
          <KeyRound className="size-4" /> Set new password
        </Button>
      </form>
    </div>
  );
}
