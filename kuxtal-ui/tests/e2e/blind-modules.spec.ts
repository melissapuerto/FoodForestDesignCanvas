import { test, expect, type Page } from '@playwright/test';

/**
 * Blind-user coverage of EVERY feature module, in screen-reader mode.
 *
 * Where blind-journey.spec.ts proves the core land-management loop, this spec
 * proves each bottom-menu module is *fully functional* without sight — not
 * just openable: it performs the primary action of every module (create /
 * toggle / delete), always through accessible names, labels and announced
 * results. It also covers the two flows this audit repaired:
 *   - Plants catalog → "Plant this species" routes into the accessible
 *     "Place a plant" flow (the map is inert in SR mode, so "tap the map"
 *     would be a dead end);
 *   - Community modals move focus in, trap it, and restore it on Escape.
 *
 * Run: npm run test:e2e -- blind-modules
 */

const toast = (page: Page) => page.locator('.toast-stack');
const ciStatus = (page: Page) => page.locator('.ci-status');

/** The app's confirm/prompt modal (DialogHost); confirm = last action button. */
const confirmDialog = (page: Page) =>
  page.locator('.dlg[role="dialog"] .dlg-actions button').last().click();

async function enterSrHome(page: Page): Promise<void> {
  await page.goto('/?e2e_reset=1');
  await page.getByRole('button', { name: 'Switch to English' }).click();
  await page.getByRole('button', { name: 'Turn on screen reader mode' }).click();
  const enter = page.getByRole('button', { name: 'Open the codex ↦' });
  await expect(enter).toBeEnabled({ timeout: 15_000 });
  await enter.click();
  await page.getByRole('textbox').first().fill('Module Farm');
  for (let i = 0; i < 10; i++) {
    const cont = page.getByRole('button', { name: 'Continue' });
    if (await cont.isVisible().catch(() => false)) {
      await cont.click();
      await page.waitForTimeout(120);
    } else break;
  }
  await page.getByRole('button', { name: 'Open canvas' }).click();
  await expect(page.getByRole('heading', { name: /Your land/i })).toBeVisible({ timeout: 15_000 });
}

/** Open a module from the bottom menu: group button, then menuitem. */
async function openModule(page: Page, group: string, item: string): Promise<void> {
  const nav = page.locator('#module-nav');
  await nav.getByRole('button', { name: group, exact: false }).first().click();
  await page.getByRole('menuitem', { name: item, exact: false }).first().click();
  await expect(page.getByRole('dialog').first()).toBeVisible();
}

