/** @type {import('next').NextConfig} */
const nextConfig = {
  // PWA service worker and manifest are served from /public.
  // Keep config minimal and readable (Section 1: clarity over cleverness).
  reactStrictMode: true,
  experimental: {
    // Allow screenshot/file uploads through Server Actions.
    serverActions: { bodySizeLimit: "8mb" },
  },
};

export default nextConfig;
