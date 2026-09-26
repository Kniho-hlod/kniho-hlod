import { execSync } from 'node:child_process';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const PASSWORD = 'correct-horse-battery';
const API_URL = 'http://localhost:3000';
const READER_NAME = 'Čtenář k úklidu';

function uniqueEmail(kind: string): string {
  return `e2e-${kind}-${Date.now()}-${Math.round(Math.random() * 1000)}@kniho-hlod.test`;
}

/** Makes an account an administrator as production does it: with the API's seed script. */
function promoteToAdmin(email: string): void {
  execSync('pnpm --filter @kniho-hlod/api seed:admin', {
    env: { ...process.env, ADMIN_EMAIL: email, ADMIN_PASSWORD: PASSWORD },
    stdio: 'pipe',
  });
}

async function signIn(page: Page, email: string): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Heslo').fill(PASSWORD);
  await page.getByRole('button', { name: 'Přihlásit se' }).click();
  await expect(page.getByRole('heading', { name: /Vítejte/ })).toBeVisible();
}

test('an administrator manages accounts and announcements', async ({ page, request }) => {
  const adminEmail = uniqueEmail('admin');
  const readerEmail = uniqueEmail('reader');
  const announcement = `Plánovaná údržba ${Date.now()}`;
  for (const [email, displayName] of [
    [adminEmail, 'Správkyně'],
    [readerEmail, READER_NAME],
  ]) {
    const registered = await request.post(`${API_URL}/api/auth/register`, {
      data: { email, password: PASSWORD, displayName },
    });
    expect(registered.status()).toBe(201);
  }

  await test.step('a reader has no administration', async () => {
    await signIn(page, adminEmail);
    await expect(page.getByRole('link', { name: 'Správa' })).toHaveCount(0);
    await page.goto('/admin');
    await expect(page.getByRole('heading', { name: /Vítejte/ })).toBeVisible();
    await page.getByRole('button', { name: 'Odhlásit se' }).click();
  });

  await test.step('an administrator gets it with the next sign-in', async () => {
    promoteToAdmin(adminEmail);
    await signIn(page, adminEmail);
    await page.getByRole('link', { name: 'Správa' }).first().click();
    await expect(page.getByRole('heading', { name: 'Správa' })).toBeVisible();
    await expect(page.getByText('Noví za 30 dní')).toBeVisible();
  });

  await test.step('make a reader an administrator and back', async () => {
    await page.getByRole('link', { name: /Role a mazání účtů/ }).click();
    await page.getByLabel('Hledat podle jména nebo e-mailu').fill(readerEmail);
    const card = page.getByRole('listitem').filter({ hasText: readerEmail });
    await expect(card).toHaveCount(1);
    const actions = card.getByRole('button', { name: `Akce pro ${READER_NAME}` });

    await actions.click();
    await page.getByRole('menuitem', { name: 'Udělat administrátorem' }).click();
    await expect(
      page.getByText(`Účet ${READER_NAME} má teď administrátorská práva.`, { exact: true })
    ).toBeVisible();
    await expect(card.getByText('Administrátor')).toBeVisible();

    await actions.click();
    await page.getByRole('menuitem', { name: 'Odebrat administrátorská práva' }).click();
    await expect(card.getByText('Administrátor')).toHaveCount(0);
  });

  await test.step('delete the reader’s account', async () => {
    const card = page.getByRole('listitem').filter({ hasText: readerEmail });
    await card.getByRole('button', { name: `Akce pro ${READER_NAME}` }).click();
    await page.getByRole('menuitem', { name: 'Smazat účet' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Smazat účet' }).click();
    await expect(page.getByText(`Účet ${READER_NAME} je smazaný.`, { exact: true })).toBeVisible();
    await expect(page.getByText('Nikoho takového nenacházím.')).toBeVisible();
  });

  await test.step('announce something to everyone', async () => {
    await page.getByRole('link', { name: 'Správa' }).first().click();
    await page.getByRole('link', { name: /Zprávy pro všechny/ }).click();
    await page.getByRole('link', { name: 'Nové oznámení' }).click();
    await page.getByLabel('Nadpis').fill(announcement);
    await page.getByLabel('Zpráva').fill('Dnes večer bude aplikace chvíli nedostupná.');
    await page.getByRole('combobox', { name: 'Závažnost' }).click();
    await page.getByRole('option', { name: 'Upozornění' }).click();
    await page.getByRole('button', { name: 'Uložit' }).click();

    await expect(page.getByText('Oznámení je uložené.', { exact: true })).toBeVisible();
    const card = page.getByRole('link', { name: new RegExp(announcement) });
    await expect(card.getByText('Zobrazuje se')).toBeVisible();

    // The banner above every page shows it at once.
    await page.getByRole('link', { name: 'Přehled' }).first().click();
    await expect(page.getByText(announcement)).toBeVisible();
  });

  await test.step('and take it down again', async () => {
    await page.getByRole('link', { name: 'Správa' }).first().click();
    await page.getByRole('link', { name: /Zprávy pro všechny/ }).click();
    await page.getByRole('link', { name: new RegExp(announcement) }).click();
    await expect(page.getByLabel('Nadpis')).toHaveValue(announcement);
    await page.getByRole('button', { name: 'Smazat oznámení' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Smazat' }).click();
    await expect(page.getByText('Oznámení je smazané.', { exact: true })).toBeVisible();
    await expect(page.getByText(announcement)).toHaveCount(0);
  });
});
