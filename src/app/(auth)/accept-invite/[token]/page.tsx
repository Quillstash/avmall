import Link from "next/link";
import { db, hasDatabase } from "@/lib/db";
import { AcceptInviteClient } from "./accept-invite-client";

export const dynamic = "force-dynamic";

interface PageProps {
  params: { token: string };
}

export default async function AcceptInvitePage({ params }: PageProps) {
  if (!hasDatabase) {
    return (
      <ErrorShell title="Unavailable">
        <p>
          The invitation system isn&apos;t running in this environment — ask the
          admin who invited you to try again later.
        </p>
      </ErrorShell>
    );
  }

  const invitation = await db.staffInvitation.findUnique({
    where: { token: params.token },
    select: {
      email: true,
      name: true,
      role: true,
      acceptedAt: true,
      expiresAt: true,
    },
  });

  if (!invitation) {
    return (
      <ErrorShell title="Invitation not found">
        <p>
          This invite link doesn&apos;t match any record we have. It may have been
          revoked. Ask the admin who invited you to send a fresh one.
        </p>
      </ErrorShell>
    );
  }

  if (invitation.acceptedAt) {
    return (
      <ErrorShell title="Already accepted">
        <p>
          This invitation has already been used. Sign in at{" "}
          <Link href="/admin-login" className="font-semibold text-brand-primary hover:underline">
            /admin-login
          </Link>{" "}
          instead.
        </p>
      </ErrorShell>
    );
  }

  if (invitation.expiresAt.getTime() < Date.now()) {
    return (
      <ErrorShell title="This invitation has expired">
        <p>
          Ask the admin who invited you to send a new invitation. Links are valid
          for 7 days.
        </p>
      </ErrorShell>
    );
  }

  return (
    <AcceptInviteClient
      token={params.token}
      email={invitation.email}
      name={invitation.name}
      role={invitation.role}
    />
  );
}

function ErrorShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-6">
      <h1 className="font-bold text-lg mb-2">{title}</h1>
      <div className="text-sm text-fg-muted leading-relaxed">{children}</div>
    </div>
  );
}
