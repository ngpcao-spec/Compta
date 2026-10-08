import { expect, test, type Page } from '@playwright/test';
import { login } from './helpers';

async function openCategories(page: Page) {
  await page.getByRole('link', { name: 'Thêm', exact: true }).click();
  await page.getByRole('link', { name: 'Danh mục' }).click();
  await expect(page.getByRole('heading', { name: 'Danh mục' })).toBeVisible();
}

test.describe('catégories', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await openCategories(page);
  });

  test('compte les catégories par défaut (35 / 5)', async ({ page }) => {
    await expect(page.getByRole('tab', { name: 'Chi tiêu (35)' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Thu nhập (5)' })).toBeVisible();
    await page.getByRole('tab', { name: 'Thu nhập (5)' }).click();
    await expect(page.getByTestId('category-card')).toHaveCount(5);
  });

  test('créer, renommer, réordonner, archiver, restaurer', async ({ page }) => {
    // créer
    await page.getByTestId('add-category').click();
    await page.getByLabel('Tên danh mục').fill('Thử nghiệm');
    await page.getByRole('radio', { name: 'dog' }).click();
    await page.getByTestId('save-category').click();
    await expect(page.getByRole('tab', { name: 'Chi tiêu (36)' })).toBeVisible();
    await expect(page.getByTestId('category-card').last()).toContainText('Thử nghiệm');

    // renommer
    await page.getByRole('button', { name: 'Menu Thử nghiệm' }).click();
    await page.getByRole('button', { name: 'Sửa', exact: true }).click();
    await page.getByLabel('Tên danh mục').fill('Đã đổi tên');
    await page.getByTestId('save-category').click();
    await expect(page.getByTestId('category-card').last()).toContainText('Đã đổi tên');

    // réordonner (clavier dnd-kit : espace, flèche bas, espace)
    const first = await page.getByTestId('category-card').first().innerText();
    await page.getByTestId('reorder-toggle').click();
    const handle = page.getByTestId('drag-handle').first();
    await handle.focus();
    await page.keyboard.press('Space');
    await page.waitForTimeout(150);
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(250);
    await page.keyboard.press('Space');
    await page.waitForTimeout(250);
    await page.getByTestId('reorder-done').click();
    await expect(page.getByTestId('category-card').nth(1)).toContainText(first.trim());

    // archiver puis restaurer
    await page.getByRole('button', { name: 'Menu Đã đổi tên' }).click();
    await page.getByRole('button', { name: 'Ẩn', exact: true }).click();
    await expect(page.getByRole('tab', { name: 'Chi tiêu (35)' })).toBeVisible();
    await page.getByTestId('hidden-toggle').click();
    await expect(page.getByText('Đã đổi tên')).toBeVisible();
    await page.getByRole('button', { name: 'Khôi phục' }).click();
    await expect(page.getByRole('tab', { name: 'Chi tiêu (36)' })).toBeVisible();
  });

  test('l’ordre et les modifications survivent à un rechargement', async ({ page }) => {
    await page.getByTestId('add-category').click();
    await page.getByLabel('Tên danh mục').fill('Persistante');
    await page.getByTestId('save-category').click();
    // l'écriture locale est terminée quand l'app revient à la liste
    await expect(page.getByTestId('category-card').last()).toContainText('Persistante');
    await page.reload();
    await expect(page.getByTestId('category-card').last()).toContainText('Persistante');
  });
});
