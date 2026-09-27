import { expect, test } from '@playwright/test';
import type { APIRequestContext } from '@playwright/test';
import { API_URL, register, signIn, uniqueEmail } from './accounts';

const WEB_URL = 'http://localhost:5173';

async function call(
  request: APIRequestContext,
  token: string,
  method: string,
  path: string,
  data?: object
) {
  const response = await request.fetch(`${API_URL}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}` },
    data,
  });
  expect(response.ok(), `${method} ${path}`).toBe(true);
  return response.status() === 204 ? null : response.json();
}

test('friends talk under a book, and the owner keeps it tidy', async ({
  page,
  browser,
  request,
}) => {
  const olgaEmail = uniqueEmail('owner');
  const pavelEmail = uniqueEmail('commenter');
  const olgaToken = await register(request, olgaEmail, 'Olga');
  const pavelToken = await register(request, pavelEmail, 'Pavel');
  await call(request, olgaToken, 'PATCH', '/api/auth/me', { shareLibrary: true });
  const olga = await call(request, olgaToken, 'GET', '/api/auth/me');
  const book = await call(request, olgaToken, 'POST', '/api/books', { title: 'Saturnin' });
  const { code } = await call(request, olgaToken, 'GET', '/api/me/invite');
  await call(request, pavelToken, 'POST', `/api/invites/${code}/accept`);
  const pavel = await (await browser.newContext({ baseURL: WEB_URL, locale: 'cs-CZ' })).newPage();

  await test.step('Pavel comments on Olga’s book', async () => {
    await signIn(pavel, pavelEmail);
    await pavel.goto(`/friends/${olga.id}/books/${book.id}`);
    await expect(pavel.getByText('Zatím tu nikdo nic nenapsal.')).toBeVisible();
    await pavel.getByLabel('Napsat komentář').fill('Nejlepší kniha na dovolenou!');
    await pavel.getByRole('button', { name: 'Přidat komentář' }).click();
    await expect(pavel.getByText('Nejlepší kniha na dovolenou!')).toBeVisible();
  });

  await test.step('Olga hears it and answers', async () => {
    await signIn(page, olgaEmail);
    // Unread: Pavel accepting the invite, and his comment.
    await page.getByRole('button', { name: 'Upozornění, nepřečtená: 2' }).click();
    await page.getByRole('button', { name: /Pavel komentuje „Saturnin“/ }).click();
    await expect(page.getByRole('heading', { name: 'Saturnin' })).toBeVisible();
    await expect(page.getByText('Nejlepší kniha na dovolenou!')).toBeVisible();
    await page.getByLabel('Napsat komentář').fill('Souhlasím, půjčím ti ji.');
    await page.getByRole('button', { name: 'Přidat komentář' }).click();
    await expect(page.getByText('Souhlasím, půjčím ti ji.')).toBeVisible();
  });

  await test.step('Pavel sees the answer and edits his comment', async () => {
    await pavel.reload();
    await expect(pavel.getByText('Souhlasím, půjčím ti ji.')).toBeVisible();
    await pavel.getByRole('button', { name: 'Akce s komentářem (Pavel)' }).click();
    await pavel.getByRole('menuitem', { name: 'Upravit komentář' }).click();
    await pavel.getByLabel('Upravit komentář').fill('Nejlepší kniha na chalupu!');
    await pavel.getByRole('button', { name: 'Uložit' }).click();
    await expect(pavel.getByText('Nejlepší kniha na chalupu!')).toBeVisible();
    await expect(pavel.getByText('upraveno')).toBeVisible();
    await expect(pavel.getByRole('button', { name: 'Akce s komentářem (Olga)' })).toBeHidden();
  });

  await test.step('Olga deletes Pavel’s comment under her book', async () => {
    await page.reload();
    await page.getByRole('button', { name: 'Akce s komentářem (Pavel)' }).click();
    await page.getByRole('menuitem', { name: 'Smazat komentář' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Smazat' }).click();
    await expect(page.getByText('Nejlepší kniha na chalupu!')).toBeHidden();
    await expect(page.getByText('Souhlasím, půjčím ti ji.')).toBeVisible();
  });
});
