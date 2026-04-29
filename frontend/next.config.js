/** @type {import('next').NextConfig} */
const backendUrl = (process.env.BACKEND_INTERNAL_URL || "http://127.0.0.1:8000").replace(
  /\/$/,
  ""
);

const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  allowedDevOrigins: ["192.168.65.75", "127.0.0.1", "localhost"],
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/:path*`
      }
    ];
  }
};

module.exports = nextConfig;
