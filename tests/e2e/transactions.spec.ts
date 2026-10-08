import { expect, test, type Page } from '@playwright/test';
import { freeze, login, TODAY_JAN } from './helpers';

async function pick(page: Page, name: string) {
  await page.getByTestId('cat-cell').filter({ hasText: name }).click();
}

test.describe('transactions', () => {
  test.beforeEach(async ({ page }) => {
    await freeze(page, TODAY_JAN);
    await login(page);
  });

  test('ajouter une dépense puis un revenu', async ({ page }) => {
    await page.getByTestId('add-tx').click();
    await expect(page.getByTestId('key-ok')).toBeHidden();
    await pick(page, 'Ăn uống');
    await expect(page.getByTestId('key-ok')).toBeDisabled();
    for (const k of ['1', '2', '000']) await page.getByTestId(`key-${k}`).click();
    await page.getByLabel('Ghi chú').fill('Phở bò');
    await expect(page.getByTestId('amount-display')).toHaveText('12,000');
    await page.getByTestId('key-ok').click();
    await expect(page.getByRole('status').filter({ hasText: 'Đã lưu giao dịch' })).toBeVisible();
    await expect(page.getByTestId('tx-row')).toHaveCount(1);
    await expect(page.getByTestId('tx-row')).toContainText('Ăn uống');
    await expect(page.getByTestId('tx-row')).toContainText('Phở bò');
    await expect(page.getByTestId('tx-row')).toContainText('-12,000');

    await page.getByTestId('add-tx').click();
    await page.getByRole('tab', { name: 'Thu nhập' }).click();
    await pick(page, 'Lương');
    for (const k of ['5', '000', '000']) await page.getByTestId(`key-${k}`).click();
    await page.getByTestId('key-ok').click();
    await expect(page.getByTestId('tx-row')).toHaveCount(2);
    await expect(page.getByTestId('tx-row').filter({ hasText: 'Lương' })).toContainText(
      '5,000,000',
    );
    await expect(page.getByTestId('tx-row').filter({ hasText: 'Lương' })).not.toContainText('-');
  });

  test('calculatrice : 5000 + 3000 = 8,000', async ({ page }) => {
    await page.getByTestId('add-tx').click();
    await pick(page, 'Cà phê');
    await page.getByTestId('key-5').click();
    await page.getByTestId('key-000').click();
    await page.getByTestId('key-plus').click();
    await page.getByTestId('key-3').click();
    await page.getByTestId('key-000').click();
    await expect(page.getByTestId('amount-display')).toHaveText('5,000+3,000');
    await page.getByTestId('key-ok').click();
    await expect(page.getByTestId('tx-row')).toContainText('-8,000');
  });

  test('modifier puis supprimer', async ({ page }) => {
    await page.getByTestId('add-tx').click();
    await pick(page, 'Mua sắm');
    await page.getByTestId('key-9').click();
    await page.getByTestId('key-000').click();
    await page.getByTestId('key-ok').click();

    await page.getByTestId('tx-row').click();
    await expect(page.getByTestId('amount-display')).toHaveText('9,000');
    await page.getByTestId('key-back').click();
    await page.getByTestId('key-back').click();
    await page.getByTestId('key-back').click();
    await page.getByTestId('key-2').click();
    await page.getByTestId('key-ok').click();
    await expect(page.getByTestId('tx-row')).toContainText('-92');

    await page.getByTestId('tx-row').click();
    await page.getByTestId('delete-tx').click();
    await page.getByRole('button', { name: 'Xóa', exact: true }).click();
    await expect(page.getByTestId('empty-state')).toBeVisible();
  });

  test('refuse un montant nul', async ({ page }) => {
    await page.getByTestId('add-tx').click();
    await pick(page, 'Game');
    await page.getByTestId('key-0').click();
    await expect(page.getByTestId('key-ok')).toBeDisabled();
  });
});
