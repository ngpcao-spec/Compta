import { expect, test } from '@playwright/test';
import { freeze, login, TODAY_JAN } from './helpers';

test('mode avion : saisie possible puis synchro au retour du réseau', async ({ page, context }) => {
  await freeze(page, TODAY_JAN);
  await login(page);
  // le service worker doit avoir mis l'app en cache avant de couper le réseau
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await page.reload();
  await expect(page.getByRole('link', { name: 'Sổ thu chi' })).toBeVisible();

  await context.setOffline(true);
  await page.reload(); // ouverture hors ligne avec session en cache
  await expect(page.getByRole('link', { name: 'Sổ thu chi' })).toBeVisible();

  await page.getByTestId('add-tx').click();
  await page.getByTestId('cat-cell').filter({ hasText: 'Ăn uống' }).click();
  for (const k of ['7', '000']) await page.getByTestId(`key-${k}`).click();
  await page.getByTestId('key-ok').click();
  await expect(page.getByTestId('tx-row')).toContainText('-7,000');

  await page.getByRole('link', { name: 'Thêm', exact: true }).click();
  await expect(page.getByTestId('sync-indicator')).toHaveText('Ngoại tuyến');
  expect(
    await page.evaluate(() =>
      (window as unknown as { __stc: { pending(): Promise<number> } }).__stc.pending(),
    ),
  ).toBe(1);
  const before = await page.evaluate(() => localStorage.getItem('stc.e2e.server') ?? '');
  expect(before).not.toContain('"amount":7000');

  await context.setOffline(false);
  await expect(page.getByTestId('sync-indicator')).toHaveText(/Đã đồng bộ lúc \d\d:\d\d/, {
    timeout: 15_000,
  });
  const after = await page.evaluate(() => localStorage.getItem('stc.e2e.server') ?? '');
  expect(after).toContain('"amount":7000');
});
