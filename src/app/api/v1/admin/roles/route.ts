/**
 * GET  /api/v1/admin/roles    List roles (with user counts).
 * POST /api/v1/admin/roles    Create a custom role.
 *
 * Permission: roles.view (list) / roles.manage (create)
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, hasDatabase } from "@/lib/db";
import { requireStaffSession } from "@/lib/auth";
import { requirePermission, cleanPermissions } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";
import { apiSuccess, handleApiError } from "@/lib/api-response";
import { AppError, ValidationError } from "@/lib/errors";

export const runtime = "nodejs";

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 50) || "role"
  );
}

export async function GET() {
  try {
    const session = await requireStaffSession();
    requirePermission(session, "roles.view");
    if (!hasDatabase) return NextResponse.json(apiSuccess({ roles: [] }));

    const roles = await db.role.findMany({
      orderBy: [{ isSystem: "desc" }, { name: "asc" }],
      include: { _count: { select: { users: true } } },
    });
    return NextResponse.json(
      apiSuccess({
        roles: roles.map((r) => ({
          id: r.id,
          name: r.name,
          slug: r.slug,
          description: r.description,
          isSystem: r.isSystem,
          permissions: r.permissions,
          userCount: r._count.users,
        })),
      }),
    );
  } catch (err) {
    return handleApiError(err);
  }
}

const bodySchema = z.object({
  name: z.string().min(1, "Role name is required"),
  description: z.string().optional(),
  permissions: z.array(z.string()).default([]),
});

export async function POST(req: NextRequest) {
  try {
    const session = await requireStaffSession();
    requirePermission(session, "roles.manage");
    if (!hasDatabase) {
      throw new AppError("DB_NOT_CONFIGURED", "Roles require DATABASE_URL.", 503);
    }

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      throw new ValidationError({
        name: parsed.error.issues[0]?.message ?? "Invalid",
      });
    }
    const b = parsed.data;

    const base = slugify(b.name);
    let slug = base;
    let n = 1;
    while (await db.role.findUnique({ where: { slug }, select: { id: true } })) {
      n += 1;
      slug = `${base}-${n}`;
    }

    const role = await db.role.create({
      data: {
        name: b.name.trim(),
        slug,
        description: b.description?.trim() || null,
        isSystem: false,
        permissions: cleanPermissions(b.permissions),
      },
    });

    await writeAudit({
      actorUserId: session.id,
      actorType: "staff",
      action: "role.create",
      entityType: "role",
      entityId: role.id,
      after: { name: role.name, slug: role.slug, permissions: role.permissions.length },
    });

    return NextResponse.json(
      apiSuccess({ role: { id: role.id, slug: role.slug } }),
      { status: 201 },
    );
  } catch (err) {
    return handleApiError(err);
  }
}
