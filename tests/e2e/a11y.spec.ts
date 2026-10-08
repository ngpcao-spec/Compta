import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { freeze, login, seedDemo, TODAY_JAN } from './helpers';

// Accessibilité de base : aucune violation « serious » ou « critical » sur les écrans principaux.
const ROUTES = [
  '/',
  '/charts',
  '/more',
  '/more/categories',
  '/more/categories/new',
  '/tx/new',
  '/trend',
];

test('axe : écrans principaux', async ({ page }) => {
  await freeze(page, TODAY_JAN);
  await login(page);
  await seedDemo(page);
  for (const route of ROUTES) {
    await page.goto(route);
    await page.waitForTimeout(500);
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    );
    const summary = serious.map(
      (v) => `${v.id} (${v.nodes.length}) ${v.nodes[0]?.target.join(' ')}`,
    );
    expect(summary, `${route}`).toEqual([]);
  }
});
