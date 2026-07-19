/**
 * PATCH  /api/v1/admin/content/journal/[id] — update a journal post.
 * DELETE /api/v1/admin/content/journal/[id] — delete a journal post.
 * Permission: settings.edit.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, hasDatabase } from "@/lib/db";
import { requireStaffSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";
import { apiSuccess, handleApiError } from "@/lib/api-response";
import { AppError, ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { slugify } from "@/lib/slug";

export const runtime = "nodejs";

const patchSchema = z.object({
  title: z.string().min(1).optional(),
  slug: z.string().optional(),
  excerpt: z.string().optional(),
  body: z.string().optional(),
  coverImage: z.string().nullable().optional(),
  category: z.string().optional(),
  author: z.string().nullable().optional(),
  readTime: z.string().nullable().optional(),
  published: z.boolean().optional(),
  publishedAt: z.string().datetime().nullable().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await requireStaffSession();
    requirePermission(session, "settings.edit");
    if (!hasDatabase) {
      throw new AppError("DB_NOT_CONFIGURED", "Journal requires DATABASE_URL.", 503);
    }

    const existing = await db.journalPost.findUnique({ where: { id: params.id } });
    if (!existing) throw new NotFoundError("Journal post");

    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new ValidationError({
        [issue?.path.join(".") ?? "body"]: issue?.message ?? "Invalid",
      });
    }
    const b = parsed.data;

    // Slug change → re-slugify + uniqueness check against other posts.
    let slug: string | undefined;
    if (b.slug !== undefined || b.title !== undefined) {
      const next = slugify(b.slug || b.title || existing.slug);
      if (next && next !== existing.slug) {
        const clash = await db.journalPost.findFirst({
          where: { slug: next, id: { not: existing.id } },
        });
        if (clash) throw new ConflictError(`A post with slug "${next}" already exists`);
        slug = next;
      }
    }

    // Publishing for the first time with no explicit date → stamp now.
    let publishedAt: Date | null | undefined;
    if (b.publishedAt !== undefined) {
      publishedAt = b.publishedAt ? new Date(b.publishedAt) : null;
    } else if (b.published === true && !existing.published && !existing.publishedAt) {
      publishedAt = new Date();
    }

    const updated = await db.journalPost.update({
      where: { id: existing.id },
      data: {
        ...(slug !== undefined && { slug }),
        ...(b.title !== undefined && { title: b.title }),
        ...(b.excerpt !== undefined && { excerpt: b.excerpt }),
        ...(b.body !== undefined && { body: b.body }),
        ...(b.coverImage !== undefined && { coverImage: b.coverImage }),
        ...(b.category !== undefined && { category: b.category }),
        ...(b.author !== undefined && { author: b.author }),
        ...(b.readTime !== undefined && { readTime: b.readTime }),
        ...(b.published !== undefined && { published: b.published }),
        ...(publishedAt !== undefined && { publishedAt }),
      },
    });

    await writeAudit({
      actorUserId: session.id,
      actorType: "staff",
      action: "journal.update",
      entityType: "journal_post",
      entityId: existing.id,
      before: { slug: existing.slug, published: existing.published },
      after: { slug: updated.slug, published: updated.published },
    });

    return NextResponse.json(apiSuccess({ id: updated.id, slug: updated.slug }));
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await requireStaffSession();
    requirePermission(session, "settings.edit");

    const existing = await db.journalPost.findUnique({ where: { id: params.id } });
    if (!existing) throw new NotFoundError("Journal post");

    await db.journalPost.delete({ where: { id: existing.id } });

    await writeAudit({
      actorUserId: session.id,
      actorType: "staff",
      action: "journal.delete",
      entityType: "journal_post",
      entityId: existing.id,
      before: { slug: existing.slug, title: existing.title },
    });

    return NextResponse.json(apiSuccess({ deleted: true }));
  } catch (err) {
    return handleApiError(err);
  }
}
