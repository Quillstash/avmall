"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { PhoneInput } from "@/components/ui/phone-input";
import { toast } from "@/components/ui/toaster";

export default function ProfilePage() {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [initialEmail, setInitialEmail] = React.useState("");
  const [initialName, setInitialName] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/v1/customer/me");
        if (res.status === 401) {
          router.replace("/login");
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        const c = data.data?.customer;
        if (c) {
          setName(c.name ?? "");
          setInitialName(c.name ?? "");
          setEmail(c.email ?? "");
          setInitialEmail(c.email ?? "");
          // Phone is verified and immutable from this form; we display its
          // national portion only.
          const local = String(c.phone ?? "").replace(/^\+234/, "");
          setPhone(local);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/v1/customer/me", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...(name !== initialName && { name }),
          ...(email !== initialEmail && { email: email || null }),
        }),
      });
      if (res.status === 401) {
        router.replace("/login");
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message ?? "Couldn't save");
      toast.success("Profile updated");
      setInitialName(name);
      setInitialEmail(email);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save");
    } finally {
      setSaving(false);
    }
  }

  function cancel() {
    setName(initialName);
    setEmail(initialEmail);
  }

  const dirty = name !== initialName || email !== initialEmail;

  return (
    <div>
      <h1 className="font-display text-3xl lg:text-4xl font-semibold tracking-tight mb-1">
        Profile
      </h1>
      <p className="text-sm text-fg-muted mb-8">Your name and contact details</p>

      <form onSubmit={save} className="max-w-xl flex flex-col gap-5">
        <Field id="name" label="Full name" required>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={loading}
          />
        </Field>
        <Field id="phone" label="Phone number" hint="Verified · used for OTP login">
          <PhoneInput id="phone" value={phone} disabled readOnly />
        </Field>
        <Field id="email" label="Email" optional>
          <Input
            id="email"
            type="email"
            placeholder="for receipts"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
          />
        </Field>
        <div className="flex gap-3 mt-3">
          <Button type="submit" size="lg" loading={saving} disabled={!dirty || loading}>
            Save changes
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="lg"
            onClick={cancel}
            disabled={!dirty || loading}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
