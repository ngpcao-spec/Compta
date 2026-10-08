import { expect, test, type Page } from '@playwright/test';
import { freeze, login, seedDemo, TODAY_JAN } from './helpers';

async function setBudget(page: Page, digits: string, applyFuture = false) {
  await page.getByTestId('budget-card').or(page.getByTestId('set-budget')).click();
  // vider l'expression existante
  for (let i = 0; i < 14; i++) await page.getByTestId('key-back').click();
  for (const d of digits.match(/000|\d/g) ?? []) await page.getByTestId(`key-${d}`).click();
  if (applyFuture) await page.getByLabel('Áp dụng cho các tháng sau').check();
  await page.getByTestId('key-ok').click();
}

test.describe('accueil et budget', () => {
  test.beforeEach(async ({ page }) => {
    await freeze(page, TODAY_JAN);
    await login(page);
    await seedDemo(page);
  });

  test('totaux de la maquette', async ({ page }) => {
    const header = page.locator('header').first();
    await expect(header).toContainText('thg 1 2026');
    await expect(header).toContainText('28,750,000');
    await expect(header).toContainText('9,250,000');
    await expect(header).toContainText('38,000,000');
    const card = page.getByTestId('budget-card');
    await expect(card).toContainText('Ngân sách: 18,000,000');
    await expect(card).toContainText('Còn lại: 8,750,000');

    const day2 = page.getByRole('region', { name: 'ngày 2 thg 1, 2026' });
    await expect(day2).toContainText('Chi tiêu: -4,800,000');
    await expect(day2).toContainText('Thu nhập: 38,000,000');
    await expect(day2.getByTestId('tx-row')).toHaveCount(4);
    await expect(day2).toContainText('Mũ nón');
    const day1 = page.getByRole('region', { name: 'ngày 1 thg 1, 2026' });
    await expect(day1).toContainText('Chi tiêu: -4,450,000');
    await expect(day1).not.toContainText('Thu nhập');
    // jour le plus récent en haut
    const regions = await page.getByRole('region').allInnerTexts();
    expect(regions[0]).toContain('ngày 2 thg 1');
  });

  test('héritage du budget et mois suivants', async ({ page }) => {
    await page.getByRole('button', { name: 'Tháng sau' }).click();
    await expect(page.locator('header').first()).toContainText('thg 2 2026');
    await expect(page.getByTestId('budget-card')).toContainText('Ngân sách: 18,000,000'); // hérité de janvier
    await expect(page.getByTestId('budget-card')).toContainText('Còn lại: 2,300,000'); // 18,000,000 − 15,700,000

    await setBudget(page, '20000000'); // exception pour février
    await expect(page.getByTestId('budget-card')).toContainText('Ngân sách: 20,000,000');
    await page.getByRole('button', { name: 'Tháng sau' }).click(); // mars hérite de février
    await expect(page.getByTestId('budget-card')).toContainText('Ngân sách: 20,000,000');
    await page.getByRole('button', { name: 'Tháng trước' }).click();
    await page.getByRole('button', { name: 'Tháng trước' }).click();
    await expect(page.getByTestId('budget-card')).toContainText('Ngân sách: 18,000,000'); // janvier intact

    // « tháng sau » : budget par défaut
    await page.getByRole('button', { name: 'Tháng sau' }).click();
    await page.getByRole('button', { name: 'Tháng sau' }).click();
    await setBudget(page, '25000000', true);
    await expect(page.getByTestId('budget-card')).toContainText('Ngân sách: 25,000,000');
    await page.getByRole('button', { name: 'Tháng sau' }).click();
    await expect(page.getByTestId('budget-card')).toContainText('Ngân sách: 25,000,000');
  });

  test('dépassement : reste négatif', async ({ page }) => {
    await setBudget(page, '5000000');
    const card = page.getByTestId('budget-card');
    await expect(card).toContainText('Còn lại: -4,250,000');
    await expect(card.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
  });

  test('budget à 0 supprime le budget du mois', async ({ page }) => {
    await setBudget(page, '0');
    await expect(page.getByTestId('set-budget')).toBeVisible();
  });

  test('masquage des montants', async ({ page }) => {
    await page.getByTestId('toggle-hide').click();
    await expect(page.locator('header').first()).toContainText('******');
    await expect(page.locator('header').first()).not.toContainText('28,750,000');
    await expect(page.getByTestId('tx-row').first()).toContainText('******');
    await page.getByTestId('toggle-hide').click();
    await expect(page.locator('header').first()).toContainText('28,750,000');
  });

  test('sélecteur de mois', async ({ page }) => {
    await page.getByTestId('month-pill').click();
    await page.getByRole('button', { name: 'thg 7', exact: true }).click();
    await expect(page.locator('header').first()).toContainText('thg 7 2026');
  });
});