async function closeModule(page: Page): Promise<void> {
  await page.keyboard.press('Escape');
  // Closed drawers are inert + aria-hidden, so they leave the a11y tree.
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

test.describe('Blind user — every module fully operable in screen-reader mode', () => {
  test('all modules: primary action by keyboard with announced results', async ({ page }) => {
    test.setTimeout(180_000);
    await enterSrHome(page);

    // ── Plants: create an own species, then plant it via the accessible flow ─
    await openModule(page, 'Land', 'Plants');
    await page.getByRole('button', { name: 'New plant' }).click();
    await page.getByLabel('Common name *').fill('Test Guava');
    await page.getByRole('button', { name: 'Save plant' }).click();
    await expect(toast(page)).toContainText('Plant "Test Guava" added to the codex.');

    // Find it in the catalog and activate "Plant this species". In SR mode
    // this must NOT say "tap the map" — it must land us on the accessible
    // place flow with the species pre-selected and focus on Place plant.
    await page.getByLabel('Search plants').fill('Test Guava');
    await page.getByRole('button', { name: /Test Guava/ }).first().click(); // expand row
    await page.getByRole('button', { name: 'Plant this species' }).click();
    const placeBtn = page.getByRole('button', { name: 'Place plant' });
    await expect(placeBtn).toBeFocused({ timeout: 5_000 });
    await page.keyboard.press('Enter');
    await expect(ciStatus(page)).toContainText('Placed Test Guava');

    // ── Animals: choose a species (announced), log + delete an observation ──
    await openModule(page, 'Land', 'Animals');
    const animalGroup = page.getByRole('group', { name: 'Known animals' });
    const firstAnimal = animalGroup.getByRole('button').first();
    const animalName = (await firstAnimal.textContent())?.trim() ?? '';
    await firstAnimal.click();
    await expect(firstAnimal).toHaveAttribute('aria-pressed', 'true');
    await page.getByLabel('Notes').fill('Seen near the pond');
    await page.getByRole('button', { name: 'Log', exact: true }).click();
    await expect(toast(page)).toContainText(`Observation of ${animalName} saved.`);
    await page.getByRole('button', { name: 'Delete observation' }).first().click();
    await confirmDialog(page);
    await expect(toast(page)).toContainText('Observation deleted.');
    await closeModule(page);

    // ── Notebook: write a note, save, delete it (contextual delete name) ────
    await openModule(page, 'Log', 'Notebook');
    await page.getByLabel('Entry text').fill('Compost turned today');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(toast(page)).toContainText('Entry saved.');
    await expect(page.getByText('Compost turned today')).toBeVisible();
    await page.getByRole('button', { name: /^Delete entry:/ }).first().click();
    await confirmDialog(page);
    await expect(toast(page)).toContainText('Entry deleted.');
    await closeModule(page);

    // ── Protocol: create a task, mark it done, delete it ────────────────────
    await openModule(page, 'Log', 'Protocol');
    await page.getByRole('button', { name: 'New Task' }).click();
    await page.getByLabel('Task', { exact: true }).fill('Water the beds');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(toast(page)).toContainText('Task created');
    await page.getByRole('button', { name: 'Mark task "Water the beds" as completed' }).click();
    await expect(toast(page)).toContainText('Task completed');
    await page.getByRole('button', { name: 'Done', exact: true }).click(); // filter toggle
    await page.getByRole('button', { name: 'Delete task "Water the beds"' }).click();
    await closeModule(page);

    // ── Harvest: log an amount, then delete it (now confirmed + named) ──────
    await openModule(page, 'Log', 'Harvest');
    await page.getByRole('button', { name: 'Log Harvest' }).click();
    await page.getByLabel('Amount (kg)').fill('2.5');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(toast(page)).toContainText('Harvest logged.');
    await page.getByRole('button', { name: /^Delete harvest of/ }).first().click();
    await confirmDialog(page);
    await expect(toast(page)).toContainText('Entry deleted.');
    await closeModule(page);

    // ── Knowledge: record a piece of traditional knowledge ──────────────────
    await openModule(page, 'Knowledge', 'Knowledge');
    await page.getByLabel(/^Title/).fill('Full-moon pruning');
    await page.getByLabel(/Write what you learned/).fill('Grandmother pruned only after the full moon.');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(toast(page)).toContainText('Knowledge saved.');
    await expect(page.getByText('Full-moon pruning')).toBeVisible();
    await closeModule(page);

    // ── Rules (Lore): create a companion rule; form focuses its first field ─
    await openModule(page, 'Knowledge', 'Rules');
    await page.getByRole('button', { name: 'New rule' }).click();
    const entityA = page.getByLabel('Entity A');
    await expect(entityA).toBeFocused();
    await entityA.selectOption({ index: 1 });
    await page.getByLabel('Message').fill('They grow well together.');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(toast(page)).toContainText('Rule added.');
    // The per-rule delete control now has a spoken name.
    await expect(page.getByRole('button', { name: /^Delete rule between/ }).first()).toBeVisible();
    await closeModule(page);

    // ── Calendars: opt in to a tradition and see the week grid ──────────────
    await openModule(page, 'Knowledge', 'Calendars');
    const enable = page.getByRole('button', { name: /Enable Biodinámico/ });
    await enable.click();
    await expect(page.getByRole('button', { name: /Disable Biodinámico/ })).toHaveAttribute('aria-pressed', 'true');
    // Day cells are named buttons (date + day kind), today is aria-current.
    await expect(page.locator('.dcell').first()).toBeVisible();
    await expect(page.locator('.dcell[aria-current="date"]')).toHaveCount(1);
    await closeModule(page);

    // ── Analysis: chart has a text alternative; site notes announce saving ──
    await openModule(page, 'Codex', 'Analysis');
    await expect(page.getByRole('img', { name: 'Chart of plants by species' })).toBeVisible();
    await page.getByLabel('Site notes').fill('Wind from the north in January.');
    await page.getByLabel('Site notes').blur(); // leaving the field saves
    await expect(page.locator('span.coord[role="status"]')).toHaveText('Saved');
    await closeModule(page);

    // ── Resources: add an item and adjust its quantity by name ──────────────
    await openModule(page, 'Land', 'Resources');
    await page.getByRole('button', { name: 'New', exact: true }).click();
    await page.getByLabel('Name', { exact: true }).fill('Mulch');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(toast(page)).toContainText('Resource added.');
    await page.getByRole('button', { name: 'Add one to Mulch' }).click();
    await expect(page.getByText(/1 kg ·/)).toBeVisible();
    await closeModule(page);

    // ── Settings: sections are announced; replay speaks the orientation ─────
    await openModule(page, 'Codex', 'Settings');
    await page.getByRole('button', { name: 'Accessibility' }).click();
    const live = page.locator('div.sr-only[role="status"]').first();
    await expect(live).toContainText('Accessibility');
    await page.getByRole('button', { name: 'Replay voice guidance' }).click();
    await expect(live).toContainText('Welcome to Kuxtal');
    await closeModule(page);
  });

  test('community: anonymous read, and the login modal is focus-managed', async ({ page }) => {
    await enterSrHome(page);
    await page.locator('#module-nav').getByRole('button', { name: 'Community' }).click();
    await expect(page.getByRole('dialog').first()).toBeVisible();

    // Anonymous banner offers login; activating it opens the auth dialog and
    // focus MUST move inside (to the username field), not stay behind it.
    const loginBtn = page.getByRole('button', { name: 'Log in', exact: true });
    await loginBtn.click();
    await expect(page.locator('#u-username')).toBeFocused();

    // Tab cycles inside the dialog (focus trap) — walk enough steps to wrap.
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Tab');
      const inDialog = await page.evaluate(() => {
        const dlg = document.querySelector('.modal-backdrop');
        return dlg ? dlg.contains(document.activeElement) : false;
      });
      expect(inDialog).toBe(true);
    }

    // Escape closes it and restores focus to the button that opened it.
    await page.keyboard.press('Escape');
    await expect(page.locator('.modal-backdrop')).toHaveCount(0);
    await expect(loginBtn).toBeFocused();
  });
});
