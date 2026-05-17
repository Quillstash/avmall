import Link from "next/link";
import { db, hasDatabase } from "@/lib/db";
import { ResetPasswordClient } from "./reset-password-client";

export const dynamic = "force-dynamic";

interface PageProps {
  params: { token: string };
}

export default async function ResetPasswordPage({ params }: PageProps) {
  if (!hasDatabase) {
    return (
      <Shell title="Unavailable">
        <p>The reset system isn&apos;t running in this environment.</p>
      </Shell>
    );
  }

  const reset = await db.passwordReset.findUnique({
    where: { token: params.token },
    include: { user: { select: { email: true, active: true } } },
  });

  if (!reset || !reset.user.active) {
    return (
      <Shell title="Reset link invalid">
        <p>
          This reset link doesn&apos;t match any active staff account. Request a
          new one from <Link href="/forgot-password" className="font-semibold text-brand-primary hover:underline">/forgot-password</Link>.
        </p>
      </Shell>
    );
  }

  if (reset.usedAt) {
    return (
      <Shell title="Already used">
        <p>
          This reset link has already been used. If you still need to reset
          your password, request a fresh link.
        </p>
        <Link
          href="/forgot-password"
          className="inline-block mt-3 text-sm font-semibold text-brand-primary hover:underline"
        >
          Send a new link →
        </Link>
      </Shell>
    );
  }

  if (reset.expiresAt.getTime() < Date.now()) {
    return (
      <Shell title="Link expired">
        <p>
          Reset links are valid for 30 minutes. Request a fresh one and try
          again.
        </p>
        <Link
          href="/forgot-password"
          className="inline-block mt-3 text-sm font-semibold text-brand-primary hover:underline"
        >
          Send a new link →
        </Link>
      </Shell>
    );
  }

  return (
    <ResetPasswordClient token={params.token} email={reset.user.email} />
  );
}

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-6">
      <h1 className="font-bold text-lg mb-2">{title}</h1>
      <div className="text-sm text-fg-muted leading-relaxed">{children}</div>
    </div>
  );
}
