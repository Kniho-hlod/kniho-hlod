import { expect, test } from '@playwright/test';
import { API_URL, PASSWORD, register, uniqueEmail } from './accounts';

/** The release this reader saw last: everything after it is news. */
const LAST_SEEN_RELEASE = '1.2';

test('a reader hears once what is new, and finds the whole history in the menu', async ({
  page,
  request,
}) => {
  const email = uniqueEmail('news');
  const token = await register(request, email, 'Věrná Čtenářka');
  const seen = await request.patch(`${API_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { lastSeenRelease: LAST_SEEN_RELEASE },
  });
  expect(seen.ok()).toBe(true);

  await test.step('sign in to the news since the last release seen', async () => {
    await page.goto('/login');
    await page.getByLabel('E-mail').fill(email);
    await page.getByLabel('Heslo', { exact: true }).fill(PASSWORD);
    await page.getByRole('button', { name: 'Přihlásit se' }).click();

    const news = page.getByRole('dialog', { name: /Novinky ve verzi/ });
    await expect(news).toBeVisible();
    await expect(news.getByRole('heading', { name: 'Průvodce s knihomolem' })).toBeVisible();
    await expect(news.getByRole('heading', { name: 'Hlášení chyb a nápadů' })).toBeHidden();
    await news.getByRole('button', { name: 'Díky!' }).click();
    await expect(news).toBeHidden();
  });

  await test.step('the news does not come again', async () => {
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Ahoj, Věrná!' })).toBeVisible();
    await expect(page.getByRole('dialog')).toBeHidden();
  });

  await test.step('the menu shows the version and opens every release', async () => {
    await page.getByRole('button', { name: 'Účet a nastavení' }).click();
    await expect(page.getByText(/^verze \d+(\.\d+)+ · sestavení \w+$/)).toBeVisible();
    await page.getByRole('menuitem', { name: 'Co je nového' }).click();

    const history = page.getByRole('dialog', { name: 'Co je nového' });
    await expect(history.getByRole('heading', { name: 'Nový Kniho-hlod' })).toBeVisible();
    await expect(history.getByRole('heading', { name: 'Hlášení chyb a nápadů' })).toBeVisible();
    await expect(history.getByText('Aktuální')).toBeVisible();
    await history.getByRole('button', { name: 'Díky!' }).click();
    await expect(history).toBeHidden();
  });
});
