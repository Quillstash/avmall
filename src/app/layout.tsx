import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Fraunces } from "next/font/google";
import { Providers } from "@/components/providers";
import { SITE, SITE_KEYWORDS } from "@/lib/site";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: `${SITE.legalName} · ${SITE.name}`,
    template: `%s · ${SITE.name}`,
  },
  description: SITE.description,
  applicationName: SITE.name,
  authors: [{ name: SITE.legalName }],
  generator: "Next.js",
  keywords: SITE_KEYWORDS,
  referrer: "origin-when-cross-origin",
  creator: SITE.legalName,
  publisher: SITE.legalName,
  formatDetection: { email: false, address: false, telephone: false },
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: SITE.locale,
    url: SITE.url,
    siteName: SITE.legalName,
    title: `${SITE.legalName} · ${SITE.name}`,
    description: SITE.description,
    // OG image auto-wired from src/app/opengraph-image.png (Next.js file convention)
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE.legalName} · ${SITE.name}`,
    description: SITE.description,
    // Image auto-wired from src/app/opengraph-image.png
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-video-preview": -1,
      "max-snippet": -1,
    },
  },
  // Icons auto-wired from src/app/icon.png + src/app/apple-icon.png (file conventions)
  manifest: "/manifest.webmanifest",
  category: "shopping",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: SITE.themeColor },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} ${fraunces.variable}`}
    >
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
