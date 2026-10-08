import { expect, test } from '@playwright/test';
import { DEMO_TXS } from '../../src/sync/demoData';
import { freeze, login, seedDemo, TODAY_JUL } from './helpers';

test('tableau annuel sur 7 mois', async ({ page }) => {
  await freeze(page, TODAY_JUL);
  await login(page);
  await seedDemo(page);
  await page.goto('/trend');

  const income = DEMO_TXS.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = DEMO_TXS.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const fmt = (n: number) =>
    Math.round(n)
      .toString()
      .replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  const year = page.getByTestId('row-year');
  await expect(year).toContainText('2026');
  await expect(year).toContainText(fmt(income));
  await expect(year).toContainText(`-${fmt(expense)}`);
  await expect(year).toContainText(fmt(income - expense));

  const avg = page.getByTestId('row-average');
  await expect(avg).toContainText('Hàng tháng');
  await expect(avg).toContainText(fmt(income / 7));
  await expect(avg).toContainText(`-${fmt(expense / 7)}`);

  const months = page.getByTestId('row-month');
  await expect(months).toHaveCount(7);
  await expect(months.first()).toContainText('thg 7');
  await expect(months.last()).toContainText('thg 1');
  await expect(months.last()).toContainText('28,750,000');

  await expect(page.getByTestId('trend-chart').locator('svg').first()).toBeVisible();
  await page.getByRole('tab', { name: 'Thu nhập' }).click();

  await months.first().getByRole('link').first().click();
  await expect(page).toHaveURL(/\/charts\?m=2026-07/);
});
