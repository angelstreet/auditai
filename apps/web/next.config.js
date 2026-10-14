/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // No PWA / no extra instrumentation: M5 only renders the employee mobile survey.
  },
};

module.exports = nextConfig;
