import "./src/env.ts"; // validate env at build time
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
});

const securityHeaders = [
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(), geolocation=()",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline'", // Next.js requires unsafe-eval in dev
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self'",
      "connect-src 'self' https://fullnode.testnet.sui.io https://fullnode.mainnet.sui.io https://fullnode.devnet.sui.io wss://fullnode.testnet.sui.io",
    ].join("; "),
  },
];

export default withPWA({
  reactStrictMode: true,
  // Explicitly declare Turbopack config so Next.js 16 doesn't error on the
  // webpack config that @ducanh2912/next-pwa injects (PWA SW is built at
  // production build time, not during Turbopack dev server).
  turbopack: {},
  headers: async () => [
    {
      source: "/(.*)",
      headers: securityHeaders,
    },
  ],
});
