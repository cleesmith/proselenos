import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Increase body size limit to allow larger file uploads
      // You can adjust this value based on your needs
      bodySizeLimit: '50mb'
    }
  }
};

export default nextConfig;