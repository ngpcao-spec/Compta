import { test } from '@playwright/test';
import { freeze, login, seedDemo, TODAY_JAN, TODAY_JUL } from './helpers';

// Captures 390×844 pour la revue visuelle (comparaison avec docs/mockups/ quand elles existent).
const out = (name: string) => `docs/screenshots/${name}.png`;

test('captures des écrans', async ({ page }) => {
  await freeze(page, TODAY_JAN);
  await page.goto('/');
  await page.screenshot({ path: out('login') });
  await login(page);
  await seedDemo(page);
  await page.waitForTimeout(400);
  await page.screenshot({ path: out('home') });

  await page.getByTestId('budget-card').click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: out('budget') });
  await page.keyboard.press('Escape');

  await page.getByTestId('add-tx').click();
  await page.waitForTimeout(200);
  await page.screenshot({ path: out('tx-categories') });
  await page.getByTestId('cat-cell').filter({ hasText: 'Quần áo' }).click();
  await page.getByTestId('key-3').click();
  await page.getByTestId('key-000').click();
  await page.waitForTimeout(200);
  await page.screenshot({ path: out('tx-keypad') });

  await page.goto('/charts');
  await page.waitForTimeout(500);
  await page.screenshot({ path: out('charts'), fullPage: false });

  await page.goto('/more');
  await page.waitForTimeout(300);
  await page.screenshot({ path: out('more') });
  await page.goto('/more/categories');
  await page.waitForTimeout(300);
  await page.screenshot({ path: out('categories') });
  await page.goto('/more/categories/new');
  await page.waitForTimeout(300);
  await page.screenshot({ path: out('category-edit') });

  await freeze(page, TODAY_JUL);
  await page.goto('/trend');
  await page.waitForTimeout(500);
  await page.screenshot({ path: out('trend') });
});
