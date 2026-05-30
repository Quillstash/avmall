import { redirect } from "next/navigation";
import { db, hasDatabase } from "@/lib/db";
import { getStaffSession } from "@/lib/auth";
import { ProfileClient, type ProfileData } from "./profile-client";

export const dynamic = "force-dynamic";

export default async function AdminProfilePage() {
  const session = await getStaffSession();
  if (!session?.user) redirect("/admin-login");

  let profile: ProfileData;
  if (hasDatabase) {
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        lastSeenAt: true,
        createdAt: true,
      },
    });
    if (!user) redirect("/admin-login");
    profile = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      lastSeenAt: user.lastSeenAt?.toISOString() ?? null,
      createdAt: user.createdAt.toISOString(),
    };
  } else {
    profile = {
      id: session.user.id,
      email: session.user.email ?? "",
      name: session.user.name ?? "Staff",
      role: session.user.role,
      lastSeenAt: null,
      createdAt: new Date().toISOString(),
    };
  }

  return <ProfileClient profile={profile} />;
}
