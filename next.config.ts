import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow phones and alternate loopback hosts to load Next's development-only
  // client bundles. Without this, those clients receive a 403 and every
  // client-side control appears inert because React cannot hydrate.
  allowedDevOrigins: [
    "127.0.0.1",
    "*.local",
    "10.*.*.*",
    "172.*.*.*",
    "192.168.*.*",
  ],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "image.tmdb.org", pathname: "/t/p/**" },
    ],
  },
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
