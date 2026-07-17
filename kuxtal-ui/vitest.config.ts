import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { svelteTesting } from '@testing-library/svelte/vite';

// Standalone test config (does NOT extend vite.config.ts) so the PWA plugin and
// its `virtual:pwa-register` import don't need to resolve under the test runner.
export default defineConfig({
  plugins: [
    svelte({
      hot: false,
      // svelte.config.js forces `runes: true` globally, which breaks Testing
      // Library's internal scaffold component (it uses legacy `export let`).
      // Let dependencies under node_modules compile in auto-detected mode.
      dynamicCompileOptions({ filename }) {
        if (filename.includes('node_modules')) return { runes: false };
      }
    }),
    svelteTesting()
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    // Unit + component/a11y only. The Playwright E2E specs in tests/e2e are run
    // by `npm run test:e2e`, not Vitest.
    include: ['tests/unit/**/*.{test,spec}.{ts,js}', 'tests/a11y/**/*.{test,spec}.{ts,js}'],
    exclude: ['tests/e2e/**', 'node_modules/**'],
    css: true,
  },
  resolve: {
    // Use the browser build of Svelte so components render client-side in jsdom.
    conditions: ['browser'],
  },
});
