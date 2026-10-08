import { expect, test, type Page } from '@playwright/test';
import { freeze, login, TODAY_JAN } from './helpers';

// PNG 1×1 : suffit à traverser la compression (canvas) côté navigateur.
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

type FakeScan = {
  kind: 'ok' | 'error' | 'quota';
  docKind?: 'invoice' | 'bank_notification' | 'other';
  txType?: 'expense' | 'income';
  delayMs?: number;
  amount?: number;
  date?: string | null;
  categoryName?: string;
  merchant?: string | null;
  vatIncluded?: boolean | null;
  confidence?: number;
};

async function arm(page: Page, cfg: FakeScan) {
  await page.evaluate((c) => localStorage.setItem('stc.e2e.scan', JSON.stringify(c)), cfg);
}
async function scan(page: Page, source: 'camera' | 'library' = 'camera') {
  await page
    .getByTestId(`scan-${source}-input`)
    .setInputFiles({ name: 'facture.png', mimeType: 'image/png', buffer: PNG_1X1 });
}

/** Image réelle générée dans le navigateur (canvas) : taille voulue, couleur unie. */
async function makeImage(
  page: Page,
  width: number,
  height: number,
  mime: 'image/png' | 'image/jpeg',
) {
  const b64 = await page.evaluate(
    async ({ width, height, mime }) => {
      const c = document.createElement('canvas');
      c.width = width;
      c.height = height;
      const ctx = c.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#336699';
        ctx.fillRect(0, 0, width, height);
      }
      const blob = await new Promise<Blob | null>((r) => c.toBlob(r, mime, 0.8));
      if (!blob) return '';
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let bin = '';
      for (let i = 0; i < bytes.length; i += 0x8000) {
        bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      }
      return btoa(bin);
    },
    { width, height, mime },
  );
  return Buffer.from(b64, 'base64');
}

/** Insère un APP1 Exif (orientation seule) juste après le SOI d'un JPEG. */
function withExifOrientation(jpeg: Buffer, orientation: number): Buffer {
  const tiff = Buffer.from([
    0x49,
    0x49,
    42,
    0,
    8,
    0,
    0,
    0, // II, 42, offset IFD
    1,
    0, // une entrée
    0x12,
    0x01,
    3,
    0,
    1,
    0,
    0,
    0,
    orientation,
    0,
    0,
    0, // tag 0x0112, SHORT, 1 valeur
    0,
    0,
    0,
    0, // fin des IFD
  ]);
  const body = Buffer.concat([Buffer.from('Exif\0\0', 'binary'), tiff]);
  const head = Buffer.from([0xff, 0xe1, (body.length + 2) >> 8, (body.length + 2) & 255]);
  return Buffer.concat([jpeg.subarray(0, 2), head, body, jpeg.subarray(2)]);
}

/** Dimensions (px) de l'image réellement envoyée à la fonction (compressée). */
async function sentSize(page: Page) {
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('stc.e2e.scan.last')))
    .not.toBeNull();
  return page.evaluate(
    () =>
      JSON.parse(localStorage.getItem('stc.e2e.scan.last') ?? '{}') as {
        width: number;
        height: number;
      },
  );
}
const OK_SCAN: FakeScan = { kind: 'ok', amount: 250000, categoryName: 'Ăn uống', confidence: 0.9 };

