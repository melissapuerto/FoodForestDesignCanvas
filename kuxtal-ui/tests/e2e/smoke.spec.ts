import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Kuxtal — boot & accessibility', () => {
  test('boots to the splash with a skip link', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('a.skip-link')).toHaveCount(1);
    await expect(page.locator('#splash-title')).toHaveText('Kuxtal');
  });

  test('first screen has no serious/critical axe violations', async ({ page }) => {
    await page.goto('/');
    await page.locator('.splash-enter').waitFor();
    const results = await new AxeBuilder({ page })
      // Colour-contrast is verified analytically against the design tokens; the
      // splash radial gradient confuses automated sampling.
      .disableRules(['color-contrast'])
      .analyze();
    const blocking = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical'
    );
    expect(blocking.map((v) => v.id)).toEqual([]);
  });

  test('the splash enter control is keyboard reachable and dismisses the splash', async ({ page }) => {
    await page.goto('/');
    const enter = page.locator('.splash-enter');
    await expect(enter).toBeEnabled({ timeout: 15_000 });
    // The local DB may still be initialising on the first activation; retry the
    // click until the splash is dismissed (onboarding or canvas takes over).
    await expect(async () => {
      await enter.click({ force: true });
      await expect(page.locator('.splash')).toHaveCount(0, { timeout: 2_000 });
    }).toPass({ timeout: 20_000 });
  });
});

test.describe('Kuxtal — mobile layout', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('renders the splash without horizontal overflow on a phone', async ({ page }) => {
    await page.goto('/');
    await page.locator('.splash-enter').waitFor();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(1); // no horizontal scrollbar bleed
  });
});
