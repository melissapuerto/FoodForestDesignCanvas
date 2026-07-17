import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end config. Boots the Vite dev server (which sets the COOP/COEP headers
 * the SQLite-WASM / OPFS layer needs) and runs the specs in tests/e2e.
 *
 * Browsers: `npx playwright install chromium` once. In a fresh Linux CI you may
 * also need `npx playwright install-deps chromium` for the system libraries.
 */
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173',
    headless: true,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure'
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
    { name: 'mobile', use: { ...devices['Pixel 5'] } }
  ],
  webServer: {
    command: 'npm run dev -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000
  }
});
