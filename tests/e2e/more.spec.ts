import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { DEMO_TXS } from '../../src/sync/demoData';
import { freeze, login, seedDemo, TODAY_JAN } from './helpers';

test.beforeEach(async ({ page }) => {
  await freeze(page, TODAY_JAN);
  await login(page);
  await seedDemo(page);
  await page.getByRole('link', { name: 'Thêm', exact: true }).click();
});

test('export CSV : BOM UTF-8 et accents', async ({ page }) => {
  const download = page.waitForEvent('download');
  await page.getByTestId('export-csv').click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^so-thu-chi-.*\.csv$/);
  const raw = readFileSync((await file.path()) as string);
  expect([raw[0], raw[1], raw[2]]).toEqual([0xef, 0xbb, 0xbf]);
  const text = raw.toString('utf8').slice(1);
  const lines = text.trim().split('\r\n');
  expect(lines[0]).toBe('Ngày,Loại,Danh mục,Số tiền,Ghi chú');
  expect(lines).toContain('2026-01-02,Chi tiêu,Quần áo,3200000,Mũ nón');
  expect(lines).toContain('2026-01-02,Thu nhập,Lương,38000000,');
  expect(lines).toHaveLength(1 + DEMO_TXS.length);
});

test('masquage des montants depuis Plus', async ({ page }) => {
  await page.getByTestId('hide-switch').click();
  await page.getByRole('link', { name: 'Sổ thu chi' }).click();
  await expect(page.locator('header').first()).toContainText('******');
  await page.reload();
  await expect(page.locator('header').first()).toContainText('******'); // persisté
});

test('indicateur de synchronisation', async ({ page }) => {
  await expect(page.getByTestId('sync-indicator')).toHaveText(
    /Đã đồng bộ lúc \d\d:\d\d|Đang chờ đồng bộ \(\d+\)/,
  );
  await expect(page.getByTestId('sync-indicator')).toHaveText(/Đã đồng bộ lúc \d\d:\d\d/, {
    timeout: 15_000,
  });
  await expect(page.getByText(/Phiên bản \d/)).toBeVisible();
});

test('suppression du compte : confirmation en tapant XÓA', async ({ page }) => {
  await page.getByTestId('delete-account').click();
  await expect(page.getByTestId('delete-confirm')).toBeDisabled();
  await page.getByTestId('delete-word').fill('xoa');
  await expect(page.getByTestId('delete-confirm')).toBeDisabled();
  await page.getByTestId('delete-word').fill('XÓA');
  await page.getByTestId('delete-confirm').click();
  await expect(page).toHaveURL(/\/login/);
  await login(page);
  await expect(page.getByTestId('empty-state')).toBeVisible(); // données effacées
});
