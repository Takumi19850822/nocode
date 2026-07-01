import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Cloudflare Pages 向け */
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
