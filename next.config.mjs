/** @type {import('next').NextConfig} */
//
// `next/image` only loads from explicitly-allowlisted hosts. We pick up the
// R2 public host from R2_PUBLIC_URL at build time so deployments to a new
// bucket don't need a code edit.
const r2Host = (() => {
  try {
    return process.env.R2_PUBLIC_URL ? new URL(process.env.R2_PUBLIC_URL).hostname : null;
  } catch {
    return null;
  }
})();

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  allowedDevOrigins: ["cbf2-102-214-14-5.ngrok-free.app"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "picsum.photos" },
      {
        // Avmall's legacy Bumpa CDN — used by migrated product rows until
        // they're re-uploaded to R2.
        protocol: "https",
        hostname: "dodptt9f4zk9h.cloudfront.net",
      },
      // Generic R2 public-dev URLs (when the bucket is set to public via
      // pub-<hash>.r2.dev rather than a custom domain).
      { protocol: "https", hostname: "*.r2.dev" },
      // Specific host from R2_PUBLIC_URL — covers custom domains too.
      ...(r2Host ? [{ protocol: "https", hostname: r2Host }] : []),
    ],
  },
};

export default nextConfig;
