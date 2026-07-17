import '@testing-library/jest-dom/vitest';
import { ensureLocaleLoaded } from '../src/lib/i18n/translate';

// The English dictionary is a lazy chunk in production. Load it before any
// test runs so setLocale('en') flips synchronously, as it does in a warm app.
await ensureLocaleLoaded('en');
import axe from 'axe-core';

/**
 * Run axe against a rendered container. Colour-contrast is disabled here because
 * jsdom has no real layout/paint engine — contrast is verified instead in the
 * Playwright suite, which renders in a real browser.
 */
export async function expectNoA11yViolations(node: Element): Promise<void> {
  const results = await axe.run(node as any, {
    rules: { 'color-contrast': { enabled: false } }
  });
  if (results.violations.length) {
    const summary = results.violations
      .map((v) => `- [${v.id}] ${v.help} (${v.nodes.length} node(s))`)
      .join('\n');
    throw new Error(`axe found ${results.violations.length} violation(s):\n${summary}`);
  }
}
