import { execSync } from 'node:child_process';
import { expect } from '@playwright/test';
import type { APIRequestContext, Page } from '@playwright/test';

export const PASSWORD = 'correct-horse-battery';
export const API_URL = 'http://localhost:3000';
const CREATED = 201;

export function uniqueEmail(kind: string): string {
  return `e2e-${kind}-${Date.now()}-${Math.round(Math.random() * 1000)}@kniho-hlod.test`;
}

/**
 * Registers an account straight through the API, as a reader who has had the tour. Answers the
 * account's access token.
 */
export async function register(
  request: APIRequestContext,
  email: string,
  displayName: string
): Promise<string> {
  const registered = await request.post(`${API_URL}/api/auth/register`, {
    data: { email, password: PASSWORD, displayName },
  });
  expect(registered.status()).toBe(CREATED);
  const { token } = await registered.json();
  const onboarded = await request.patch(`${API_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { onboardedAt: new Date().toISOString() },
  });
  expect(onboarded.ok()).toBe(true);
  return token;
}

/** A new reader is greeted with the tour on the home page; tests about other things skip it. */
export async function skipTour(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Přeskočit, jdu rovnou do aplikace' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
}

/** Makes an account an administrator as production does it: with the API's seed script. */
export function promoteToAdmin(email: string): void {
  execSync('pnpm --filter @kniho-hlod/api seed:admin', {
    env: { ...process.env, ADMIN_EMAIL: email, ADMIN_PASSWORD: PASSWORD },
    stdio: 'pipe',
  });
}

export async function signIn(page: Page, email: string): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Heslo', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Přihlásit se' }).click();
  await expect(page.getByRole('heading', { name: /Ahoj/ })).toBeVisible();
}

export async function signOut(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Účet a nastavení' }).click();
  await page.getByRole('menuitem', { name: 'Odhlásit se' }).click();
  await expect(page.getByRole('heading', { name: 'Přihlášení' })).toBeVisible();
}
