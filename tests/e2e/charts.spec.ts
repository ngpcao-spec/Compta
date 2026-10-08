import { expect, test } from '@playwright/test';
import { freeze, login, seedDemo, TODAY_JAN, TODAY_JUL } from './helpers';

test.describe('graphiques', () => {
  test('valeurs de la maquette (janvier 2026, au 2/1)', async ({ page }) => {
    await freeze(page, TODAY_JAN);
    await login(page);
    await seedDemo(page);
    await page.getByRole('link', { name: 'Biểu đồ' }).click();
    await expect(page.getByTestId('tile-income')).toHaveText('38,000,000');
    await expect(page.getByTestId('tile-expense')).toHaveText('-9,250,000');
    await expect(page.getByTestId('tile-balance')).toHaveText('28,750,000');
    await expect(page.getByTestId('tile-daily')).toHaveText('-4,625,000');
    await expect(page.getByTestId('donut-total')).toHaveText('-9,250,000');
    const ranking = page.getByTestId('ranking').getByRole('listitem');
    await expect(ranking.first()).toContainText('Quà tặng');
    await expect(ranking.first()).toContainText('40.0%');
    await expect(ranking.first()).toContainText('-3,700,000');

    // clic sur une catégorie → transactions filtrées
    await ranking.first().getByRole('button').click();
    await expect(page.getByRole('dialog')).toContainText('Quà tặng');
    await expect(page.getByRole('dialog')).toContainText('3,700,000');
  });

  test('revenus, mois passé et mois futur', async ({ page }) => {
    await freeze(page, TODAY_JUL);
    await login(page);
    await seedDemo(page);
    await page.goto('/charts?m=2026-01');
    // mois passé : dépenses ÷ 31 jours
    await expect(page.getByTestId('tile-daily')).toHaveText('-298,387');
    await page.getByRole('tab', { name: 'Thu nhập' }).click();
    await expect(page.getByTestId('donut-total')).toHaveText('38,000,000');
    await page.goto('/charts?m=2026-09');
    await expect(page.getByTestId('tile-daily')).toHaveText('0');
    await expect(page.getByText('Không có dữ liệu')).toBeVisible();
  });

  test('menu vers la tendance', async ({ page }) => {
    await login(page);
    await page.getByRole('link', { name: 'Biểu đồ' }).click();
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('menuitem', { name: 'Xu hướng' }).click();
    await expect(page).toHaveURL(/\/trend/);
  });
});
