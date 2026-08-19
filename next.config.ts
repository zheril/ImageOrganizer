import type { NextConfig } from "next";

const isTauri = !!process.env.TAURI_BUILD;

const nextConfig: NextConfig = {
  // For Tauri desktop builds, produce a fully static export in `out/` that the
  // Rust binary can embed. For web preview / dev server, keep standalone mode.
  output: isTauri ? "export" : "standalone",
  // Plain <img> tags are used everywhere — disable Next.js image optimization
  // so static export works (the optimizer needs a server).
  images: { unoptimized: true },
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Tauri serves the app from a custom protocol, so relative asset paths must
  // work without a base path. Keep trailingSlash off (default).
  trailingSlash: false,
};

export default nextConfig;
