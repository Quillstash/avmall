"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";

type View = "password" | "code";
type CodeStep = "identify" | "verify";

export default function CustomerLoginPage() {
  const router = useRouter();

  const [view, setView] = React.useState<View>("password");
  const [isSignup, setIsSignup] = React.useState(false);

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);

  const [codeStep, setCodeStep] = React.useState<CodeStep>("identify");
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

  function resetFeedback() {
    setError(null);
    setHint(null);
  }

  // ── Email + password ──────────────────────────────────────────────────────
  async function submitPassword(e: React.FormEvent) {
    e.preventDefault();
    resetFeedback();
    setLoading(true);
    try {
      const endpoint = isSignup
        ? "/api/auth/customer/signup"
        : "/api/auth/customer/login";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data.error?.message ??
            (isSignup ? "Couldn't create your account" : "Couldn't sign you in"),
        );
      }
      // New accounts go to the profile to add their name + details.
      router.push(isSignup ? "/account/profile" : "/account");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  // ── One-time code (OTP) ───────────────────────────────────────────────────
  async function sendCode(e?: React.FormEvent) {
    e?.preventDefault();
    resetFeedback();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/customer/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ identifier: email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message ?? "Couldn't send a code");
      if (data.data?.mock) setHint("Mock mode (no DB) — use code 123456");
      setCodeStep("verify");
      setOtp("");
      setResendIn(60);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    resetFeedback();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/customer/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ identifier: email, code: otp.trim() }),
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

  function goToCode() {
    resetFeedback();
    setView("code");
    setCodeStep("identify");
  }
  function goToPassword() {
    resetFeedback();
    setView("password");
  }

  // ── Render: OTP verify step ───────────────────────────────────────────────
  if (view === "code" && codeStep === "verify") {
    return (
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight mb-2">
          Enter your code
        </h1>
        <p className="text-sm text-fg-muted mb-7">
          We sent a 6-digit code to{" "}
          <span className="font-semibold text-fg">{email}</span>.{" "}
          <button
            type="button"
            onClick={() => setCodeStep("identify")}
            className="text-brand-primary font-semibold hover:underline"
          >
            Wrong email?
          </button>
        </p>

        <form onSubmit={verifyCode}>
          <Field id="otp" label="6-digit code">
            <Input
              id="otp"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              autoFocus
              placeholder="123456"
              value={otp}
              invalid={!!error}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="text-center text-2xl tracking-[0.4em] font-semibold tabular"
            />
          </Field>

          {error && <Alert tone="danger" title={error} className="mt-4" />}
          {!error && hint && <Alert tone="info" title={hint} className="mt-4" />}

          <Button
            type="submit"
            size="lg"
            width="full"
            className="mt-5"
            loading={loading}
            disabled={otp.length < 6}
          >
            Verify &amp; sign in
          </Button>
        </form>

        <p className="text-xs text-fg-muted mt-5">
          Didn&apos;t get it?{" "}
          {resendIn > 0 ? (
            <span>Resend in {resendIn}s</span>
          ) : (
            <button
              type="button"
              onClick={() => sendCode()}
              className="text-brand-primary font-semibold hover:underline"
            >
              Resend code
            </button>
          )}
        </p>
      </div>
    );
  }

  // ── Render: OTP identify step ─────────────────────────────────────────────
  if (view === "code" && codeStep === "identify") {
    return (
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight mb-2">
          Sign in with a code
        </h1>
        <p className="text-sm text-fg-muted mb-7">
          We&apos;ll email you a 6-digit code — no password needed.
        </p>

        {error && <Alert tone="danger" title={error} className="mb-4" />}

        <form onSubmit={sendCode}>
          <Field id="email" label="Email">
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              autoFocus
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Button
            type="submit"
            size="lg"
            width="full"
            className="mt-5"
            loading={loading}
            disabled={!email}
          >
            Send code
          </Button>
        </form>

        <p className="text-sm text-fg-muted mt-6 text-center">
          <button
            type="button"
            onClick={goToPassword}
            className="text-brand-primary font-semibold hover:underline"
          >
            ← Use email &amp; password instead
          </button>
        </p>
      </div>
    );
  }

  // ── Render: email + password (sign in / create account) ───────────────────
  return (
    <div>
      <Image
        src="/brand/monogram.png"
        alt="Avmall"
        width={48}
        height={48}
        className="mb-4 rounded-md"
        priority
      />
      <h1 className="font-display text-3xl font-semibold tracking-tight mb-2">
        {isSignup ? "Create your account" : "Sign in to Avmall"}
      </h1>
      <p className="text-sm text-fg-muted mb-7">
        {isSignup
          ? "Sign up with your email and a password. You'll add your name next."
          : "Welcome back. Sign in to track orders and check out faster."}
      </p>

      {error && <Alert tone="danger" title={error} className="mb-4" />}

      <form onSubmit={submitPassword} className="flex flex-col gap-4">
        <Field id="email" label="Email">
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            autoFocus
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field
          id="password"
          label="Password"
          {...(isSignup ? { hint: "At least 8 characters" } : {})}
        >
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete={isSignup ? "new-password" : "current-password"}
              placeholder={isSignup ? "Create a password" : "Your password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pr-16"
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="absolute inset-y-0 right-3 my-auto text-xs font-semibold text-fg-muted hover:text-fg"
              tabIndex={-1}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
        </Field>

        <Button
          type="submit"
          size="lg"
          width="full"
          loading={loading}
          disabled={!email || password.length < (isSignup ? 8 : 1)}
        >
          {isSignup ? "Create account" : "Sign in"}
        </Button>
      </form>

      <p className="text-sm text-fg-muted mt-5 text-center">
        {isSignup ? "Already have an account?" : "New to Avmall?"}{" "}
        <button
          type="button"
          onClick={() => {
            resetFeedback();
            setIsSignup((s) => !s);
          }}
          className="text-brand-primary font-semibold hover:underline"
        >
          {isSignup ? "Sign in" : "Create an account"}
        </button>
      </p>

      <div className="flex items-center gap-3 my-6">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs text-fg-subtle">or</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <Button variant="secondary" width="full" onClick={goToCode}>
        Email me a one-time code
      </Button>

      <p className="text-xs text-fg-muted mt-6 text-center">
        By continuing you agree to our{" "}
        <Link href="/terms" className="text-brand-primary hover:underline">
          Terms
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="text-brand-primary hover:underline">
          Privacy
        </Link>
        .
      </p>

      <div className="mt-6 pt-6 border-t border-border text-center text-xs text-fg-muted">
        Avmall staff?{" "}
        <Link
          href="/admin-login"
          className="text-brand-primary font-semibold hover:underline"
        >
          Sign in to admin
        </Link>
      </div>
    </div>
  );
}
