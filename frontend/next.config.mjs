/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Docker image uses standalone; Vercel GitHub deploys must NOT.
  ...(process.env.DOCKER_BUILD === "1" ? { output: "standalone" } : {}),
  images: {
    remotePatterns: [
      { protocol: "http", hostname: "localhost" },
      { protocol: "http", hostname: "127.0.0.1" },
      { protocol: "https", hostname: "**" },
    ],
  },
};

export default nextConfig;
