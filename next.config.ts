import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin({
  requestConfig: "./src/i18n/request.ts",
});

const nextConfig: NextConfig = {
  output: "standalone",
  reactCompiler: true,
  experimental: {
    serverSourceMaps: true,
  },
  async redirects() {
    return [
      {
        source: "/alevins",
        destination: "/reproduction",
        permanent: true,
      },
      {
        source: "/alevins/:path*",
        destination: "/reproduction/:path*",
        permanent: true,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
