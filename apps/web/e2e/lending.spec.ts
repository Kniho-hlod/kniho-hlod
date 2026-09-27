import { expect, test } from '@playwright/test';
import type { APIRequestContext } from '@playwright/test';
import { API_URL, register, signIn, uniqueEmail } from './accounts';
import { clearInbox, waitForEmail } from './mailpit';

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

test('a friend asks to borrow a book, the owner lends it, and it comes back', async ({
  page,
  browser,
  request,
}) => {
  const olgaEmail = uniqueEmail('lender');
  const pavelEmail = uniqueEmail('borrower');
  const olgaToken = await register(request, olgaEmail, 'Olga');
  const pavelToken = await register(request, pavelEmail, 'Pavel');
  await call(request, olgaToken, 'PATCH', '/api/auth/me', { shareLibrary: true });
  const olga = await call(request, olgaToken, 'GET', '/api/auth/me');
  const book = await call(request, olgaToken, 'POST', '/api/books', {
    title: 'Saturnin',
    author: 'Zdeněk Jirotka',
  });
  const { code } = await call(request, olgaToken, 'GET', '/api/me/invite');
  await call(request, pavelToken, 'POST', `/api/invites/${code}/accept`);
  await clearInbox();
  const pavel = await (await browser.newContext({ baseURL: WEB_URL, locale: 'cs-CZ' })).newPage();

  await test.step('Pavel asks for the book', async () => {
    await signIn(pavel, pavelEmail);
    await pavel.goto(`/friends/${olga.id}/books/${book.id}`);
    await pavel.getByRole('button', { name: 'Požádat o vypůjčení' }).click();
    await pavel.getByLabel('Vzkaz').fill('Vezmu si ji na dovolenou.');
    await pavel.getByRole('button', { name: 'Poslat žádost' }).click();
    await expect(pavel.getByText('Žádost je odeslaná, čeká se na odpověď (Olga).')).toBeVisible();
    expect(await waitForEmail(olgaEmail)).toContain('Vezmu si ji na dovolenou.');
  });

  await test.step('Olga lends it from her overview', async () => {
    await signIn(page, olgaEmail);
    await expect(page.getByRole('heading', { name: 'Žádosti o vypůjčení' })).toBeVisible();
    await expect(page.getByText('Vezmu si ji na dovolenou.')).toBeVisible();
    await page.getByRole('button', { name: 'Půjčit' }).click();
    await expect(page.getByLabel('Vrátit do')).not.toHaveValue('');
    await page.getByRole('button', { name: 'Půjčit' }).click();
    await expect(
      page.getByText('Hotovo, „Saturnin“ je půjčená — Pavel to ví.', { exact: true })
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Žádosti o vypůjčení' })).toBeHidden();

    await page.getByRole('link', { name: 'Výpůjčky' }).first().click();
    await expect(page.getByRole('link', { name: 'Saturnin' })).toBeVisible();
    await expect(page.getByLabel('Komu: Pavel')).toBeVisible();
  });

  await test.step('Pavel hears the answer and sees what he borrowed', async () => {
    await pavel.reload();
    await pavel.getByRole('button', { name: 'Upozornění, nepřečtená: 1' }).click();
    await pavel.getByRole('button', { name: /Olga vám půjčí „Saturnin“/ }).click();
    await expect(pavel).toHaveURL(/\/loans\?tab=borrowed$/);
    await expect(pavel.getByRole('link', { name: 'Saturnin' })).toBeVisible();
    await expect(pavel.getByText('Vlastník: Olga')).toBeVisible();
  });

  await test.step('the book comes back', async () => {
    await page.getByRole('button', { name: 'Vráceno' }).click();
    await pavel.reload();
    await expect(pavel.getByText('Od přátel teď nic půjčeného nemáte')).toBeVisible();
  });
});
