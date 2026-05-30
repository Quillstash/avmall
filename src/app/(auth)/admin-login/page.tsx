"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { Lock, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert } from "@/components/ui/alert";

export default function AdminLoginPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [show, setShow] = React.useState(false);
  const [remember, setRemember] = React.useState(true);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (session?.user) router.replace("/admin");
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
    // Session effect above will redirect to /admin once the JWT lands.
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
        Sign in with your staff email.
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
