"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Phone,
  MessageCircle,
  Mail,
  MoreHorizontal,
  ShieldAlert,
  ShieldCheck,
  Copy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/components/ui/toaster";

interface Props {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  blacklisted: boolean;
}

/** Header actions on the customer detail page: contact shortcuts + a menu. */
export function CustomerActions({ id, name, phone, email, blacklisted }: Props) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const digits = phone.replace(/\D/g, "");

  async function toggleBlacklist() {
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/admin/customers/${id}/blacklist`, {
        method: blacklisted ? "DELETE" : "POST",
        headers: { "content-type": "application/json" },
        ...(blacklisted
          ? {}
          : { body: JSON.stringify({ reason: "Flagged from customer page" }) }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json?.error?.message ?? "Action failed");
        return;
      }
      toast.success(blacklisted ? "Removed from blacklist" : `${name} blacklisted`);
      router.refresh();
    } catch {
      toast.error("Network error");
    } finally {
      setBusy(false);
    }
  }

  function copyPhone() {
    navigator.clipboard?.writeText(phone).then(
      () => toast.success("Phone number copied"),
      () => toast.error("Couldn't copy"),
    );
  }

  return (
    <>
      <a href={`tel:${digits}`}>
        <Button variant="ghost" size="sm">
          <Phone className="size-3.5" /> Call
        </Button>
      </a>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => window.open(`https://wa.me/${digits}`, "_blank", "noopener")}
      >
        <MessageCircle className="size-3.5" /> WhatsApp
      </Button>
      {email ? (
        <a href={`mailto:${email}`}>
          <Button variant="ghost" size="sm">
            <Mail className="size-3.5" /> Email
          </Button>
        </a>
      ) : (
        <Button variant="ghost" size="sm" disabled title="No email on file">
          <Mail className="size-3.5" /> Email
        </Button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" disabled={busy} aria-label="More actions">
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={copyPhone}>
            <Copy className="size-3.5" /> Copy phone
          </DropdownMenuItem>
          {blacklisted ? (
            <DropdownMenuItem onClick={toggleBlacklist}>
              <ShieldCheck className="size-3.5" /> Remove from blacklist
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem destructive onClick={toggleBlacklist}>
              <ShieldAlert className="size-3.5" /> Blacklist
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
