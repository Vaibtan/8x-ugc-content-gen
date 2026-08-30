import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    // The framework default is 1 MB. Short MediaRecorder answers need a small,
    // explicit multipart budget while the client still caps each upload at 8 MB.
    serverActions: { bodySizeLimit: "8mb" },
  },
};

export default nextConfig;
