import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "./providers";
import { SiteHeader } from "./site-header";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Suiki — Loyalty on SUI",
  description: "Merchant loyalty stamp cards powered by SUI blockchain",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Suiki",
  },
};

/**
 * Viewport configuration for mobile-first PWA.
 *
 * maximumScale: 1 / userScalable: false — prevents iOS Safari from zooming
 * in on form inputs (font-size < 16px triggers auto-zoom, which breaks the
 * stamp card UI layout). Trade-off: intentional pinch-zoom is also disabled,
 * which is acceptable for a transactional PWA where every screen is a focused
 * task (QR scan, stamp count, redeem confirmation).
 *
 * themeColor matches --color-primary and manifest theme_color so the browser
 * chrome (Android top bar) stays consistent from install through runtime.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#3b82f6",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>
          {/* Sticky site header — SiteHeader is a Client Component because
              ConnectWallet uses hooks. Extracting it keeps RootLayout as a
              Server Component so metadata and viewport exports work. */}
          <SiteHeader />

          {/* pt-16 offsets the fixed header height (h-16 = 4rem) */}
          <div className="flex-1 pt-16">
            {children}
          </div>
        </Providers>
      </body>
    </html>
  );
}
