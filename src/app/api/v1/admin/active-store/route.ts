/**
 * POST /api/v1/admin/active-store   { slug }
 *
 * Sets the admin's active store (full-coverage staff only). The whole admin
 * re-scopes to this store on the next render. Non-coverage staff are rejected.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffSession } from "@/lib/auth";
import {
  canSwitchStores,
  getStoreBySlug,
  listActiveStores,
  resolveAdminStoreId,
} from "@/lib/store";
import { ADMIN_STORE_COOKIE } from "@/lib/store-constants";
import { apiSuccess, handleApiError } from "@/lib/api-response";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";

export const runtime = "nodejs";

/** Switcher data: whether the staffer can switch, the active store, and the
 *  list of stores to pick from. */
export async function GET() {
  try {
    const session = await requireStaffSession();
    if (!canSwitchStores(session)) {
      return NextResponse.json(apiSuccess({ canSwitch: false, activeSlug: null, stores: [] }));
    }
    const [stores, activeId] = await Promise.all([
      listActiveStores(),
      resolveAdminStoreId(session),
    ]);
    const active = stores.find((s) => s.id === activeId);
    return NextResponse.json(
      apiSuccess({
        canSwitch: true,
        activeSlug: active?.slug ?? null,
        stores: stores.map((s) => ({ slug: s.slug, name: s.name, isMain: s.isMain })),
      }),
    );
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireStaffSession();
    if (!canSwitchStores(session)) {
      throw new ForbiddenError("You don't have access to switch stores");
    }
    const body = await req.json().catch(() => ({}));
    const parsed = z.object({ slug: z.string().min(1) }).safeParse(body);
    if (!parsed.success) throw new ValidationError({ slug: "Store slug required" });

    const store = await getStoreBySlug(parsed.data.slug);
    if (!store || !store.active) throw new NotFoundError("Store");

    const res = NextResponse.json(apiSuccess({ slug: store.slug, name: store.name }));
    res.cookies.set(ADMIN_STORE_COOKIE, store.slug, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return res;
  } catch (err) {
    return handleApiError(err);
  }
}
