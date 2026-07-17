"use client";

import * as React from "react";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ui/field";
import { NumberInput } from "@/components/ui/number-input";
import { toast } from "@/components/ui/toaster";

interface Settings {
  storeName: string;
  storeEmail: string;
  storePhone: string;
  storeWhatsapp: string;
  storeAddress: string;
  rcNumber: string;
  bankNumber: string | null;
  bankAccountName: string | null;
  bankName: string | null;
  returnWindowDays: number;
  socialInstagram: string;
  socialTwitter: string;
  socialTiktok: string;
  wholesaleTitle: string;
  wholesaleSubtext: string;
}

const EMPTY: Settings = {
  storeName: "",
  storeEmail: "",
  storePhone: "",
  storeWhatsapp: "",
  storeAddress: "",
  rcNumber: "",
  bankNumber: "",
  bankAccountName: "",
  bankName: "",
  returnWindowDays: 14,
  socialInstagram: "",
  socialTwitter: "",
  socialTiktok: "",
  wholesaleTitle: "",
  wholesaleSubtext: "",
};

export function SettingsClient() {
  const [settings, setSettings] = React.useState<Settings>(EMPTY);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    fetch("/api/v1/admin/settings")
      .then((r) => r.json())
      .then((json) => {
        if (json?.data) setSettings({ ...EMPTY, ...json.data });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function set<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/v1/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...settings,
          bankNumber: settings.bankNumber || null,
          bankAccountName: settings.bankAccountName || null,
          bankName: settings.bankName || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json?.error?.message ?? "Could not save settings");
        return;
      }
      if (json?.data?.saved === false) {
        toast.success("Settings saved (no database — restart to apply env changes)");
      } else {
        toast.success("Settings saved");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-fg-muted py-8">
        <Loader2 className="size-4 animate-spin" /> Loading settings…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Business profile */}
      <Card title="Business profile">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field id="s-name" label="Store name" required>
            <Input id="s-name" value={settings.storeName} onChange={(e) => set("storeName", e.target.value)} placeholder="Avmall" />
          </Field>
          <Field id="s-email" label="Contact email" required>
            <Input id="s-email" type="email" value={settings.storeEmail} onChange={(e) => set("storeEmail", e.target.value)} placeholder="hello@avmall.com.ng" />
          </Field>
          <Field id="s-phone" label="Phone number">
            <Input id="s-phone" value={settings.storePhone} onChange={(e) => set("storePhone", e.target.value)} placeholder="+234 803 421 7790" />
          </Field>
          <Field id="s-wa" label="WhatsApp number" hint="Powers every 'Chat with us' / contact-support link on the storefront, plus customer messages">
            <Input id="s-wa" value={settings.storeWhatsapp} onChange={(e) => set("storeWhatsapp", e.target.value)} placeholder="+2347034486614" />
          </Field>
          <Field id="s-addr" label="Business address" className="md:col-span-2">
            <Input id="s-addr" value={settings.storeAddress} onChange={(e) => set("storeAddress", e.target.value)} placeholder="Sokoto Road, Zaria, Kaduna" />
          </Field>
          <Field id="s-rc" label="RC number" hint="CAC registration number — shown in the storefront footer">
            <Input id="s-rc" value={settings.rcNumber} onChange={(e) => set("rcNumber", e.target.value)} placeholder="7798804" className="font-mono" />
          </Field>
        </div>
      </Card>

      {/* Social links */}
      <Card title="Social links" subtitle="Full profile URLs. Leave a field blank to hide that icon from the storefront footer.">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Field id="s-ig" label="Instagram">
            <Input id="s-ig" value={settings.socialInstagram} onChange={(e) => set("socialInstagram", e.target.value)} placeholder="https://instagram.com/avmall.ng" />
          </Field>
          <Field id="s-x" label="X / Twitter">
            <Input id="s-x" value={settings.socialTwitter} onChange={(e) => set("socialTwitter", e.target.value)} placeholder="https://twitter.com/avmall_ng" />
          </Field>
          <Field id="s-tt" label="TikTok">
            <Input id="s-tt" value={settings.socialTiktok} onChange={(e) => set("socialTiktok", e.target.value)} placeholder="https://tiktok.com/@avmall.ng" />
          </Field>
        </div>
      </Card>

      {/* Homepage content */}
      <Card title="Homepage content" subtitle="The wholesale band shown on the storefront home page.">
        <div className="flex flex-col gap-3">
          <Field id="s-wt" label="Wholesale heading">
            <Input id="s-wt" value={settings.wholesaleTitle} onChange={(e) => set("wholesaleTitle", e.target.value)} placeholder="Wholesale pricing, negotiated on WhatsApp." />
          </Field>
          <Field id="s-ws" label="Wholesale subtext">
            <Textarea id="s-ws" value={settings.wholesaleSubtext} onChange={(e) => set("wholesaleSubtext", e.target.value)} placeholder="Tiered bulk discounts, split payments, dedicated account manager — chat with us to get a quote for your shop." />
          </Field>
        </div>
      </Card>

      {/* Fallback bank account */}
      <Card title="Fallback bank account" subtitle="Shown to customers when Nuqood dynamic accounts are unavailable">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Field id="s-bank" label="Bank name">
            <Input id="s-bank" value={settings.bankName ?? ""} onChange={(e) => set("bankName", e.target.value)} placeholder="Opay / PalmPay" />
          </Field>
          <Field id="s-acc" label="Account number">
            <Input id="s-acc" value={settings.bankNumber ?? ""} onChange={(e) => set("bankNumber", e.target.value)} placeholder="0123456789" className="font-mono" />
          </Field>
          <Field id="s-accname" label="Account name">
            <Input id="s-accname" value={settings.bankAccountName ?? ""} onChange={(e) => set("bankAccountName", e.target.value)} placeholder="ALMUBAARAK VARIETY MALL" />
          </Field>
        </div>
      </Card>

      {/* Return policy */}
      <Card title="Return policy">
        <div className="max-w-xs">
          <Field id="s-return" label="Return window (days)" hint="Customers can initiate a return within this period after delivery">
            <NumberInput
              value={settings.returnWindowDays}
              onChange={(n) => set("returnWindowDays", Math.max(1, Math.min(365, n)))}
              min={1}
              max={365}
            />
          </Field>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          {saving ? "Saving…" : "Save settings"}
        </Button>
      </div>
    </div>
  );
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-surface shadow-sm">
      <div className="px-4 py-3 border-b border-border">
        <div className="text-sm font-bold">{title}</div>
        {subtitle && <div className="text-xs text-fg-muted mt-0.5">{subtitle}</div>}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}
