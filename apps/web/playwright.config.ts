import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for the employee mobile survey (PRD \u00a716).
 *
 * The base project targets a 360 px wide viewport, the minimum mobile size in the PRD. We boot
 * the production build (`next start`) so the test exercises the same code path the deploy will
 * run.
 *
 * M8: `e2e/global-setup.ts` boots an embedded PostgreSQL 17, applies the M4 migrations,
 * seeds the synthetic tenants, and writes the resolved `DATABASE_URL` to the parent process
 * environment. The `webServer` block inherits it from the parent. The same convention
 * (`tests/db/src/global-setup.ts`) is used by the unit-test suite.
 *
 * If `DATABASE_URL` is already in the environment (CI service container, developer-supplied
 * Postgres), `global-setup.ts` short-circuits and we trust it.
 */

export default defineConfig({
  testDir: './e2e',
  testIgnore: ['**/global-setup.ts', '**/global-teardown.ts'],
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  reporter: process.env['CI'] ? 'github' : 'list',
  use: {
    baseURL: 'http://127.0.0.1:3200',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'pnpm exec next start --port 3200',
    url: 'http://127.0.0.1:3200',
    reuseExistingServer: !process.env['CI'],
    timeout: 120_000,
    env: {
      // DATABASE_URL is inherited from the parent process. global-setup.ts sets it
      // before this webServer is spawned. SURVEY_SIGNING_SECRET inherits too so the
      // sign/verify pair agree end-to-end.
    },
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
      name: 'desktop-admin',
      use: {
        viewport: { width: 1280, height: 800 },
      },
    },
  ],
});
