/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ["images.unsplash.com"],
  },
  transpilePackages: [
    "@headless/types",
    "@headless/utils",
    "@headless/auth",
    "@headless/database",
    "@headless/providers",
    "@headless/ui",
  ],
};

module.exports = nextConfig;
