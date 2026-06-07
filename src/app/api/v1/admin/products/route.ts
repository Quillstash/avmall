/**
 * POST /api/v1/admin/products
 *
 * Create a new product with a default variant ("Default") that carries the
 * stock count from the form. Bulk tiers can be created in the same request.
 * Auto-slug if not provided.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireStaffSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { resolveStaffStoreId } from "@/lib/store";
import { writeAudit } from "@/lib/audit";
import { apiSuccess, handleApiError } from "@/lib/api-response";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";

const bodySchema = z.object({
  name: z.string().min(1),
  /** Brand is optional — many SKUs are unbranded / generic. */
  brand: z.string().optional(),
  categorySlug: z.string().min(1),
  shortDesc: z.string().default(""),
  longDesc: z.string().default(""),
  themeBg: z.string().optional(),
  priceKobo: z.number().int().positive(),
  /** Internal cost of goods (kobo). Defaults to 0 — staff should set it. */
  costPriceKobo: z.number().int().nonnegative().default(0),
  saleKobo: z.number().int().positive().optional(),
  saleActive: z.boolean().default(false),
  /** Initial stock on the default variant — only used when `variants` is empty. */
  stock: z.number().int().nonnegative().default(0),
  /** Custom slug; auto-derived from name when omitted. */
  slug: z.string().optional(),
  negotiate: z.boolean().default(false),
  negotiateFloorKobo: z.number().int().nonnegative().optional(),
  negotiateMaxPct: z.number().int().min(0).max(50).optional(),
  preorder: z.boolean().default(false),
  moq: z.number().int().positive().optional(),
  eta: z.string().optional(),
  tags: z.array(z.string()).default([]),
  published: z.boolean().default(false),
  featured: z.boolean().default(false),
  bulkTiers: z
    .array(
      z.object({
        min: z.number().int().positive(),
        max: z.number().int().positive().nullable().default(null),
        type: z.enum(["percentage", "fixed"]),
        value: z.number().int().nonnegative(),
      }),
    )
    .default([]),
  /** R2 image keys returned by /api/v1/admin/upload. First entry is primary
   *  unless an entry has primary:true. */
  images: z
    .array(
      z.object({
        key: z.string().min(1),
        alt: z.string().optional(),
        primary: z.boolean().optional(),
      }),
    )
    .default([]),
  /** Optional variant matrix. Omit (or send empty values) for a single
   *  default variant — the legacy single-variant behaviour. */
  option1Name: z.string().optional(),
  option2Name: z.string().optional(),
  variants: z
    .array(
      z.object({
        label: z.string().min(1),
        sku: z.string().min(1),
        option1Value: z.string().nullable().optional(),
        option2Value: z.string().nullable().optional(),
        stock: z.number().int().nonnegative().default(0),
        priceOverrideKobo: z.number().int().positive().nullable().optional(),
      }),
    )
    .optional(),
});

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireStaffSession();
    requirePermission(session, "products.create");

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new ValidationError({
        [issue?.path.join(".") ?? "body"]: issue?.message ?? "Invalid",
      });
    }
    const b = parsed.data;

    const slug = b.slug?.trim() ? slugify(b.slug) : slugify(b.name);
    if (!slug) throw new ValidationError({ slug: "Could not derive a URL slug" });

    const existing = await db.product.findUnique({ where: { slug } });
    if (existing) {
      throw new ConflictError("A product with that slug already exists", { slug });
    }

    const category = await db.category.findUnique({ where: { slug: b.categorySlug } });
    if (!category) throw new NotFoundError(`Category ${b.categorySlug}`);

    // SKU prefix from the brand, else the product name, else a default.
    const skuPrefix =
      (b.brand?.trim() || b.name)
        .replace(/[^a-zA-Z0-9]/g, "")
        .slice(0, 3)
        .toUpperCase() || "AVM";

    // Variant rows: use the matrix when provided, else a single default variant.
    // Stock lives per-store now, so each row's opening stock is carried
    // separately and written to store_stock after the variants are created.
    const variantSpecs =
      b.variants && b.variants.length > 0
        ? b.variants.map((v, i) => ({
            label: v.label,
            sku: v.sku,
            option1Value: v.option1Value ?? null,
            option2Value: v.option2Value ?? null,
            priceKobo:
              v.priceOverrideKobo != null ? BigInt(v.priceOverrideKobo) : null,
            position: i,
            stock: v.stock,
          }))
        : [
            {
              label: "Default",
              sku: `${skuPrefix}-${slug.toUpperCase()}`,
              option1Value: null,
              option2Value: null,
              priceKobo: null,
              position: 0,
              stock: b.stock,
            },
          ];
    const variantCreate = variantSpecs.map(({ stock: _stock, ...rest }) => rest);

    const product = await db.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          slug,
          name: b.name,
          brand: b.brand?.trim() || "",
          shortDesc: b.shortDesc,
          longDesc: b.longDesc,
          categoryId: category.id,
          themeBg: b.themeBg ?? null,
          priceKobo: BigInt(b.priceKobo),
          costPriceKobo: BigInt(b.costPriceKobo),
          ...(b.saleKobo != null && { saleKobo: BigInt(b.saleKobo) }),
          saleActive: b.saleActive,
          negotiate: b.negotiate,
          ...(b.negotiateFloorKobo != null && {
            negotiateFloorKobo: BigInt(b.negotiateFloorKobo),
          }),
          ...(b.negotiateMaxPct != null && { negotiateMaxPct: b.negotiateMaxPct }),
          ...(b.option1Name && { option1Name: b.option1Name }),
          ...(b.option2Name && { option2Name: b.option2Name }),
          preorder: b.preorder,
          ...(b.moq != null && { moq: b.moq }),
          ...(b.eta && { eta: b.eta }),
          tags: b.tags,
          published: b.published,
          featured: b.featured,
          variants: { create: variantCreate },
          ...(b.bulkTiers.length > 0 && {
            bulkTiers: {
              create: b.bulkTiers.map((t) => ({
                min: t.min,
                max: t.max,
                type: t.type,
                value: t.value,
              })),
            },
          }),
          ...(b.images.length > 0 && {
            images: {
              create: b.images.map((img, i) => ({
                key: img.key,
                alt: img.alt ?? null,
                position: i,
                // First image is primary unless an entry explicitly opts in.
                isPrimary: img.primary ?? i === 0,
              })),
            },
          }),
        },
        include: { variants: true },
      });

      // Seed each new variant's opening stock at the operator's store.
      const storeId = await resolveStaffStoreId(session);
      if (storeId) {
        for (const v of created.variants) {
          const spec = variantSpecs.find((s) => s.sku === v.sku);
          await tx.storeStock.create({
            data: {
              storeId,
              variantId: v.id,
              onHand: spec?.stock ?? 0,
              reserved: 0,
            },
          });
        }
      }

      await writeAudit(
        {
          actorUserId: session.id,
          actorType: "staff",
          action: "product.create",
          entityType: "product",
          entityId: created.id,
          after: { slug: created.slug, name: created.name },
        },
        tx,
      );

      return created;
    });

    return NextResponse.json(
      apiSuccess({ product: { id: product.id, slug: product.slug } }),
      { status: 201 },
    );
  } catch (err) {
    return handleApiError(err);
  }
}
