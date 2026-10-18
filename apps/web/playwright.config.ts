import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for the web app (PRD §16, TASK-G).
 *
 * The base project targets a 360 px wide viewport, the minimum mobile size in the PRD. We boot
 * the production build (`next start`) so the test exercises the same code path the deploy will
 * run. `e2e/serve.mjs` is the single, deterministic startup path: database, migrations, build,
 * server. With `DATABASE_URL` set (CI service container) it uses that database, otherwise an
 * embedded PostgreSQL 17.
 */

// Parallel agents share this host: override the port with PW_PORT to avoid reusing another
// checkout's server.
const PORT = process.env['PW_PORT'] ?? '3200';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  reporter: process.env['CI'] ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  webServer: {
    // e2e/serve.mjs boots the database (embedded unless DATABASE_URL is set), migrates, builds and
    // starts the app with the test env. Playwright starts webServer before globalSetup, so no
    // global setup is used.
    command: 'node e2e/serve.mjs',
    url: `http://127.0.0.1:${PORT}/login`,
    reuseExistingServer: false,
    timeout: 600_000,
    gracefulShutdown: { signal: 'SIGTERM', timeout: 15_000 },
    stdout: 'pipe',
    stderr: 'pipe',
  },
  projects: [
    {
      name: 'mobile-360',
      use: {
        ...devices['Pixel 5'],
        viewport: { width: 360, height: 800 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: 'tablet-768',
      use: {
        viewport: { width: 768, height: 1024 },
      },
    },
    {
      name: 'desktop-admin',
      use: {
        viewport: { width: 1280, height: 800 },
      },
    },
  ],
});
