import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // GitHub Pages serves a static bundle at https://chris-jaehoon.github.io/My-Record/
  output: "export",
  basePath: "/My-Record",
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
};

export default nextConfig;
