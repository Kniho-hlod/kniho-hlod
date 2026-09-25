import { expect, test } from '@playwright/test';
import { clearInbox, findLink, waitForEmail } from './mailpit';

const PASSWORD = 'correct-horse-battery';
const NEW_PASSWORD = 'brand-new-secret-phrase';

function uniqueEmail(): string {
  return `e2e-${Date.now()}-${Math.round(Math.random() * 1000)}@kniho-hlod.test`;
}

test('a reader registers, signs out, resets their password and signs back in', async ({ page }) => {
  const email = uniqueEmail();
  await clearInbox();

  await test.step('register', async () => {
    await page.goto('/register');
    await page.getByLabel('Jméno').fill('E2E Reader');
    await page.getByLabel('E-mail').fill(email);
    await page.getByLabel('Heslo').fill(PASSWORD);
    await page.getByRole('button', { name: 'Založit účet' }).click();
    await expect(page.getByRole('heading', { name: /Vítejte, E2E Reader/ })).toBeVisible();
  });

  await test.step('stay signed in across a reload', async () => {
    await page.reload();
    await expect(page.getByRole('heading', { name: /Vítejte, E2E Reader/ })).toBeVisible();
  });

  await test.step('sign out', async () => {
    await page.getByRole('button', { name: 'Odhlásit se' }).click();
    await expect(page.getByRole('heading', { name: 'Přihlášení' })).toBeVisible();
  });

  await test.step('ask for a reset link', async () => {
    await page.getByRole('link', { name: 'Zapomenuté heslo' }).click();
    // Both pages have an e-mail field: wait for the new one, or the fill lands on sign-in.
    await expect(page.getByRole('heading', { name: 'Obnovení hesla' })).toBeVisible();
    await page.getByLabel('E-mail').fill(email);
    await page.getByRole('button', { name: 'Odeslat' }).click();
    await expect(page.getByText(/poslali jsme na něj odkaz/)).toBeVisible();
  });

  await test.step('set a new password from the emailed link', async () => {
    const resetLink = findLink(await waitForEmail(email));
    await page.goto(resetLink);
    await page.getByLabel('Nové heslo').fill(NEW_PASSWORD);
    await page.getByRole('button', { name: 'Uložit' }).click();
    await expect(page.getByText('Heslo je změněné, můžete se přihlásit.')).toBeVisible();
  });

  await test.step('the old password no longer works, the new one does', async () => {
    await page.goto('/login');
    await page.getByLabel('E-mail').fill(email);
    await page.getByLabel('Heslo').fill(PASSWORD);
    await page.getByRole('button', { name: 'Přihlásit se' }).click();
    await expect(page.getByText('Nesprávný e-mail nebo heslo.')).toBeVisible();

    await page.getByLabel('Heslo').fill(NEW_PASSWORD);
    await page.getByRole('button', { name: 'Přihlásit se' }).click();
    await expect(page.getByRole('heading', { name: /Vítejte/ })).toBeVisible();
  });
});
