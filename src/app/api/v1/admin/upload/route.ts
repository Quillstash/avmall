/**
 * POST /api/v1/admin/upload
 *
 * Server-side image upload pipeline:
 *   1. Validate MIME type by sniffing the magic bytes (don't trust the filename)
 *   2. Re-encode through sharp — strips EXIF (incl. GPS coords), normalises to
 *      WebP, caps the long edge at 2000px
 *   3. PUT to R2 with a long-cache header
 *   4. Return { key, publicUrl, width, height, bytes }
 *
 * Multipart form fields:
 *   file        : the image
 *   scope?      : "product" | "return"  (default "product")
 *   scopeId?    : product / return UUID — used in the R2 key path
 *
 * Permission: products.edit  (we'll relax this for returns when those start
 * needing photos)
 *
 * Limits enforced server-side:
 *   - max 8 MiB raw upload
 *   - JPEG / PNG / WebP only
 */

import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { requireStaffSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { putObject, productImageKey, returnPhotoKey, contentImageKey, r2Configured } from "@/lib/r2";
import { writeAudit } from "@/lib/audit";
import { apiSuccess, handleApiError } from "@/lib/api-response";
import { AppError, ValidationError } from "@/lib/errors";

export const runtime = "nodejs";
// Multipart bodies can be a few MB — give the route enough headroom.
export const maxDuration = 60;

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED_INPUT = new Set(["image/jpeg", "image/png", "image/webp"]);

/** Read the first few bytes and identify the format. Defends against a
 *  client claiming `image/webp` but sending a script. */
function sniffMime(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return "image/png";
  }
  // WEBP: RIFF....WEBP
  if (
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireStaffSession();
    requirePermission(session, "products.edit");

    if (!r2Configured) {
      throw new AppError(
        "R2_NOT_CONFIGURED",
        "R2 credentials missing — image upload is disabled in this environment.",
        503,
      );
    }

    const form = await req.formData();
    const file = form.get("file");
    const scope = (form.get("scope") as string | null) ?? "product";
    const scopeId = (form.get("scopeId") as string | null)?.trim() || "uncategorised";

    if (!(file instanceof File)) {
      throw new ValidationError({ file: "file is required (multipart/form-data)" });
    }
    if (file.size > MAX_BYTES) {
      throw new ValidationError({
        file: `Image is too large (max ${MAX_BYTES / 1024 / 1024} MiB)`,
      });
    }
    if (!ALLOWED_INPUT.has(file.type)) {
      throw new ValidationError({
        file: "Only JPEG, PNG, or WebP images are accepted",
      });
    }

    // Sniff the real type — don't trust the multipart header.
    const buf = Buffer.from(await file.arrayBuffer());
    const sniffed = sniffMime(buf);
    if (!sniffed || !ALLOWED_INPUT.has(sniffed)) {
      throw new ValidationError({
        file: "File doesn't look like a real JPEG / PNG / WebP image",
      });
    }

    // Re-encode through sharp. This strips ALL metadata (incl. GPS EXIF) by
    // default, and gives us a known-good WebP we can serve everywhere.
    const processed = await sharp(buf, { failOn: "error" })
      .rotate() // honour orientation EXIF before stripping it
      .resize({
        width: 2000,
        height: 2000,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 82, effort: 4 })
      .toBuffer({ resolveWithObject: true });

    const ext = "webp";
    const key =
      scope === "return"
        ? returnPhotoKey(scopeId, ext)
        : scope === "content"
          ? contentImageKey(scopeId, ext)
          : productImageKey(scopeId, ext);

    const stored = await putObject(key, processed.data, "image/webp");

    await writeAudit({
      actorUserId: session.id,
      actorType: "staff",
      action: "asset.upload",
      entityType: scope === "return" ? "return" : scope === "content" ? "content" : "product",
      entityId: scopeId,
      after: {
        key: stored.key,
        bytes: processed.data.length,
        width: processed.info.width,
        height: processed.info.height,
      },
    });

    return NextResponse.json(
      apiSuccess({
        key: stored.key,
        publicUrl: stored.publicUrl,
        width: processed.info.width,
        height: processed.info.height,
        bytes: processed.data.length,
        contentType: "image/webp",
      }),
      { status: 201 },
    );
  } catch (err) {
    return handleApiError(err);
  }
}
