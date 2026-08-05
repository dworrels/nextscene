import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    useTypeScriptCli: false,
    serverActions: {
      bodySizeLimit: "5mb",
    },
  },
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
