import { expect, test } from '@playwright/test';
import { freeze, login, seedDemo, TODAY_JUL } from './helpers';

test('tableau annuel sur 7 mois', async ({ page }) => {
  await freeze(page, TODAY_JUL);
  await login(page);
  await seedDemo(page);
  await page.goto('/trend');

  // Valeurs de la maquette « Xu hướng » (7 mois, à fin juillet).
  const year = page.getByTestId('row-year');
  await expect(year).toContainText('2026');
  await expect(year).toContainText('228,000,000');
  await expect(year).toContainText('-101,250,000');
  await expect(year).toContainText('126,750,000');

  const avg = page.getByTestId('row-average');
  await expect(avg).toContainText('Hàng tháng');
  await expect(avg).toContainText('32,571,429');
  await expect(avg).toContainText('-14,464,286');
  await expect(avg).toContainText('18,107,143');

  const months = page.getByTestId('row-month');
  await expect(months).toHaveCount(7);
  await expect(months.first()).toContainText('thg 7 2026');
  await expect(months.first()).toContainText('28,000,000');
  await expect(months.first()).toContainText('-22,000,000');
  await expect(months.first()).toContainText('6,000,000');
  await expect(months.last()).toContainText('thg 1');
  await expect(months.last()).toContainText('28,750,000');

  await expect(page.getByTestId('trend-chart').locator('svg').first()).toBeVisible();
  await page.getByRole('tab', { name: 'Thu nhập' }).click();

  await months.first().getByRole('link').first().click();
  await expect(page).toHaveURL(/\/charts\?m=2026-07/);
});
