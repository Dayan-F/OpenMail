import type { NextConfig } from "next";

// Server actions reject any request whose Origin isn't listed here. Entries are
// hosts without a scheme — VERCEL_URL already arrives in that shape, and
// APP_ORIGIN is normalised in case it's pasted as a full URL.
const allowedOrigins = ["localhost:3000", process.env.APP_ORIGIN, process.env.VERCEL_URL]
  .filter((origin): origin is string => Boolean(origin))
  .map((origin) => origin.replace(/^https?:\/\//, "").replace(/\/$/, ""));

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins,
    },
  },
};

export default nextConfig;