test.describe('scanner une facture', () => {
  test.beforeEach(async ({ page }) => {
    await freeze(page, TODAY_JAN);
    await login(page);
    await page.getByTestId('add-tx').click();
    await expect(page.getByTestId('scan-camera')).toBeEnabled();
    await expect(page.getByTestId('scan-library')).toBeEnabled();
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

  test('montant hors TVA : note préfixée « (chưa VAT) » et toast d’avertissement avec « Sửa »', async ({
    page,
  }) => {
    await arm(page, {
      kind: 'ok',
      amount: 1020331,
      categoryName: 'Ăn uống',
      date: '2026-01-02',
      merchant: 'HĐ #ISR06000025498',
      vatIncluded: false,
      confidence: 0.85,
    });
    await scan(page, 'library');
    await expect(
      page
        .getByRole('status')
        .filter({ hasText: 'Đã thêm 1,020,331 vào Ăn uống — số tiền chưa gồm VAT, kiểm tra lại' }),
    ).toBeVisible();
    const row = page.getByTestId('tx-row');
    await expect(row).toContainText('(chưa VAT) HĐ #ISR06000025498');
    await expect(row).toContainText('-1,020,331');
    await page.getByTestId('toast-action').click();
    await expect(page.getByLabel('Ghi chú')).toHaveValue('(chưa VAT) HĐ #ISR06000025498');
  });

  test('facture TTC : toast normal, note sans préfixe', async ({ page }) => {
    await arm(page, { ...OK_SCAN, merchant: 'Co.opmart', vatIncluded: true, date: '2026-01-02' });
    await scan(page);
    await expect(
      page.getByRole('status').filter({ hasText: /^Đã thêm 250,000 vào Ăn uống/ }),
    ).not.toContainText('VAT');
    await expect(page.getByTestId('tx-row')).toContainText('Co.opmart');
    await expect(page.getByTestId('tx-row')).not.toContainText('chưa VAT');
  });

  test('SMS NamABank « nop 3.500.000VND » scanné depuis l’onglet Chi tiêu : un REVENU est enregistré', async ({
    page,
  }) => {
    // « NamABank: TK 4010…0007 nop 3.500.000VND luc 21:36 07/10/2026. So du 3.617.661VND. ND: CAO MINH NHAN Chuyen tien »
    await arm(page, {
      kind: 'ok',
      docKind: 'bank_notification',
      txType: 'income',
      amount: 3500000,
      categoryName: 'Thu nhập khác',
      date: '2026-01-02',
      merchant: 'CAO MINH NHAN - Chuyen tien',
      confidence: 0.93,
    });
    await expect(page.getByRole('tab', { name: 'Chi tiêu' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await scan(page, 'library');
    await expect(
      page.getByRole('status').filter({ hasText: 'Đã thêm thu nhập 3,500,000 vào Thu nhập khác' }),
    ).toBeVisible();
    const row = page.getByTestId('tx-row');
    await expect(row).toHaveCount(1);
    await expect(row).toContainText('Thu nhập khác');
    await expect(row).toContainText('3,500,000');
    await expect(row).not.toContainText('-3,500,000'); // revenu : pas de signe moins
    await expect(row).toContainText('CAO MINH NHAN - Chuyen tien');
    await expect(row).not.toContainText(/4010|0007/);
    // « Sửa » ouvre la transaction, sur l'onglet Thu nhập
    await page.getByTestId('toast-action').click();
    await expect(page).toHaveURL(/\/tx\/[0-9a-f-]{36}$/);
    await expect(page.getByRole('tab', { name: 'Thu nhập' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(page.getByTestId('amount-display')).toHaveText('3,500,000');
  });

  test('SMS de débit : une dépense, toast habituel', async ({ page }) => {
    await arm(page, {
      kind: 'ok',
      docKind: 'bank_notification',
      txType: 'expense',
      amount: 250000,
      categoryName: 'Khác',
      merchant: 'Thanh toan GRAB',
      confidence: 0.9,
    });
    await scan(page);
    await expect(
      page.getByRole('status').filter({ hasText: /^Đã thêm 250,000 vào Khác/ }),
    ).toBeVisible();
    await expect(page.getByTestId('tx-row')).toContainText('-250,000');
  });

  test('capture MoMo de paiement lue depuis la bibliothèque : dépense', async ({ page }) => {
    await arm(page, {
      kind: 'ok',
      docKind: 'bank_notification',
      txType: 'expense',
      amount: 89000,
      categoryName: 'Ăn uống',
      merchant: 'MoMo - Highlands Coffee',
      confidence: 0.88,
    });
    await scan(page, 'library');
    await expect(page.getByTestId('tx-row')).toContainText('-89,000');
    await expect(page.getByTestId('tx-row')).toContainText('MoMo - Highlands Coffee');
  });

  test('onglet Thu nhập : les deux boutons y sont et un revenu y est enregistré', async ({
    page,
  }) => {
    await page.getByRole('tab', { name: 'Thu nhập' }).click();
    await expect(page.getByTestId('scan-camera')).toBeVisible();
    await expect(page.getByTestId('scan-library')).toBeVisible();
    await expect(page.getByTestId('scan-camera')).toBeEnabled();
    await arm(page, {
      kind: 'ok',
      docKind: 'bank_notification',
      txType: 'income',
      amount: 15000000,
      categoryName: 'Lương',
      merchant: 'CONG TY ABC - Luong thang 9',
      confidence: 0.95,
    });
    await scan(page, 'library');
    await expect(
      page.getByRole('status').filter({ hasText: 'Đã thêm thu nhập 15,000,000 vào Lương' }),
    ).toBeVisible();
    await expect(page.getByTestId('tx-row').filter({ hasText: 'Lương' })).toContainText(
      '15,000,000',
    );
  });

  test('la nature détectée prime aussi dans l’autre sens : facture scannée depuis Thu nhập → dépense', async ({
    page,
  }) => {
    await page.getByRole('tab', { name: 'Thu nhập' }).click();
    await arm(page, { ...OK_SCAN, date: '2026-01-02' });
    await scan(page);
    await expect(
      page.getByRole('status').filter({ hasText: /^Đã thêm 250,000 vào Ăn uống/ }),
    ).toBeVisible();
    await expect(page.getByTestId('tx-row')).toContainText('-250,000');
  });

  test('message avec plusieurs transactions : rien d’enregistré, message d’échec, saisie vide', async ({
    page,
  }) => {
    await arm(page, {
      kind: 'ok',
      docKind: 'other',
      txType: 'expense',
      amount: 0,
      confidence: 0,
    });
    await scan(page, 'library');
    await expect(page.getByTestId('scan-message')).toHaveText(
      'Không đọc được hóa đơn hoặc giao dịch, vui lòng kiểm tra',
    );
    await expect(page.getByTestId('amount-display')).toHaveCount(0); // aucune catégorie présélectionnée
    await page.getByRole('button', { name: 'Hủy' }).click();
    await expect(page.getByTestId('empty-state')).toBeVisible();
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
      'Không đọc được hóa đơn hoặc giao dịch, vui lòng kiểm tra',
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
    await expect(page.getByTestId('scan-camera')).toBeDisabled();
    await expect(page.getByTestId('scan-library')).toBeDisabled();
    await expect(page.getByTestId('scan-offline')).toHaveText('Cần kết nối mạng để quét hóa đơn');
    await context.setOffline(false);
    await expect(page.getByTestId('scan-camera')).toBeEnabled();
    await expect(page.getByTestId('scan-library')).toBeEnabled();
    await expect(page.getByTestId('scan-offline')).toBeHidden();
  });

  test('deux boutons : appareil photo (capture) et bibliothèque (sans capture)', async ({
    page,
  }) => {
    const camera = page.getByTestId('scan-camera');
    const library = page.getByTestId('scan-library');
    await expect(camera).toHaveText('Chụp ảnh');
    await expect(library).toHaveText('Thư viện ảnh');
    await expect(camera).toHaveAttribute('aria-label', 'Chụp ảnh hóa đơn bằng camera');
    await expect(library).toHaveAttribute('aria-label', 'Chọn ảnh hóa đơn từ thư viện ảnh');
    // côte à côte, même largeur
    const [a, b] = await Promise.all([camera.boundingBox(), library.boundingBox()]);
    expect(a && b && Math.abs(a.y - b.y) < 1 && Math.abs(a.width - b.width) < 1).toBe(true);
    const camIn = page.getByTestId('scan-camera-input');
    const libIn = page.getByTestId('scan-library-input');
    await expect(camIn).toHaveAttribute('accept', 'image/*');
    await expect(camIn).toHaveAttribute('capture', 'environment');
    await expect(libIn).toHaveAttribute('accept', 'image/*');
    await expect(libIn).not.toHaveAttribute('capture', /.*/);
  });

  test('scan depuis la bibliothèque : la dépense est créée comme avec la caméra', async ({
    page,
  }) => {
    await arm(page, { ...OK_SCAN, date: '2026-01-02', merchant: 'Bách Hóa Xanh' });
    await scan(page, 'library');
    await expect(
      page.getByRole('status').filter({ hasText: 'Đã thêm 250,000 vào Ăn uống' }),
    ).toBeVisible();
    const row = page.getByTestId('tx-row');
    await expect(row).toHaveCount(1);
    await expect(row).toContainText('Bách Hóa Xanh');
    await page.getByTestId('toast-action').click();
    await expect(page).toHaveURL(/\/tx\/[0-9a-f-]{36}$/);
  });

  test('capture d’écran PNG très haute (facture électronique) : passe la compression', async ({
    page,
  }) => {
    await arm(page, OK_SCAN);
    const png = await makeImage(page, 800, 3000, 'image/png');
    await page
      .getByTestId('scan-library-input')
      .setInputFiles({ name: 'hoadon.png', mimeType: 'image/png', buffer: png });
    await expect(page.getByTestId('tx-row')).toHaveCount(1);
    const size = await sentSize(page);
    expect(size.height).toBe(1600);
    expect(size.width).toBe(Math.round((800 * 1600) / 3000));
  });

  test('photo de 12 Mpx : réduite à 1600 px avant envoi', async ({ page }) => {
    await arm(page, OK_SCAN);
    const big = await makeImage(page, 4000, 3000, 'image/jpeg');
    await page
      .getByTestId('scan-library-input')
      .setInputFiles({ name: 'IMG_0001.jpg', mimeType: 'image/jpeg', buffer: big });
    await expect(page.getByTestId('tx-row')).toHaveCount(1);
    expect(await sentSize(page)).toEqual({ width: 1600, height: 1200 });
  });

  test('orientation EXIF 6 : la facture arrive en portrait, pas couchée', async ({ page }) => {
    await arm(page, OK_SCAN);
    // pixels stockés 3000×2000 (paysage) + EXIF « tourner de 90° » = facture portrait 2000×3000
    const jpeg = withExifOrientation(await makeImage(page, 3000, 2000, 'image/jpeg'), 6);
    await page
      .getByTestId('scan-library-input')
      .setInputFiles({ name: 'IMG_0002.jpg', mimeType: 'image/jpeg', buffer: jpeg });
    await expect(page.getByTestId('tx-row')).toHaveCount(1);
    const size = await sentSize(page);
    expect(size.height).toBe(1600);
    expect(size.width).toBe(1067);
  });

  test('image illisible (HEIC non décodable) : message, rien d’enregistré, pas de plantage', async ({
    page,
  }) => {
    await arm(page, OK_SCAN);
    const fakeHeic = Buffer.concat([
      Buffer.from([0, 0, 0, 24]),
      Buffer.from('ftypheic', 'ascii'),
      Buffer.alloc(64, 7),
    ]);
    await page
      .getByTestId('scan-library-input')
      .setInputFiles({ name: 'IMG_0003.HEIC', mimeType: 'image/heic', buffer: fakeHeic });
    await expect(page.getByTestId('scan-message')).toHaveText('Không đọc được ảnh này');
    await expect(page.getByTestId('scan-overlay')).toBeHidden();
    await expect(page).toHaveURL(/\/tx\/new/);
    // l'écran reste utilisable : on peut rescanner une image valide
    await scan(page, 'library');
    await expect(page.getByTestId('tx-row')).toHaveCount(1);
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
  await expect(page.getByTestId('scan-camera')).toHaveCount(0);
  await expect(page.getByTestId('scan-library')).toHaveCount(0);
});
