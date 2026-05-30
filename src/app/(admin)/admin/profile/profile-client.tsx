"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { Save, Loader2, LogOut, KeyRound } from "lucide-react";
import { AdminTopBar } from "@/components/admin/topbar";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toaster";

export interface ProfileData {
  id: string;
  email: string;
  name: string;
  role: string;
  lastSeenAt: string | null;
  createdAt: string;
}

export function ProfileClient({ profile }: { profile: ProfileData }) {
  const router = useRouter();
  const [name, setName] = React.useState(profile.name);
  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [savingName, setSavingName] = React.useState(false);
  const [changingPassword, setChangingPassword] = React.useState(false);
  const [signingOut, setSigningOut] = React.useState(false);

  const nameDirty = name.trim() !== profile.name;

  async function saveName() {
    if (!nameDirty || !name.trim()) return;
    setSavingName(true);
    try {
      const res = await fetch("/api/v1/admin/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json?.error?.message ?? "Could not save");
        return;
      }
      toast.success("Profile updated");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error");
    } finally {
      setSavingName(false);
    }
  }

  async function changePassword() {
    if (!currentPassword || !newPassword) {
      toast.error("Fill in current and new password.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New passwords don't match.");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("New password must be at least 8 characters.");
      return;
    }
    setChangingPassword(true);
    try {
      const res = await fetch("/api/v1/admin/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json?.error?.message ?? "Could not change password");
        return;
      }
      toast.success("Password changed");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error");
    } finally {
      setChangingPassword(false);
    }
  }

  async function logout() {
    setSigningOut(true);
    await signOut({ callbackUrl: "/admin-login" });
  }

  return (
    <>
      <AdminTopBar breadcrumbs={[{ label: "My profile" }]} />
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-[900px] mx-auto pb-20">
          <PageHeader
            title="My profile"
            subtitle={profile.email}
            actions={
              <Button
                variant="secondary"
                size="sm"
                onClick={logout}
                disabled={signingOut}
              >
                {signingOut ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <LogOut className="size-3.5" />
                )}
                Sign out
              </Button>
            }
          />

          <div className="flex flex-col gap-4">
            {/* Identity */}
            <Card title="Identity">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                <Field id="name" label="Display name">
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </Field>
                <Field id="email" label="Email" hint="Contact a super-admin to change">
                  <Input id="email" value={profile.email} disabled />
                </Field>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                <Fact label="Role" value={<Badge tone="info">{profile.role}</Badge>} />
                <Fact
                  label="Last seen"
                  value={
                    profile.lastSeenAt
                      ? new Date(profile.lastSeenAt).toLocaleString("en-NG", {
                          dateStyle: "medium",
                          timeStyle: "short",
                          timeZone: "Africa/Lagos",
                        })
                      : "—"
                  }
                />
              </div>
              <div className="flex justify-end mt-4">
                <Button
                  onClick={saveName}
                  disabled={!nameDirty || savingName}
                  size="sm"
                >
                  {savingName && <Loader2 className="size-3.5 animate-spin" />}
                  <Save className="size-3.5" /> Save name
                </Button>
              </div>
            </Card>

            {/* Password */}
            <Card title="Change password">
              <p className="text-xs text-fg-muted mb-3">
                Use at least 8 characters. We&apos;ll log you in again with the new password
                next time.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Field id="cur" label="Current password">
                  <Input
                    id="cur"
                    type="password"
                    autoComplete="current-password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                  />
                </Field>
                <Field id="new" label="New password">
                  <Input
                    id="new"
                    type="password"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </Field>
                <Field id="conf" label="Confirm new password">
                  <Input
                    id="conf"
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </Field>
              </div>
              <div className="flex justify-end mt-4">
                <Button
                  onClick={changePassword}
                  disabled={
                    changingPassword || !currentPassword || !newPassword || !confirmPassword
                  }
                  size="sm"
                >
                  {changingPassword && <Loader2 className="size-3.5 animate-spin" />}
                  <KeyRound className="size-3.5" /> Update password
                </Button>
              </div>
            </Card>

          </div>
        </div>
      </div>
    </>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-surface shadow-sm">
      <div className="px-4 py-3 border-b border-border">
        <div className="text-sm font-bold">{title}</div>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-wider text-fg-muted mb-1">
        {label}
      </div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}
