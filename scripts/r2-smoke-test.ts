/**
 * One-off smoke test for the R2 setup.
 *
 *   pnpm dotenv -e .env.local -- tsx scripts/r2-smoke-test.ts
 *
 * Steps:
 *   1. Validate env vars are present
 *   2. Build a tiny WebP in-memory
 *   3. PUT it to R2 under a temp key
 *   4. HEAD the public URL — confirms public access is on AND the host is right
 *   5. DELETE the object — leaves no garbage behind
 *
 * Reports clean ✓ / ✗ at every step so a failure is obvious.
 */

import sharp from "sharp";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";

const NEED = [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET_NAME",
  "R2_PUBLIC_URL",
] as const;

const C = {
  ok: "\x1b[32m✓\x1b[0m",
  fail: "\x1b[31m✗\x1b[0m",
  info: "\x1b[36m·\x1b[0m",
  dim: "\x1b[2m",
  reset: "\x1b[0m",
};

function bail(msg: string, err?: unknown): never {
  console.error(`${C.fail} ${msg}`);
  if (err) console.error(`  ${C.dim}${err}${C.reset}`);
  process.exit(1);
}

async function main() {
  console.log("R2 smoke test\n");

  // 1. Env check
  for (const k of NEED) {
    if (!process.env[k]) bail(`${k} is not set`);
  }
  console.log(`${C.ok} env vars present`);

  const accountId = process.env.R2_ACCOUNT_ID!;
  const bucket = process.env.R2_BUCKET_NAME!;
  const publicBase = process.env.R2_PUBLIC_URL!.replace(/\/+$/, "");

  // Parse + report the public URL host so the user can sanity-check.
  let publicHost = "";
  try {
    publicHost = new URL(publicBase).hostname;
  } catch (err) {
    bail("R2_PUBLIC_URL doesn't parse as a URL", err);
  }
  console.log(`${C.info} bucket: ${bucket}`);
  console.log(`${C.info} public host: ${publicHost}`);

  const client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });

  // 2. Build a tiny test WebP
  const png = await sharp({
    create: {
      width: 256,
      height: 256,
      channels: 3,
      background: { r: 32, g: 138, b: 232 }, // avmall blue
    },
  })
    .webp({ quality: 80 })
    .toBuffer();
  console.log(`${C.ok} built test WebP (${png.length} bytes)`);

  const key = `__smoke-tests__/r2-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.webp`;
  const publicUrl = `${publicBase}/${key}`;

  // 3. PUT
  try {
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: png,
        ContentType: "image/webp",
      }),
    );
  } catch (err) {
    bail(`PUT failed — check that the API token has Object Read & Write on "${bucket}"`, err);
  }
  console.log(`${C.ok} uploaded to s3://${bucket}/${key}`);

  // 4. HEAD via the S3 API (auth-protected) — confirms object exists
  try {
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
  } catch (err) {
    bail("HEAD on the bucket failed — bucket name or credentials wrong", err);
  }
  console.log(`${C.ok} HEAD via S3 API succeeds`);

  // 5. GET via the public URL — confirms public access is wired
  let publicOk = false;
  try {
    const res = await fetch(publicUrl, { method: "GET" });
    publicOk = res.ok;
    if (!res.ok) {
      console.error(
        `${C.fail} public GET ${publicUrl} returned ${res.status} ${res.statusText}`,
      );
      if (res.status === 401 || res.status === 403) {
        console.error(
          `  ${C.dim}→ Enable bucket public access: R2 → bucket → Settings → Public access → R2.dev subdomain → Allow Access${C.reset}`,
        );
      } else if (res.status === 404) {
        console.error(
          `  ${C.dim}→ R2_PUBLIC_URL might point at the wrong bucket. Compare it against the URL Cloudflare shows under Public Access.${C.reset}`,
        );
      }
    } else {
      const ct = res.headers.get("content-type");
      console.log(`${C.ok} public GET 200 (Content-Type: ${ct ?? "n/a"})`);
    }
  } catch (err) {
    console.error(`${C.fail} public GET threw`);
    console.error(`  ${C.dim}${err}${C.reset}`);
  }

  // 6. Clean up — best-effort
  try {
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    console.log(`${C.ok} cleaned up test object`);
  } catch (err) {
    console.error(`${C.fail} failed to delete test object (not fatal):`);
    console.error(`  ${C.dim}${err}${C.reset}`);
  }

  console.log();
  if (publicOk) {
    console.log(`${C.ok} R2 is wired correctly — admin uploads should work.`);
  } else {
    console.log(
      `${C.fail} Upload+auth works, but the public URL didn't resolve. Storefront images won't render until public access is on.`,
    );
    process.exit(2);
  }
}

main().catch((err) => bail("Unhandled error", err));
