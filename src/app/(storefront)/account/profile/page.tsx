"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { PhoneInput } from "@/components/ui/phone-input";
import { toast } from "@/components/ui/toaster";

export default function ProfilePage() {
  const [name, setName] = React.useState("Tolu Adeniyi");
  const [phone, setPhone] = React.useState("803 421 7790");
  const [email, setEmail] = React.useState("tolu@example.com");

  return (
    <div>
      <h1 className="font-display text-3xl lg:text-4xl font-semibold tracking-tight mb-1">
        Profile
      </h1>
      <p className="text-sm text-fg-muted mb-8">Your name and contact details</p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          toast.success("Profile updated");
        }}
        className="max-w-xl flex flex-col gap-5"
      >
        <Field id="name" label="Full name">
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field id="phone" label="Phone number" hint="Verified · used for OTP login">
          <PhoneInput id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
        <Field id="email" label="Email" optional>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <div className="flex gap-3 mt-3">
          <Button type="submit" size="lg">
            Save changes
          </Button>
          <Button type="button" variant="ghost" size="lg">
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
