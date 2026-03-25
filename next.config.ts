import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
});

export default withPWA({
  reactStrictMode: true,
  // Explicitly declare Turbopack config so Next.js 16 doesn't error on the
  // webpack config that @ducanh2912/next-pwa injects (PWA SW is built at
  // production build time, not during Turbopack dev server).
  turbopack: {},
});
