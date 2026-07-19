/**
 * POST /api/v1/admin/content/journal — create a journal post.
 * Permission: settings.edit.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, hasDatabase } from "@/lib/db";
import { requireStaffSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";
import { apiSuccess, handleApiError } from "@/lib/api-response";
import { AppError, ConflictError, ValidationError } from "@/lib/errors";
import { slugify } from "@/lib/slug";

export const runtime = "nodejs";

export const journalBodySchema = z.object({
  title: z.string().min(1, "Title is required"),
  slug: z.string().optional(),
  excerpt: z.string().default(""),
  body: z.string().default(""),
  coverImage: z.string().nullable().optional(),
  category: z.string().default(""),
  author: z.string().nullable().optional(),
  readTime: z.string().nullable().optional(),
  published: z.boolean().default(false),
  publishedAt: z.string().datetime().nullable().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await requireStaffSession();
    requirePermission(session, "settings.edit");

    if (!hasDatabase) {
      throw new AppError("DB_NOT_CONFIGURED", "Journal requires DATABASE_URL.", 503);
    }

    const parsed = journalBodySchema.safeParse(await req.json());
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new ValidationError({
        [issue?.path.join(".") ?? "body"]: issue?.message ?? "Invalid",
      });
    }
    const b = parsed.data;
    const slug = slugify(b.slug || b.title);
    if (!slug) throw new ValidationError({ slug: "Could not derive a slug from the title" });

    const clash = await db.journalPost.findUnique({ where: { slug } });
    if (clash) throw new ConflictError(`A post with slug "${slug}" already exists`);

    // Publishing without an explicit date → stamp now.
    const publishedAt = b.published
      ? b.publishedAt
        ? new Date(b.publishedAt)
        : new Date()
      : b.publishedAt
        ? new Date(b.publishedAt)
        : null;

    const created = await db.journalPost.create({
      data: {
        slug,
        title: b.title,
        excerpt: b.excerpt,
        body: b.body,
        coverImage: b.coverImage ?? null,
        category: b.category,
        author: b.author ?? null,
        readTime: b.readTime ?? null,
        published: b.published,
        publishedAt,
      },
    });

    await writeAudit({
      actorUserId: session.id,
      actorType: "staff",
      action: "journal.create",
      entityType: "journal_post",
      entityId: created.id,
      after: { slug, title: b.title, published: b.published },
    });

    return NextResponse.json(
      apiSuccess({ id: created.id, slug: created.slug }),
      { status: 201 },
    );
  } catch (err) {
    return handleApiError(err);
  }
}
