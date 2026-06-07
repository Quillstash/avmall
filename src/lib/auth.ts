/**
 * Staff authentication via NextAuth.js with the Prisma adapter.
 *
 * Flow:
 *   1. /admin-login posts email + password → Credentials provider validates
 *      against User.passwordHash with bcrypt.
 *   2. On success the JWT session carries the staff user's role + id.
 *   3. Middleware refuses any /admin route without a valid staff session.
 *
 * Customer auth (phone/email OTP) is separate — see lib/customer-session.ts.
 */

import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import type { AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { getServerSession } from "next-auth";
import { db } from "./db";
import { env } from "./env";
import { UnauthorizedError } from "./errors";
import { permissionsForRole } from "./permissions";
import type { StaffRole } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: StaffRole;
      /** Dynamic role id (null = legacy enum-only). */
      roleId: string | null;
      /** Resolved permission keys for the user's role (fresh each request). */
      permissions: string[];
      /** Home store. null = HQ / all-stores. */
      storeId: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: StaffRole;
    roleId: string | null;
    storeId: string | null;
  }
}

/** Resolve a user's permissions: their dynamic Role's set, else the static
 *  fallback for the legacy enum role. */
async function resolvePermissions(
  roleId: string | null,
  enumRole: StaffRole,
): Promise<string[]> {
  if (roleId) {
    const role = await db.role.findUnique({
      where: { id: roleId },
      select: { permissions: true },
    });
    if (role) return role.permissions;
  }
  return permissionsForRole(enumRole);
}

const adapter = PrismaAdapter(db) as NonNullable<AuthOptions["adapter"]>;

export const authOptions: AuthOptions = {
  adapter,
  session: { strategy: "jwt", maxAge: 60 * 60 * 12 },
  ...(env.NEXTAUTH_SECRET ? { secret: env.NEXTAUTH_SECRET } : {}),
  pages: {
    signIn: "/admin-login",
    error: "/admin-login",
  },
  providers: [
    CredentialsProvider({
      id: "staff",
      name: "Staff",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(creds) {
        if (!creds?.email || !creds?.password) {
          throw new Error("Email and password required");
        }
        const user = await db.user.findUnique({
          where: { email: creds.email.toLowerCase() },
        });
        if (!user || !user.active) {
          // Same error on both branches so we don't leak account existence.
          throw new Error("Invalid email or password");
        }
        const ok = await bcrypt.compare(creds.password, user.passwordHash);
        if (!ok) throw new Error("Invalid email or password");

        await db.user.update({
          where: { id: user.id },
          data: { lastSeenAt: new Date() },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          roleId: user.roleId,
          storeId: user.storeId,
        } as never;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const u = user as unknown as {
          id: string;
          role: StaffRole;
          roleId: string | null;
          storeId: string | null;
        };
        token.id = u.id;
        token.role = u.role;
        token.roleId = u.roleId ?? null;
        token.storeId = u.storeId ?? null;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.roleId = token.roleId ?? null;
        session.user.storeId = token.storeId ?? null;
        // Resolve permissions fresh each request so role edits apply at once.
        session.user.permissions = await resolvePermissions(
          token.roleId ?? null,
          token.role,
        );
      }
      return session;
    },
  },
};

/** Get the current staff session in a server component / route handler. */
export async function getStaffSession() {
  const session = await getServerSession(authOptions);
  return session;
}

/** Same as getStaffSession but throws if missing. */
export async function requireStaffSession() {
  const session = await getStaffSession();
  if (!session?.user) throw new UnauthorizedError();
  return session.user;
}
