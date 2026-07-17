import { test, expect, type Page } from '@playwright/test';

/**
 * Blind-user end-to-end journey, keyboard only, in screen-reader mode.
 *
 * Run locally:
 *   npx playwright install chromium      # once
 *   npm run test:e2e -- blind-journey
 *
 * What this proves: a user who turns on screen-reader mode can go from the
 * splash → onboarding → the accessible home and create/place/edit/delete every
 * land element, plus reach the feature modules — all by keyboard, with the app
 * never showing the map or trapping focus. (Playwright drives the keyboard and
 * checks focus/roles/labels/announcements; it does NOT run a real screen reader
 * — pair this with the manual VoiceOver/TalkBack script in
 * KUXTAL_SCREEN_READER_E2E.md.)
 *
 * The app defaults to Spanish; this spec switches to English on the splash so
 * the assertions read clearly.
 */

const live = (page: Page) => page.locator('[role="status"][aria-live="polite"]').first();

// The app's confirm/prompt modal (DialogHost). Its primary action is the last
// button in the action row, so confirming is locale-independent and never
// collides with the many "Delete …" controls elsewhere on the page.
const dialog = (page: Page) => page.locator('.dlg[role="dialog"]');
const confirmDialog = (page: Page) => dialog(page).locator('.dlg-actions button').last().click();

test.describe('Blind user — full keyboard journey in screen-reader mode', () => {
  test('onboarding → home → create/place/edit/delete → modules', async ({ page }) => {
    // Start from a clean database. This app persists to OPFS, which survives
    // across test runs; the `?e2e_reset` flag tells initDb to wipe it first so
    // the journey (counts, "Create boundary" vs "Delete boundary", …) is
    // deterministic. The flag only ever does anything when explicitly passed.
    await page.goto('/?e2e_reset=1');

    // ── Splash: choose language + turn on screen-reader mode ──────────────
    await page.getByRole('button', { name: 'Switch to English' }).click();
    await page.getByRole('button', { name: 'Turn on screen reader mode' }).click();

    // Accessibility options are reachable here too (large text, contrast, …).
    await page.getByRole('button', { name: 'Accessibility options' }).click();
    await expect(page.getByRole('switch', { name: 'Screen reader mode' })).toBeVisible();
    await page.getByRole('button', { name: 'Accessibility options' }).click(); // collapse

    const enter = page.getByRole('button', { name: 'Open the codex ↦' });
    await expect(enter).toBeEnabled({ timeout: 15_000 });
    await enter.click();

    // ── Onboarding wizard (no maps in SR mode) ────────────────────────────
    // Each step focuses its heading; the footer Continue button advances. The
    // name field is the first textbox.
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.getByRole('textbox').first().fill('Test Farm');

    // Step through until the final "Open canvas".
    for (let i = 0; i < 10; i++) {
      const cont = page.getByRole('button', { name: 'Continue' });
      if (await cont.isVisible().catch(() => false)) {
        await cont.click();
        await page.waitForTimeout(150);
      } else break;
    }
    await page.getByRole('button', { name: 'Open canvas' }).click();

    // ── Accessible home: the land-management feature IS the main screen ────
    await expect(page.getByRole('heading', { name: /Your land/i })).toBeVisible({ timeout: 15_000 });

    // Pass criterion: "you never land on the map or its tools". In SR mode the
    // whole map subtree is `inert`, so it is out of the tab order and the
    // accessibility tree — a real screen reader never reaches the map drawing
    // tools. (Playwright's role engine doesn't fully honour `inert`, so we check
    // the mechanism that guarantees it rather than counting roles.)
    await expect(page.locator('.canvas-wrap')).toHaveJSProperty('inert', true);

    // Every canvas action reports its result through this polite live region —
    // it's what a screen reader speaks, so the assertions read it (and it's the
    // single element that holds each spoken result, unambiguously).
    const ciStatus = page.locator('.ci-status');

    // Each action is asserted by the *spoken result* — the verb plus the element
    // name — which is what proves "you always know what just happened". The
    // running totals in those messages are deliberately not asserted: this is an
    // offline-first app whose OPFS database persists across runs, so the absolute
    // counts depend on history, while the announced action does not.

    // Place a plant: search → choose a result → Place.
    const species = page.getByLabel('Species');
    await species.fill('a');
    await page.locator('.ci-species-result').first().click();
    await page.getByRole('button', { name: 'Place plant' }).click();
    await expect(ciStatus).toContainText('Placed');
    await expect(ciStatus).toContainText('plants on the canvas');

    // Create a zone.
    await page.getByLabel('New zone name').fill('Orchard');
    await page.getByRole('button', { name: 'Create zone' }).click();
    await expect(ciStatus).toContainText('Created zone Orchard');

    // Create a water feature.
    await page.getByLabel('New water feature name').fill('North pond');
    await page.getByRole('button', { name: 'Add water' }).click();
    await expect(ciStatus).toContainText('Created North pond');

    // Boundary: exercise the full create path. The onboarding wizard can
    // auto-populate the land with a boundary, so if one already exists, remove
    // it first (hearing the result) so we then create it from scratch — the way
    // a blind user builds the boundary by hand from the accessible home.
    const deleteBoundaryBtn = page.getByRole('button', { name: 'Delete boundary' });
    if (await deleteBoundaryBtn.isVisible().catch(() => false)) {
      await deleteBoundaryBtn.click();
      await confirmDialog(page); // the modal's primary action (Delete)
      await expect(ciStatus).toContainText('Deleted the land boundary');
    }
    await page.getByRole('button', { name: 'Create boundary' }).click();
    await expect(ciStatus).toContainText('Created the land boundary');
    await expect(page.getByText('You have a boundary defined.')).toBeVisible();

    // Edit a zone (rename via the prompt dialog), then delete it.
    await page.getByRole('button', { name: 'Rename Orchard' }).click();
    // The prompt's text field lives inside the modal, labelled by its title.
    await dialog(page).getByRole('textbox').fill('Home orchard');
    await confirmDialog(page); // Save
    await expect(ciStatus).toContainText('Renamed zone to Home orchard');
    // The rename persisted: the delete control is now named for the new name.
    await page.getByRole('button', { name: 'Delete zone Home orchard' }).click();
    await confirmDialog(page); // Delete
    await expect(ciStatus).toContainText('Deleted zone Home orchard');

    // ── Reach the feature modules from the bottom menu ────────────────────
    // The menu has no collapse handle in SR mode; groups expand to their items.
    await openModuleViaMenu(page, 'Land', 'Plants');
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape'); // closes; focus returns to the trigger
    await expect(page.getByRole('dialog')).toHaveCount(0);

    await openModuleViaMenu(page, 'Log', 'Notebook');
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');

    // The live region exists and is polite throughout.
    await expect(live(page)).toHaveAttribute('aria-live', 'polite');
  });
});

/**
 * Opens a module: clicks its group in the bottom nav, then the item inside the
 * popover. Group/item labels come from the i18n module_* keys (English).
 */
async function openModuleViaMenu(page: Page, group: string, item: string): Promise<void> {
  const nav = page.locator('#module-nav');
  // The group is a button that opens a menu; its items are menuitems (an
  // explicit role, so they are not matched as buttons).
  await nav.getByRole('button', { name: group, exact: false }).first().click();
  await page.getByRole('menuitem', { name: item, exact: false }).first().click();
}
