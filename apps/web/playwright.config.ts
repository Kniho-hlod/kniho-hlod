import { defineConfig, devices } from '@playwright/test';

const WEB_URL = 'http://localhost:5173';
const API_URL = 'http://localhost:3000';
const SERVER_TIMEOUT_MS = 120_000;

/**
 * End-to-end tests drive the real app against the real API. They need the local services first:
 * `docker compose up -d` (Postgres and Mailpit), plus `apps/api/.env` from `.env.example`.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: WEB_URL,
    trace: 'retain-on-failure',
    // The app picks its language from the browser, and these tests assert the Czech UI.
    locale: 'cs-CZ',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'pnpm --filter @kniho-hlod/api dev',
      url: `${API_URL}/`,
      cwd: '../..',
      reuseExistingServer: !process.env.CI,
      timeout: SERVER_TIMEOUT_MS,
    },
    {
      command: 'pnpm --filter @kniho-hlod/web dev',
      url: WEB_URL,
      cwd: '../..',
      reuseExistingServer: !process.env.CI,
      timeout: SERVER_TIMEOUT_MS,
    },
  ],
});
