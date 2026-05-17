"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { Lock, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Checkbox } from "@/components/ui/checkbox";
import { OTPInput } from "@/components/ui/otp-input";
import { Alert } from "@/components/ui/alert";

type Step = "credentials" | "totp";

export default function AdminLoginPage() {
  const router = useRouter();
  const { data: session, update } = useSession();
  const [step, setStep] = React.useState<Step>("credentials");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [show, setShow] = React.useState(false);
  const [remember, setRemember] = React.useState(true);
  const [totp, setTotp] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (session?.user && !session.user.pendingTotp) {
      router.replace("/admin");
    } else if (session?.user?.pendingTotp) {
      setStep("totp");
    }
  }, [session, router]);

  async function submitCredentials(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await signIn("staff", { email, password, redirect: false });
    setLoading(false);
    if (!res || res.error) {
      setError(res?.error ?? "Couldn't sign in");
      return;
    }
    // Session effect above will route us — either to /admin if no TOTP, or
    // to the TOTP step.
  }

  async function verifyTotp(code: string) {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/totp/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTotp("");
        throw new Error(data.error?.message ?? "Incorrect code");
      }
      await update({ user: { pendingTotp: false } });
      router.replace("/admin");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  if (step === "totp") {
    return (
      <div>
        <div className="size-12 rounded-md bg-info-bg text-brand-primary flex items-center justify-center mb-4">
          <ShieldCheck className="size-6" />
        </div>
        <h1 className="font-display text-3xl font-semibold tracking-tight mb-2">
          Two-factor authentication
        </h1>
        <p className="text-sm text-fg-muted mb-7">
          Enter the 6-digit code from your authenticator app.
        </p>

        <OTPInput
          length={6}
          value={totp}
          onChange={setTotp}
          onComplete={verifyTotp}
          autoFocus
          invalid={!!error}
        />

        {error && <Alert tone="danger" title={error} className="mt-4" />}

        <button
          onClick={() => setStep("credentials")}
          className="mt-6 text-xs font-semibold text-brand-primary hover:underline"
        >
          ← Use a different account
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="size-12 rounded-md bg-info-bg text-brand-primary flex items-center justify-center mb-4">
        <Lock className="size-6" />
      </div>
      <h1 className="font-display text-3xl font-semibold tracking-tight mb-2">
        Avmall admin
      </h1>
      <p className="text-sm text-fg-muted mb-7">
        Sign in with your staff email. 2FA is required.
      </p>

      <form onSubmit={submitCredentials} className="flex flex-col gap-4">
        <Field id="email" label="Email" required>
          <Input
            id="email"
            type="email"
            placeholder="you@avmall.ng"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoFocus
          />
        </Field>
        <Field id="password" label="Password" required>
          <div className="relative">
            <Input
              id="password"
              type={show ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              aria-label={show ? "Hide password" : "Show password"}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-fg-muted hover:text-fg"
            >
              {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </Field>

        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox
              checked={remember}
              onCheckedChange={(v) => setRemember(v === true)}
            />
            Remember this device for 30 days
          </label>
          <Link
            href="/forgot-password"
            className="text-xs font-semibold text-brand-primary hover:underline"
          >
            Forgot?
          </Link>
        </div>

        {error && <Alert tone="danger" title={error} />}

        <Button type="submit" size="lg" width="full" loading={loading}>
          Continue
        </Button>
      </form>

      <div className="mt-6 pt-6 border-t border-border text-center text-xs text-fg-muted">
        Customer?{" "}
        <Link href="/login" className="text-brand-primary font-semibold hover:underline">
          Use the customer login
        </Link>
      </div>
    </div>
  );
}
