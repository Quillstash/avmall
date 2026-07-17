/**
 * GET  /api/v1/admin/settings  — read current site settings
 * PATCH /api/v1/admin/settings — update site settings (super_admin only)
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, hasDatabase } from "@/lib/db";
import { requireStaffSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";
import { apiSuccess, handleApiError } from "@/lib/api-response";
import { ValidationError } from "@/lib/errors";
import { SITE } from "@/lib/site";

const patchSchema = z.object({
  storeName: z.string().min(1).optional(),
  storeEmail: z.string().email().optional(),
  storePhone: z.string().min(7).optional(),
  storeWhatsapp: z.string().min(7).optional(),
  storeAddress: z.string().optional(),
  bankNumber: z.string().nullable().optional(),
  bankAccountName: z.string().nullable().optional(),
  bankName: z.string().nullable().optional(),
  returnWindowDays: z.number().int().min(1).max(365).optional(),
  rcNumber: z.string().optional(),
  // Social URLs — freeform so an empty string (admin cleared it → hidden) is
  // accepted alongside a full URL.
  socialInstagram: z.string().optional(),
  socialTwitter: z.string().optional(),
  socialTiktok: z.string().optional(),
  wholesaleTitle: z.string().optional(),
  wholesaleSubtext: z.string().optional(),
});

/** Fallback when the DB row doesn't exist yet */
const DEFAULTS = {
  storeName: SITE.name,
  storeEmail: SITE.email,
  storePhone: SITE.phone,
  storeWhatsapp: SITE.whatsappNumber,
  storeAddress: `${SITE.address.street}, ${SITE.address.city}, ${SITE.address.state}`,
  bankNumber: process.env.BUSINESS_BANK_NUMBER ?? null,
  bankAccountName: process.env.BUSINESS_BANK_NAME ?? null,
  bankName: process.env.BUSINESS_BANK ?? null,
  returnWindowDays: 14,
  rcNumber: "7798804",
  socialInstagram: SITE.social.instagram,
  socialTwitter: SITE.social.twitter,
  socialTiktok: SITE.social.tiktok,
  wholesaleTitle: "Wholesale pricing, negotiated on WhatsApp.",
  wholesaleSubtext:
    "Tiered bulk discounts, split payments, dedicated account manager — chat with us to get a quote for your shop.",
};

export async function GET() {
  try {
    const session = await requireStaffSession();
    requirePermission(session, "settings.view");

    if (!hasDatabase) return NextResponse.json(apiSuccess(DEFAULTS));

    const row = await db.siteSettings.findUnique({ where: { key: "default" } });
    return NextResponse.json(
      apiSuccess(row ? {
        storeName: row.storeName,
        storeEmail: row.storeEmail,
        storePhone: row.storePhone,
        storeWhatsapp: row.storeWhatsapp,
        storeAddress: row.storeAddress,
        bankNumber: row.bankNumber,
        bankAccountName: row.bankAccountName,
        bankName: row.bankName,
        returnWindowDays: row.returnWindowDays,
        rcNumber: row.rcNumber || DEFAULTS.rcNumber,
        // Show the effective value in the form: NULL → the built-in default, an
        // empty string → keep it empty (admin deliberately hid it).
        socialInstagram: row.socialInstagram ?? DEFAULTS.socialInstagram,
        socialTwitter: row.socialTwitter ?? DEFAULTS.socialTwitter,
        socialTiktok: row.socialTiktok ?? DEFAULTS.socialTiktok,
        wholesaleTitle: row.wholesaleTitle || DEFAULTS.wholesaleTitle,
        wholesaleSubtext: row.wholesaleSubtext || DEFAULTS.wholesaleSubtext,
      } : DEFAULTS),
    );
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await requireStaffSession();
    requirePermission(session, "settings.edit");

    const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      throw new ValidationError({ body: parsed.error.issues[0]?.message ?? "Invalid" });
    }

    if (!hasDatabase) {
      return NextResponse.json(apiSuccess({ saved: false, reason: "no_db" }));
    }

    const before = await db.siteSettings.findUnique({ where: { key: "default" } });

    const d = parsed.data;
    const updated = await db.siteSettings.upsert({
      where: { key: "default" },
      create: {
        key: "default",
        ...(d.storeName !== undefined && { storeName: d.storeName }),
        ...(d.storeEmail !== undefined && { storeEmail: d.storeEmail }),
        ...(d.storePhone !== undefined && { storePhone: d.storePhone }),
        ...(d.storeWhatsapp !== undefined && { storeWhatsapp: d.storeWhatsapp }),
        ...(d.storeAddress !== undefined && { storeAddress: d.storeAddress }),
        ...(d.bankNumber !== undefined && { bankNumber: d.bankNumber }),
        ...(d.bankAccountName !== undefined && { bankAccountName: d.bankAccountName }),
        ...(d.bankName !== undefined && { bankName: d.bankName }),
        ...(d.returnWindowDays !== undefined && { returnWindowDays: d.returnWindowDays }),
        ...(d.rcNumber !== undefined && { rcNumber: d.rcNumber }),
        ...(d.socialInstagram !== undefined && { socialInstagram: d.socialInstagram }),
        ...(d.socialTwitter !== undefined && { socialTwitter: d.socialTwitter }),
        ...(d.socialTiktok !== undefined && { socialTiktok: d.socialTiktok }),
        ...(d.wholesaleTitle !== undefined && { wholesaleTitle: d.wholesaleTitle }),
        ...(d.wholesaleSubtext !== undefined && { wholesaleSubtext: d.wholesaleSubtext }),
      },
      update: {
        ...(d.storeName !== undefined && { storeName: d.storeName }),
        ...(d.storeEmail !== undefined && { storeEmail: d.storeEmail }),
        ...(d.storePhone !== undefined && { storePhone: d.storePhone }),
        ...(d.storeWhatsapp !== undefined && { storeWhatsapp: d.storeWhatsapp }),
        ...(d.storeAddress !== undefined && { storeAddress: d.storeAddress }),
        ...(d.bankNumber !== undefined && { bankNumber: d.bankNumber }),
        ...(d.bankAccountName !== undefined && { bankAccountName: d.bankAccountName }),
        ...(d.bankName !== undefined && { bankName: d.bankName }),
        ...(d.returnWindowDays !== undefined && { returnWindowDays: d.returnWindowDays }),
        ...(d.rcNumber !== undefined && { rcNumber: d.rcNumber }),
        ...(d.socialInstagram !== undefined && { socialInstagram: d.socialInstagram }),
        ...(d.socialTwitter !== undefined && { socialTwitter: d.socialTwitter }),
        ...(d.socialTiktok !== undefined && { socialTiktok: d.socialTiktok }),
        ...(d.wholesaleTitle !== undefined && { wholesaleTitle: d.wholesaleTitle }),
        ...(d.wholesaleSubtext !== undefined && { wholesaleSubtext: d.wholesaleSubtext }),
      },
    });

    await writeAudit({
      actorUserId: session.id,
      actorType: "staff",
      action: "settings.update",
      entityType: "site_settings",
      entityId: "default",
      before: before ?? {},
      after: parsed.data,
    });

    return NextResponse.json(apiSuccess({ saved: true, settings: updated }));
  } catch (err) {
    return handleApiError(err);
  }
}
