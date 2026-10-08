import { expect, type Page } from '@playwright/test';

export const TODAY_JAN = new Date('2026-01-02T10:00:00+07:00');
export const TODAY_JUL = new Date('2026-07-19T10:00:00+07:00');

/** Fige l'heure (l'app calcule « aujourd'hui » avec Date). */
export async function freeze(page: Page, at: Date): Promise<void> {
  await page.clock.setFixedTime(at);
}

export async function login(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login/);
  await page.getByTestId('e2e-login').click();
  await expect(page.getByRole('link', { name: 'Sổ thu chi' })).toBeVisible();
}

export async function seedDemo(page: Page): Promise<void> {
  await page.waitForFunction(() => Boolean((window as unknown as { __stc?: unknown }).__stc));
  await page.evaluate(() =>
    (window as unknown as { __stc: { seedDemo(): Promise<void> } }).__stc.seedDemo(),
  );
}

/** Saisit un montant avec le clavier-calculatrice (chiffres uniquement). */
export async function typeAmount(page: Page, digits: string): Promise<void> {
  let rest = digits;
  while (rest.length > 0) {
    await page.getByTestId(`key-${rest[0]}`).click();
    rest = rest.slice(1);
  }
}
