// @ts-ignore — next-pwa v5 doesn't ship types for Next.js 16, but works at runtime
const withPWA = require("next-pwa")({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
});

export default withPWA({
  reactStrictMode: true,
});
