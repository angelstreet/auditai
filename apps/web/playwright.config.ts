import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for the employee mobile survey (PRD \u00a716).
 *
 * The base project targets a 360 px wide viewport, the minimum mobile size in the PRD. We boot
 * the production build (`next start`) so the test exercises the same code path the deploy will
 * run; CI uses port 3200 to avoid collisions with other workspace services on 3100.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
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
  ],
});
