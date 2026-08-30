import type { NextConfig } from "next";

// 部署到子路径（如 https://ldcx.tech/vibehard）时，在构建前设置 NEXT_PUBLIC_BASE_PATH=/vibehard；
// 本地开发不设置即为根路径。standalone 输出用于以 `node server.js` 运行精简生产服务。
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: "standalone",
  ...(basePath ? { basePath } : {}),
};

export default nextConfig;
