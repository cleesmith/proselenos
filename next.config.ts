import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Increase body size limit to 5MB to allow larger file uploads
      // You can adjust this value based on your needs
      bodySizeLimit: '5mb'
    }
  }
};

export default nextConfig;