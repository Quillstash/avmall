"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { PhoneInput } from "@/components/ui/phone-input";
import { isPlaceholderPhone } from "@/lib/phone";
import { toast } from "@/components/ui/toaster";

export default function ProfilePage() {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [initialPhone, setInitialPhone] = React.useState("");
  // Locked once a real (verified) number exists; email signups can add one.
  const [phoneLocked, setPhoneLocked] = React.useState(true);
  const [email, setEmail] = React.useState("");
  const [initialEmail, setInitialEmail] = React.useState("");
  const [initialName, setInitialName] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  // Password section
  const [hasPassword, setHasPassword] = React.useState(false);
  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [showPw, setShowPw] = React.useState(false);
  const [savingPassword, setSavingPassword] = React.useState(false);

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
          setHasPassword(!!c.hasPassword);
          // Email signups carry a placeholder phone — show an empty, editable
          // field so they can add a real number. A real phone is verified and
          // shown read-only.
          const rawPhone = String(c.phone ?? "");
          if (isPlaceholderPhone(rawPhone)) {
            setPhone("");
            setInitialPhone("");
            setPhoneLocked(false);
          } else {
            const local = rawPhone.replace(/^\+234/, "");
            setPhone(local);
            setInitialPhone(local);
            setPhoneLocked(true);
          }
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
          ...(!phoneLocked && phone.trim() && phone !== initialPhone && { phone }),
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
      // A freshly-added number is now the account's verified phone — lock it.
      if (!phoneLocked && phone.trim()) {
        setInitialPhone(phone);
        setPhoneLocked(true);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save");
    } finally {
      setSaving(false);
    }
  }

  function cancel() {
    setName(initialName);
    setEmail(initialEmail);
    setPhone(initialPhone);
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    setSavingPassword(true);
    try {
      const res = await fetch("/api/auth/customer/change-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...(hasPassword && { currentPassword }),
          newPassword,
        }),
      });
      if (res.status === 401) {
        router.replace("/login");
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message ?? "Couldn't update password");
      toast.success(hasPassword ? "Password updated" : "Password set");
      setHasPassword(true);
      setCurrentPassword("");
      setNewPassword("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update password");
    } finally {
      setSavingPassword(false);
    }
  }

  const dirty =
    name !== initialName ||
    email !== initialEmail ||
    (!phoneLocked && phone !== initialPhone);

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
        <Field
          id="phone"
          label="Phone number"
          hint={
            phoneLocked
              ? "Verified · used for OTP login"
              : "For delivery updates — adding it sets it as your number"
          }
          {...(phoneLocked ? {} : { optional: true })}
        >
          <PhoneInput
            id="phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            disabled={phoneLocked || loading}
            readOnly={phoneLocked}
            placeholder={phoneLocked ? undefined : "803 000 0000"}
          />
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

      {/* Password */}
      <div className="max-w-xl mt-10 pt-8 border-t border-border">
        <h2 className="text-lg font-semibold mb-1">
          {hasPassword ? "Change password" : "Set a password"}
        </h2>
        <p className="text-sm text-fg-muted mb-5">
          {hasPassword
            ? "Update the password you use to sign in."
            : "Add a password so you can sign in without a one-time code."}
        </p>

        <form onSubmit={savePassword} className="flex flex-col gap-5">
          {hasPassword && (
            <Field id="current-password" label="Current password">
              <Input
                id="current-password"
                type={showPw ? "text" : "password"}
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                disabled={loading || savingPassword}
              />
            </Field>
          )}
          <Field id="new-password" label="New password" hint="At least 8 characters">
            <div className="relative">
              <Input
                id="new-password"
                type={showPw ? "text" : "password"}
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={loading || savingPassword}
                className="pr-16"
              />
              <button
                type="button"
                onClick={() => setShowPw((s) => !s)}
                tabIndex={-1}
                className="absolute inset-y-0 right-3 my-auto text-xs font-semibold text-fg-muted hover:text-fg"
              >
                {showPw ? "Hide" : "Show"}
              </button>
            </div>
          </Field>
          <div>
            <Button
              type="submit"
              size="lg"
              loading={savingPassword}
              disabled={
                loading ||
                newPassword.length < 8 ||
                (hasPassword && !currentPassword)
              }
            >
              {hasPassword ? "Update password" : "Set password"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
