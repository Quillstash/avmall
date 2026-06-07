/**
 * POST /api/v1/ai/tools/cart/prepare
 *
 * The recommended way for the AI agent to "checkout" a customer: instead of
 * creating an order + Nuqood payment link directly, this tool validates the
 * items, builds a deeplink that pre-loads the customer's browser cart, and
 * lets the customer pay through the normal storefront checkout flow.
 *
 * Why this exists: the cart lives in the customer's browser (localStorage).
 * The AI can't mutate it from the server — but it can hand the customer a
 * URL that does the mutation on click. After clicking, the customer lands on
 * /cart with everything ready, reviews, and clicks Checkout to pay.
 *
 * Body:
 *   {
 *     items: [{ productSlug, quantity, variantId? }]
 *   }
 *
 * Response:
 *   {
 *     cartUrl,                // share this with the customer
 *     itemCount, subtotalKobo, displayTotal,
 *     lines: [{ slug, name, quantity, unitKobo }],
 *     message                 // hint the AI can paraphrase
 *   }
 *
 * Auth: Bearer AI_AGENT_TOKEN
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, hasDatabase } from "@/lib/db";
import { requireAiAgent } from "@/lib/ai-auth";
import { getMainStoreId } from "@/lib/store";
import { apiSuccess, handleApiError } from "@/lib/api-response";
import { env } from "@/lib/env";
import { SITE } from "@/lib/site";
import { formatMoney } from "@/lib/money";
import { AppError, NotFoundError, ValidationError } from "@/lib/errors";
import type { CartLine, CartLineSnapshot } from "@/stores/cart-store";

export const runtime = "nodejs";

const bodySchema = z.object({
  items: z
    .array(
      z.object({
        productSlug: z.string().min(1),
        variantId: z.string().uuid().optional(),
        quantity: z.number().int().positive(),
      }),
    )
    .min(1, "At least one item required"),
});

export async function POST(req: NextRequest) {
  try {
    requireAiAgent(req);

    if (!hasDatabase) {
      throw new AppError(
        "DB_NOT_CONFIGURED",
        "Cart prepare requires DATABASE_URL.",
        503,
      );
    }

    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new ValidationError({
        [issue?.path.join(".") ?? "body"]: issue?.message ?? "Invalid",
      });
    }
    const { items } = parsed.data;

    // AI surfaces the Main store's availability (the storefront default).
    const storeId = await getMainStoreId();

    const slugs = Array.from(new Set(items.map((i) => i.productSlug)));
    const products = await db.product.findMany({
      where: { slug: { in: slugs }, archivedAt: null, published: true },
      include: {
        variants: {
          orderBy: { position: "asc" },
          include: { storeStock: storeId ? { where: { storeId } } : true },
        },
        bulkTiers: true,
        images: { orderBy: [{ isPrimary: "desc" }, { position: "asc" }] },
      },
    });
    const productBySlug = new Map(products.map((p) => [p.slug, p]));

    // Match the same R2 → fallback chain that the storefront uses.
    const r2Base = process.env.R2_PUBLIC_URL?.trim().replace(/\/+$/, "") ?? null;
    function imageUrlFor(p: (typeof products)[number]): string {
      if (r2Base && p.images[0]) return `${r2Base}/${p.images[0].key}`;
      return `https://picsum.photos/seed/${encodeURIComponent(p.slug)}/800/800`;
    }

    const cartLines: CartLine[] = [];
    let subtotalKobo = 0;
    let itemCount = 0;
    const summaryLines: Array<{
      slug: string;
      name: string;
      quantity: number;
      unitKobo: number;
    }> = [];

    for (const item of items) {
      const product = productBySlug.get(item.productSlug);
      if (!product) throw new NotFoundError(`Product ${item.productSlug}`);

      const variant = item.variantId
        ? product.variants.find((v) => v.id === item.variantId)
        : (product.variants.find((v) => {
            const s = v.storeStock[0];
            return s && s.onHand - s.reserved > 0;
          }) ?? product.variants[0]);
      if (!variant) throw new NotFoundError(`Variant for ${item.productSlug}`);

      const vs = variant.storeStock[0];
      const available = vs ? vs.onHand - vs.reserved : 0;
      if (available < item.quantity && !product.preorder) {
        throw new AppError(
          "STOCK_UNAVAILABLE",
          `Only ${available} of ${product.name} available (requested ${item.quantity})`,
          409,
        );
      }

      const unitKobo = Number(
        variant.priceKobo ??
          (product.saleActive && product.saleKobo != null
            ? product.saleKobo
            : product.priceKobo),
      );

      const snapshot: CartLineSnapshot = {
        slug: product.slug,
        name: product.name,
        brand: product.brand,
        imageUrl: imageUrlFor(product),
        bg: product.themeBg ?? "linear-gradient(135deg, #ece4d4 0%, #c4a87a 100%)",
        variantLabel: variant.label,
        unitKobo,
        stock: available,
        bulk: product.bulkTiers.map((t) => ({
          min: t.min,
          max: t.max,
          type: t.type,
          value: t.value,
        })),
      };

      cartLines.push({
        productId: product.id,
        variantId: variant.id,
        qty: item.quantity,
        snapshot,
      });
      subtotalKobo += unitKobo * item.quantity;
      itemCount += item.quantity;
      summaryLines.push({
        slug: product.slug,
        name: product.name,
        quantity: item.quantity,
        unitKobo,
      });
    }

    // Encode cart contents for the deeplink. base64url so it's URL-safe.
    const payload = JSON.stringify(cartLines);
    const b64 = Buffer.from(payload, "utf8")
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    const appBaseUrl = env.NEXT_PUBLIC_APP_URL ?? SITE.url;
    const cartUrl = `${appBaseUrl}/cart?cart=${b64}`;

    return NextResponse.json(
      apiSuccess({
        cartUrl,
        itemCount,
        subtotalKobo,
        displayTotal: formatMoney(subtotalKobo),
        currency: "NGN",
        lines: summaryLines,
        message: `Tap the link to open your cart with ${itemCount} item${itemCount === 1 ? "" : "s"} (${formatMoney(subtotalKobo)}). Review, then hit Checkout to pay.`,
      }),
    );
  } catch (err) {
    return handleApiError(err);
  }
}
