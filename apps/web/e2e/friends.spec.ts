import { expect, test } from '@playwright/test';
import type { APIRequestContext, Browser, Page } from '@playwright/test';
import { API_URL, PASSWORD, register, signIn, uniqueEmail } from './accounts';
import { clearInbox, waitForEmail } from './mailpit';

const WEB_URL = 'http://localhost:5173';

/** A second (or third) reader at another browser, in the Czech the tests assert. */
async function anotherReader(browser: Browser): Promise<Page> {
  const context = await browser.newContext({ baseURL: WEB_URL, locale: 'cs-CZ' });
  return context.newPage();
}

/** Shares the account's library and gives it a book being read, straight through the API. */
async function shareLibraryWithBook(request: APIRequestContext, token: string, title: string) {
  const headers = { Authorization: `Bearer ${token}` };
  const shared = await request.patch(`${API_URL}/api/auth/me`, {
    headers,
    data: { shareLibrary: true },
  });
  expect(shared.ok()).toBe(true);
  const book = await request.post(`${API_URL}/api/books`, {
    headers,
    data: { title, author: 'Zdeněk Jirotka', readingStatus: 'reading' },
  });
  expect(book.ok()).toBe(true);
}

test('readers become friends by link and by e-mail, and browse a shared library', async ({
  page,
  browser,
  request,
}) => {
  const olgaEmail = uniqueEmail('olga');
  const pavelEmail = uniqueEmail('pavel');
  const cyrilEmail = uniqueEmail('cyril');
  const olgaToken = await register(request, olgaEmail, 'Olga');
  await register(request, pavelEmail, 'Pavel');
  await register(request, cyrilEmail, 'Cyril');
  await shareLibraryWithBook(request, olgaToken, 'Saturnin');
  await clearInbox();
  const pavel = await anotherReader(browser);
  const cyril = await anotherReader(browser);
  let inviteLink = '';

  await test.step('Olga copies her invite link', async () => {
    await signIn(page, olgaEmail);
    await page.getByRole('link', { name: 'Přátelé' }).first().click();
    await expect(page.getByRole('heading', { name: 'Pozvat přátele' })).toBeVisible();
    const link = page.getByLabel('Váš odkaz s pozvánkou');
    await expect(link).toHaveValue(/\/invite\//);
    inviteLink = await link.inputValue();
    await page.getByRole('button', { name: 'Ukázat QR kód' }).click();
    await expect(page.getByRole('img', { name: 'QR kód s odkazem na pozvánku' })).toBeVisible();
  });

  await test.step('Pavel opens it, accepts and browses her library', async () => {
    await signIn(pavel, pavelEmail);
    await pavel.goto(inviteLink);
    await expect(pavel.getByRole('heading', { name: 'Olga vás zve mezi přátele' })).toBeVisible();
    await pavel.getByRole('button', { name: 'Přijmout pozvání' }).click();

    await expect(pavel.getByRole('heading', { name: 'Olga', exact: true })).toBeVisible();
    await pavel.getByRole('link', { name: /Saturnin/ }).click();
    await expect(pavel.getByRole('heading', { name: 'Saturnin' })).toBeVisible();
    await expect(pavel.getByText('Doma', { exact: true })).toBeVisible();

    await pavel.getByRole('link', { name: 'Přehled' }).first().click();
    await expect(pavel.getByRole('heading', { name: 'Přátelé právě čtou' })).toBeVisible();
    await expect(pavel.getByText('Olga čte')).toBeVisible();
  });

  await test.step('Pavel invites Cyril by e-mail', async () => {
    await pavel.getByRole('link', { name: 'Přátelé' }).first().click();
    // With a friend already, the page opens on what friends read.
    await expect(pavel.getByText('Olga čte')).toBeVisible();
    await pavel.getByRole('tab', { name: 'Vaši přátelé' }).click();
    await pavel.getByLabel('Pozvat e-mailem').fill(cyrilEmail);
    await pavel.getByRole('button', { name: 'Pozvat', exact: true }).click();
    await expect(
      pavel.getByText(`Pozvánka pro ${cyrilEmail} je na cestě.`, { exact: true })
    ).toBeVisible();
    expect(await waitForEmail(cyrilEmail)).toContain('Pavel vás v Kniho-hlodu žádá o přátelství');
  });

  await test.step('Cyril hears the bell and accepts', async () => {
    await signIn(cyril, cyrilEmail);
    await cyril.getByRole('button', { name: 'Upozornění, nepřečtená: 1' }).click();
    await cyril.getByRole('button', { name: /Pavel vás žádá o přátelství/ }).click();

    await expect(cyril.getByRole('heading', { name: 'Žádosti o přátelství' })).toBeVisible();
    await cyril.getByRole('button', { name: 'Přijmout' }).click();
    await expect(cyril.getByText('Vy a Pavel jste teď přátelé.', { exact: true })).toBeVisible();
    // The friends page opens on the news; the friends themselves are on the next tab.
    await cyril.getByRole('tab', { name: 'Vaši přátelé' }).click();
    await expect(cyril.getByRole('link', { name: /Pavel/ })).toBeVisible();
    await expect(cyril.getByRole('button', { name: 'Upozornění' })).toBeVisible();
  });

  await test.step('Olga hears that Pavel accepted', async () => {
    await page.reload();
    await page.getByRole('button', { name: 'Upozornění, nepřečtená: 1' }).click();
    await expect(page.getByText('Vy a Pavel jste teď přátelé')).toBeVisible();
  });
});

test('a visitor signs up through an invite link and becomes a friend', async ({
  page,
  request,
}) => {
  const inviterEmail = uniqueEmail('inviter');
  const inviterToken = await register(request, inviterEmail, 'Iveta');
  const invite = await request.get(`${API_URL}/api/me/invite`, {
    headers: { Authorization: `Bearer ${inviterToken}` },
  });
  const { code } = await invite.json();

  await page.goto(`/invite/${code}`);
  await expect(page.getByRole('heading', { name: 'Iveta vás zve mezi přátele' })).toBeVisible();
  await page.getByRole('link', { name: 'Založit účet a přijmout' }).click();
  await page.getByLabel('Jméno').fill('Nový Host');
  await page.getByLabel('E-mail').fill(uniqueEmail('visitor'));
  await page.getByLabel('Heslo', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Založit účet' }).click();

  await expect(page).toHaveURL(new RegExp(`/invite/${code}$`));
  await page.getByRole('button', { name: 'Přijmout pozvání' }).click();
  await expect(page.getByRole('heading', { name: 'Iveta', exact: true })).toBeVisible();
  await expect(page.getByText('Iveta zatím knihovnu nesdílí')).toBeVisible();
});
