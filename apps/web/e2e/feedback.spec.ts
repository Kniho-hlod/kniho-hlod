import { expect, test } from '@playwright/test';
import { promoteToAdmin, register, signIn, signOut, uniqueEmail } from './accounts';
import { waitForEmail } from './mailpit';

/** A 1×1 PNG: a real image, so the app can shrink it before uploading. */
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

test('a reader reports a bug, and an administrator resolves it', async ({ page, request }) => {
  const readerEmail = uniqueEmail('reporter');
  const adminEmail = uniqueEmail('admin');
  const message = `Po uložení knihy zmizí obálka ${Date.now()}`;
  await register(request, readerEmail, 'Hlásící čtenář');
  await register(request, adminEmail, 'Správkyně hlášení');
  promoteToAdmin(adminEmail);

  await test.step('the reader sends a report with a screenshot from the account menu', async () => {
    await signIn(page, readerEmail);
    await page.getByRole('button', { name: 'Účet a nastavení' }).click();
    await page.getByRole('menuitem', { name: 'Nahlásit chybu nebo nápad' }).click();
    const dialog = page.getByRole('dialog', { name: 'Nahlásit chybu nebo nápad' });
    await expect(dialog.getByRole('radio', { name: 'Chyba' })).toBeChecked();
    await dialog.getByLabel('Zpráva').fill(message);
    await dialog
      .locator('input[type="file"]')
      .setInputFiles({ name: 'screenshot.png', mimeType: 'image/png', buffer: TINY_PNG });
    await dialog.getByRole('button', { name: 'Odeslat' }).click();

    await expect(page.getByText('Díky! Hlášení jsme dostali.', { exact: true })).toBeVisible();
    await expect(dialog).toHaveCount(0);
  });

  await test.step('the administrators hear of it by e-mail', async () => {
    const email = await waitForEmail(adminEmail);
    expect(email).toContain(message);
    expect(email).toContain(readerEmail);
    await signOut(page);
  });

  await test.step('an administrator finds it among the new reports and resolves it', async () => {
    await signIn(page, adminEmail);
    await page.getByRole('link', { name: 'Správa' }).first().click();
    await page.getByRole('link', { name: /Chyby a nápady od uživatelů/ }).click();
    await expect(page.getByRole('heading', { name: 'Hlášení' })).toBeVisible();

    const card = page.getByRole('listitem').filter({ hasText: message });
    await expect(card.getByText(readerEmail)).toBeVisible();
    await expect(card.getByRole('img', { name: 'Obrázek k hlášení' })).toBeVisible();
    await card.getByRole('button', { name: 'Vyřešeno' }).click();

    await expect(page.getByText('Hlášení je vyřešené.', { exact: true })).toBeVisible();
    await expect(card).toHaveCount(0);
    await page.getByRole('tab', { name: 'Vyřešená' }).click();
    await expect(page.getByRole('listitem').filter({ hasText: message })).toBeVisible();
  });
});
