/**
 * Cloudflare R2 client. S3-compatible, accessed via the AWS SDK with R2's
 * custom endpoint.
 *
 *   region: "auto" — R2 is single-region from the SDK's perspective
 *   endpoint: https://<accountId>.r2.cloudflarestorage.com
 *
 * Two upload paths are exposed:
 *
 *   1. `putObject(key, body, contentType)` — server-side direct PUT. Use when
 *      the file has already passed through our /upload endpoint so we can
 *      re-encode + EXIF-strip with sharp before storing. This is the path
 *      everything goes through today.
 *
 *   2. `generateUploadUrl(key, contentType)` — presigned PUT URL for the
 *      browser to upload directly to R2. Faster for very large files where
 *      streaming through Next is wasteful. Not used yet; available if we
 *      need it.
 *
 * Public URL pattern: `${R2_PUBLIC_URL}/${key}`. R2 doesn't serve public
 * objects unless the bucket has the "Public Access" toggle on (or a custom
 * domain bound). The R2_PUBLIC_URL env handles that — set it to either the
 * `pub-<hash>.r2.dev` URL or your custom domain.
 */

import "server-only";

import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";

/** True when every required R2 env var is set. */
export const r2Configured: boolean =
  !!env.R2_ACCOUNT_ID &&
  !!env.R2_ACCESS_KEY_ID &&
  !!env.R2_SECRET_ACCESS_KEY &&
  !!env.R2_BUCKET_NAME &&
  !!env.R2_PUBLIC_URL;

let _client: S3Client | null = null;

function client(): S3Client {
  if (!r2Configured) {
    throw new AppError(
      "R2_NOT_CONFIGURED",
      "R2 credentials missing — set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME and R2_PUBLIC_URL.",
      503,
    );
  }
  if (_client) return _client;
  _client = new S3Client({
    region: "auto",
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID!,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
    },
  });
  return _client;
}

function bucket(): string {
  return env.R2_BUCKET_NAME!;
}

/** Compose the public URL for a given key. */
export function getPublicUrl(key: string): string {
  if (!env.R2_PUBLIC_URL) {
    throw new AppError("R2_NOT_CONFIGURED", "R2_PUBLIC_URL is not set", 503);
  }
  return `${env.R2_PUBLIC_URL.replace(/\/+$/, "")}/${key}`;
}

/** Single canonical key shape — never improvise key names at the callsite. */
export function productImageKey(productId: string, ext: string): string {
  const safeExt = ext.replace(/[^a-z0-9]/gi, "").toLowerCase() || "webp";
  const uuid = crypto.randomUUID();
  return `products/${productId}/${uuid}.${safeExt}`;
}

export function returnPhotoKey(returnId: string, ext: string): string {
  const safeExt = ext.replace(/[^a-z0-9]/gi, "").toLowerCase() || "webp";
  return `returns/${returnId}/${crypto.randomUUID()}.${safeExt}`;
}

/** CMS content images (About CTA, Journal covers). `scopeId` = page key / slug. */
export function contentImageKey(scopeId: string, ext: string): string {
  const safeExt = ext.replace(/[^a-z0-9]/gi, "").toLowerCase() || "webp";
  const safeScope = scopeId.replace(/[^a-z0-9-]/gi, "").toLowerCase() || "page";
  return `content/${safeScope}/${crypto.randomUUID()}.${safeExt}`;
}

/** Direct server-side upload. Body is a Buffer (already re-encoded). */
export async function putObject(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<{ key: string; publicUrl: string }> {
  await client().send(
    new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      Body: body,
      ContentType: contentType,
      // Long-cache aggressive — images are content-addressed via UUID-in-key
      // so they never change in place. New uploads get new keys.
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );
  return { key, publicUrl: getPublicUrl(key) };
}

/** Presigned PUT URL — browser uploads directly. Use only for >5 MB files. */
export async function generateUploadUrl(
  key: string,
  contentType: string,
): Promise<{ uploadUrl: string; key: string; publicUrl: string }> {
  const url = await getSignedUrl(
    client(),
    new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      ContentType: contentType,
    }),
    { expiresIn: 3600 },
  );
  return { uploadUrl: url, key, publicUrl: getPublicUrl(key) };
}

/** Best-effort delete. Failures are logged but don't throw — the row is
 *  authoritative; an orphaned object is cheaper than a broken UI. */
export async function deleteObject(key: string): Promise<void> {
  try {
    await client().send(
      new DeleteObjectCommand({ Bucket: bucket(), Key: key }),
    );
  } catch (err) {
    console.error("[r2] delete failed:", key, err);
  }
}
