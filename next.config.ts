import type { NextConfig } from "next";

const repoName = "age3-shinshohin-tool";

const nextConfig: NextConfig = {
  // GitHub Pages に静的サイトとして書き出す
  output: "export",
  // https://klobal001-glitch.github.io/age3-shinshohin-tool/ 配下で配信されるため
  basePath: `/${repoName}`,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
