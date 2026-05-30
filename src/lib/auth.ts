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
import type { StaffRole } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: StaffRole;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: StaffRole;
  }
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
        } as never;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const u = user as unknown as { id: string; role: StaffRole };
        token.id = u.id;
        token.role = u.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
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
