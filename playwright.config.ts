import { existsSync } from 'node:fs';
import { defineConfig } from '@playwright/test';

const chromium = [
  process.env.PW_CHROMIUM,
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
].find((p): p is string => Boolean(p) && existsSync(p as string));

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 7_000 },
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173',
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: 'vi-VN',
    timezoneId: 'Asia/Ho_Chi_Minh',
    screenshot: 'only-on-failure',
    launchOptions: chromium
      ? { executablePath: chromium, args: ['--no-sandbox'] }
      : { args: ['--no-sandbox'] },
  },
  // Build e2e (VITE_E2E=1) servi en preview : service worker actif, donc test hors ligne possible.
  webServer: {
    command: 'npm run build:e2e && npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: true,
    timeout: 180_000,
    env: { VITE_E2E: '1' },
  },
});
