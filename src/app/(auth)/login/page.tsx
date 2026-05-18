"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { OTPInput } from "@/components/ui/otp-input";
import { Alert } from "@/components/ui/alert";

type Step = "identify" | "verify";

// Phone OTP is disabled until SMS is provisioned — the page is email-only.
// To re-enable: switch `method` back to a state field, restore the Tabs
// import + UI, and uncomment the phone branch in /api/auth/customer/start.
const method = "email" as const;

export default function CustomerLoginPage() {
  const router = useRouter();
  const [step, setStep] = React.useState<Step>("identify");
  const [email, setEmail] = React.useState("");
  const [otp, setOtp] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [hint, setHint] = React.useState<string | null>(null);
  const [resendIn, setResendIn] = React.useState(0);

  React.useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const identifier = email;

  async function startVerification() {
    setError(null);
    setHint(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/customer/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ identifier }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message ?? "Couldn't send a code");

      if (data.data?.mock) {
        setHint("Mock mode (no DB) — use code 123456");
      }
      setStep("verify");
      setResendIn(60);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp(code: string) {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/customer/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ identifier, code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setOtp("");
        throw new Error(data.error?.message ?? "Couldn't verify the code");
      }
      router.push("/account");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  if (step === "verify") {
    return (
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight mb-2">
          Enter your code
        </h1>
        <p className="text-sm text-fg-muted mb-7">
          We sent a 6-digit code to{" "}
          <span className="font-semibold text-fg">{email}</span>
          .{" "}
          <button
            onClick={() => setStep("identify")}
            className="text-brand-primary font-semibold hover:underline"
          >
            Wrong details?
          </button>
        </p>

        <OTPInput
          length={6}
          value={otp}
          onChange={setOtp}
          onComplete={verifyOtp}
          autoFocus
          invalid={!!error}
        />

        {error && <Alert tone="danger" title={error} className="mt-4" />}
        {!error && hint && <Alert tone="info" title={hint} className="mt-4" />}

        <p className="text-xs text-fg-muted mt-5">
          Didn&apos;t get it?{" "}
          {resendIn > 0 ? (
            <span>Resend in {resendIn}s</span>
          ) : (
            <button
              onClick={startVerification}
              className="text-brand-primary font-semibold hover:underline"
            >
              Resend code
            </button>
          )}
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold tracking-tight mb-2">
        Sign in to Avmall
      </h1>
      <p className="text-sm text-fg-muted mb-7">
        We&apos;ll send you a 6-digit code. No password required.
      </p>

      {error && <Alert tone="danger" title={error} className="mb-4" />}

      <div className="mb-5">
        <Field id="email" label="Email">
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoFocus
          />
        </Field>
      </div>

      <Button
        size="lg"
        width="full"
        onClick={startVerification}
        loading={loading}
        disabled={!email}
      >
        Send code
      </Button>

      <p className="text-xs text-fg-muted mt-6 text-center">
        By continuing you agree to our{" "}
        <Link href="#" className="text-brand-primary hover:underline">
          Terms
        </Link>{" "}
        and{" "}
        <Link href="#" className="text-brand-primary hover:underline">
          Privacy
        </Link>
        .
      </p>

      <div className="mt-6 pt-6 border-t border-border text-center text-xs text-fg-muted">
        Avmall staff?{" "}
        <Link href="/admin-login" className="text-brand-primary font-semibold hover:underline">
          Sign in to admin
        </Link>
      </div>
    </div>
  );
}
