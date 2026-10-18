/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    // M10: server actions import Zod schemas from @evolai/contracts, whose source uses
    // NodeNext-style `.js` import specifiers. Webpack does not rewrite those to `.ts`, so
    // we transpile the package from source. (M3 + M5 + M6 + M7 + M8 did not exercise this
    // path because the server action layer only landed in M10.)
    '@evolai/contracts',
    '@evolai/domain',
    // TASK-C: web imports catalogs from @evolai/i18n and mascots from @evolai/ui; both are
    // consumed from source with NodeNext-style specifiers.
    '@evolai/i18n',
    '@evolai/ui',
  ],
  webpack(config) {
    // The contracts / domain packages use NodeNext import specifiers (`./team.js`). Webpack
    // resolves them literally. Tell it to fall back to the TypeScript source.
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias ?? {}),
      '.js': ['.ts', '.tsx', '.js'],
      '.jsx': ['.tsx', '.jsx'],
    };
    return config;
  },
  experimental: {
    // No PWA / no extra instrumentation: M5 only renders the employee mobile survey.
  },
};

module.exports = nextConfig;
