import { expect, test } from '@playwright/test';
import { login } from './helpers';

test('redirige vers /login sans session', async ({ page }) => {
  await page.goto('/charts');
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole('button', { name: 'Đăng nhập bằng Google' })).toBeVisible();
});

test('connexion, session conservée au rechargement, déconnexion', async ({ page }) => {
  await login(page);
  await expect(page.getByTestId('budget-card').or(page.getByTestId('set-budget'))).toBeVisible();
  await page.reload();
  await expect(page.getByRole('link', { name: 'Sổ thu chi' })).toBeVisible();

  await page.getByRole('link', { name: 'Thêm', exact: true }).click();
  await expect(page.getByText('Người Dùng Thử')).toBeVisible();
  await page.getByTestId('sign-out').click();
  await expect(page).toHaveURL(/\/login/);
  await page.goto('/');
  await expect(page).toHaveURL(/\/login/);
});
