import type { NextConfig } from "next";

const replitDevDomain = process.env.REPLIT_DEV_DOMAIN;

const nextConfig: NextConfig = {
  serverExternalPackages: ["argon2"],
  ...(replitDevDomain && {
    allowedDevOrigins: [replitDevDomain],
  }),
};

export default nextConfig;
