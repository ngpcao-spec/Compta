import { expect, test, type Page } from '@playwright/test';
import { freeze, login, TODAY_JAN } from './helpers';

// PNG 1×1 : suffit à traverser la compression (canvas) côté navigateur.
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

type FakeScan = {
  kind: 'ok' | 'error' | 'quota';
  delayMs?: number;
  amount?: number;
  date?: string | null;
  categoryName?: string;
  merchant?: string | null;
  confidence?: number;
};

async function arm(page: Page, cfg: FakeScan) {
  await page.evaluate((c) => localStorage.setItem('stc.e2e.scan', JSON.stringify(c)), cfg);
}
async function scan(page: Page) {
  await page
    .getByTestId('scan-input')
    .setInputFiles({ name: 'facture.png', mimeType: 'image/png', buffer: PNG_1X1 });
}

test.describe('scanner une facture', () => {
  test.beforeEach(async ({ page }) => {
    await freeze(page, TODAY_JAN);
    await login(page);
    await page.getByTestId('add-tx').click();
    await expect(page.getByTestId('scan-receipt')).toBeEnabled();
  });

  test('scan réussi : dépense créée directement, toast et « Sửa » ouvre la bonne transaction', async ({
    page,
  }) => {
    await arm(page, {
      kind: 'ok',
      amount: 250000,
      categoryName: 'Ăn uống',
      date: '2026-01-02',
      merchant: 'Highlands Coffee',
      confidence: 0.9,
    });
    await scan(page);

    // retour à l'accueil, transaction visible, toast avec le montant et la catégorie
    await expect(
      page.getByRole('status').filter({ hasText: 'Đã thêm 250,000 vào Ăn uống' }),
    ).toBeVisible();
    const row = page.getByTestId('tx-row');
    await expect(row).toHaveCount(1);
    await expect(row).toContainText('Ăn uống');
    await expect(row).toContainText('Highlands Coffee');
    await expect(row).toContainText('-250,000');

    await page.getByTestId('toast-action').click();
    await expect(page).toHaveURL(/\/tx\/[0-9a-f-]{36}$/);
    await expect(page.getByTestId('amount-display')).toHaveText('250,000');
    await expect(page.getByLabel('Ghi chú')).toHaveValue('Highlands Coffee');
    await expect(page.getByTestId('cat-cell').filter({ hasText: 'Ăn uống' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  test('date absente → aujourd’hui ; marchand tronqué à 100 caractères', async ({ page }) => {
    await arm(page, {
      kind: 'ok',
      amount: 90000,
      categoryName: 'Cà phê',
      date: null,
      merchant: 'M'.repeat(180),
      confidence: 0.8,
    });
    await scan(page);
    const row = page.getByTestId('tx-row');
    await expect(row).toHaveCount(1);
    await expect(page.getByRole('region', { name: 'ngày 2 thg 1, 2026' })).toBeVisible();
    await row.click();
    await expect(page.getByLabel('Ghi chú')).toHaveValue('M'.repeat(100));
  });

  test('échec de la fonction : rien d’enregistré, saisie manuelle et message', async ({ page }) => {
    await arm(page, { kind: 'error' });
    await scan(page);
    await expect(page.getByTestId('scan-message')).toHaveText(
      'Không đọc được hóa đơn, vui lòng kiểm tra',
    );
    await expect(page).toHaveURL(/\/tx\/new/);
    await page.getByRole('button', { name: 'Hủy' }).click();
    await expect(page.getByTestId('empty-state')).toBeVisible();
  });

  test('confiance < 0,5 : saisie manuelle pré-remplie avec ce qui a été lu, rien d’enregistré', async ({
    page,
  }) => {
    await arm(page, {
      kind: 'ok',
      amount: 99000,
      categoryName: 'Cà phê',
      date: '2026-01-01',
      merchant: 'Katinat',
      confidence: 0.3,
    });
    await scan(page);
    await expect(page.getByTestId('scan-message')).toBeVisible();
    await expect(page.getByTestId('amount-display')).toHaveText('99,000');
    await expect(page.getByLabel('Ghi chú')).toHaveValue('Katinat');
    await expect(page.getByTestId('cat-cell').filter({ hasText: 'Cà phê' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    // l'utilisateur vérifie puis valide lui-même
    await page.getByTestId('key-ok').click();
    await expect(page.getByTestId('tx-row')).toHaveCount(1);
    await expect(page.getByRole('region', { name: 'ngày 1 thg 1, 2026' })).toBeVisible();
  });

  test('quota dépassé : message dédié, saisie manuelle', async ({ page }) => {
    await arm(page, { kind: 'quota' });
    await scan(page);
    await expect(page.getByTestId('scan-message')).toContainText('Đã hết 30 lượt quét hôm nay');
    await expect(page.getByTestId('tx-row')).toHaveCount(0);
  });

  test('chargement annulable', async ({ page }) => {
    await arm(page, { kind: 'ok', amount: 50000, categoryName: 'Ăn uống', delayMs: 8000 });
    await scan(page);
    await expect(page.getByTestId('scan-overlay')).toContainText('Đang đọc hóa đơn…');
    await page.getByTestId('scan-cancel').click();
    await expect(page.getByTestId('scan-overlay')).toBeHidden();
    await expect(page.getByTestId('scan-message')).toBeHidden();
    await expect(page).toHaveURL(/\/tx\/new/);
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: 'Hủy' }).click();
    await expect(page.getByTestId('empty-state')).toBeVisible(); // aucune transaction créée
  });

  test('hors ligne : bouton désactivé avec le message', async ({ page, context }) => {
    await context.setOffline(true);
    await expect(page.getByTestId('scan-receipt')).toBeDisabled();
    await expect(page.getByTestId('scan-offline')).toHaveText('Cần kết nối mạng để quét hóa đơn');
    await context.setOffline(false);
    await expect(page.getByTestId('scan-receipt')).toBeEnabled();
    await expect(page.getByTestId('scan-offline')).toBeHidden();
  });

  test('le champ photo demande l’appareil photo arrière', async ({ page }) => {
    const input = page.getByTestId('scan-input');
    await expect(input).toHaveAttribute('accept', 'image/*');
    await expect(input).toHaveAttribute('capture', 'environment');
  });
});

test('pas de bouton de scan en édition', async ({ page }) => {
  await freeze(page, TODAY_JAN);
  await login(page);
  await page.getByTestId('add-tx').click();
  await page.getByTestId('cat-cell').first().click();
  await page.getByTestId('key-5').click();
  await page.getByTestId('key-ok').click();
  await page.getByTestId('tx-row').click();
  await expect(page.getByTestId('scan-receipt')).toHaveCount(0);
});
