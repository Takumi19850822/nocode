import type { NextConfig } from "next";
import { getDeploymentId, initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
  // デプロイごとに HTML / CSS の参照を更新（Cloudflare キャッシュずれ防止）
  deploymentId: process.env.CF_PAGES_COMMIT_SHA ?? getDeploymentId(),
};

export default nextConfig;

if (process.env.NODE_ENV === "development") {
  initOpenNextCloudflareForDev();
}
