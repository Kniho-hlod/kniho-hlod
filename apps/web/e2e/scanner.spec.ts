import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import type { IsbnLookupResult } from '@kniho-hlod/domain';
import { writeBarcodeVideo } from './barcode-video';
import { API_URL, register, signIn, skipTour, uniqueEmail as accountEmail } from './accounts';
import { answerFromCzechLibraries } from './czech-libraries';

const PASSWORD = 'correct-horse-battery';
const ISBN = '9780306406157';
const FOUND: IsbnLookupResult = {
  isbn: ISBN,
  title: 'Hobit',
  author: 'J. R. R. Tolkien',
  publisher: 'Argo',
  publishedYear: 2012,
  pageCount: 320,
  language: 'cs',
  description: null,
  hasCover: false,
};

// The camera films a barcode instead of the room: Chromium plays this file as its only camera.
const VIDEO_DIR = fileURLToPath(new URL('../test-results/fake-camera/', import.meta.url));
const VIDEO_PATH = `${VIDEO_DIR}isbn-barcode.y4m`;
mkdirSync(VIDEO_DIR, { recursive: true });
writeBarcodeVideo(VIDEO_PATH, ISBN);

test.use({
  permissions: ['camera'],
  launchOptions: {
    args: [
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream',
      `--use-file-for-fake-video-capture=${VIDEO_PATH}`,
    ],
  },
});

function uniqueEmail(): string {
  return `e2e-scanner-${Date.now()}-${Math.round(Math.random() * 1000)}@kniho-hlod.test`;
}

test("a reader adds a book by scanning its barcode, and is warned when it's there already", async ({
  page,
}) => {
  await page.route(`**/api/isbn/${ISBN}`, (route) => route.fulfill({ json: FOUND }));
  await answerFromCzechLibraries(page);

  await test.step('register', async () => {
    await page.goto('/register');
    await page.getByLabel('Jméno').fill('Scanner');
    await page.getByLabel('E-mail').fill(uniqueEmail());
    await page.getByLabel('Heslo', { exact: true }).fill(PASSWORD);
    await page.getByRole('button', { name: 'Založit účet' }).click();
    await skipTour(page);
    await expect(page.getByRole('heading', { name: /Ahoj/ })).toBeVisible();
  });

  await test.step('scan the barcode from the book list', async () => {
    await page.getByRole('link', { name: 'Knihy', exact: true }).first().click();
    await page.getByRole('link', { name: 'Naskenovat' }).click();
    await expect(page.getByRole('dialog', { name: 'Naskenovat ISBN' })).toBeVisible();

    // The dialog closes by itself once the barcode is read, and the catalogue fills the form.
    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 15_000 });
    await expect(page.getByLabel('ISBN')).toHaveValue(ISBN);
    await expect(page.getByLabel('Název')).toHaveValue('Hobit');

    await page.getByRole('button', { name: 'Uložit' }).click();
    await expect(page.getByRole('heading', { name: 'Hobit' })).toBeVisible();
  });

  await test.step('scanning it again points to the copy in the library', async () => {
    await page.goto('/books/new');
    await page.getByRole('button', { name: 'Naskenovat' }).click();
    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 15_000 });
    await expect(page.getByText('Tuhle knihu už v knihovně máte: „Hobit“.')).toBeVisible();

    await page.getByRole('link', { name: 'Otevřít' }).click();
    await expect(page.getByRole('heading', { name: 'Hobit' })).toBeVisible();
  });
});

test('a reader checks by scanning whether a book is in the library', async ({ page }) => {
  await page.route(`**/api/isbn/${ISBN}`, (route) => route.fulfill({ json: FOUND }));
  await answerFromCzechLibraries(page);

  await test.step('register', async () => {
    await page.goto('/register');
    await page.getByLabel('Jméno').fill('Checker');
    await page.getByLabel('E-mail').fill(uniqueEmail());
    await page.getByLabel('Heslo', { exact: true }).fill(PASSWORD);
    await page.getByRole('button', { name: 'Založit účet' }).click();
    await skipTour(page);
    await expect(page.getByRole('heading', { name: /Ahoj/ })).toBeVisible();
  });

  await test.step('a book not in the library can go straight into the form', async () => {
    await page.goto('/books');
    await page.getByRole('button', { name: 'Mám ji už?' }).click();
    const dialog = page.getByRole('dialog', { name: 'Mám ji už?' });
    await expect(dialog.getByText('Tuhle knihu zatím nemáte.')).toBeVisible({ timeout: 15_000 });
    await expect(dialog.getByText('Hobit')).toBeVisible();

    await dialog.getByRole('button', { name: 'Přidat do knihovny' }).click();
    await expect(page.getByLabel('ISBN')).toHaveValue(ISBN);
    await expect(page.getByLabel('Název')).toHaveValue('Hobit');
    await page.getByRole('button', { name: 'Uložit' }).click();
    await expect(page.getByRole('heading', { name: 'Hobit' })).toBeVisible();
  });

  await test.step('a book in the library opens from the answer', async () => {
    await page.goto('/books');
    await page.getByRole('button', { name: 'Mám ji už?' }).click();
    const dialog = page.getByRole('dialog', { name: 'Mám ji už?' });
    await expect(dialog.getByText('Tuhle knihu už máte.')).toBeVisible({ timeout: 15_000 });
    await dialog.getByRole('button', { name: 'Otevřít knihu' }).click();
    await expect(page.getByRole('heading', { name: 'Hobit' })).toBeVisible();
  });
});

test('a scanned book the reader lacks shows the friends who have it to borrow', async ({
  page,
  request,
}) => {
  await page.route(`**/api/isbn/${ISBN}`, (route) => route.fulfill({ json: FOUND }));
  await answerFromCzechLibraries(page);
  const readerEmail = accountEmail('check-reader');
  const readerToken = await register(request, readerEmail, 'Věra');
  const janaToken = await register(request, accountEmail('check-friend'), 'Jana Půjčovatelka');
  const as = (token: string) => ({ Authorization: `Bearer ${token}` });
  await request.patch(`${API_URL}/api/auth/me`, {
    headers: as(janaToken),
    data: { shareLibrary: true },
  });
  const created = await request.post(`${API_URL}/api/books`, {
    headers: as(janaToken),
    data: { title: 'Hobit', isbn: ISBN },
  });
  expect(created.ok()).toBe(true);
  const invite = await (
    await request.get(`${API_URL}/api/me/invite`, { headers: as(janaToken) })
  ).json();
  expect(
    (
      await request.post(`${API_URL}/api/invites/${invite.code}/accept`, {
        headers: as(readerToken),
      })
    ).ok()
  ).toBe(true);

  await signIn(page, readerEmail);
  await page.goto('/books');
  await page.getByRole('button', { name: 'Mám ji už?' }).click();
  const dialog = page.getByRole('dialog', { name: 'Mám ji už?' });
  await expect(dialog.getByText('Tuhle knihu zatím nemáte.')).toBeVisible({ timeout: 15_000 });
  await expect(dialog.getByRole('heading', { name: 'Mají ji přátelé' })).toBeVisible();
  const janasCopy = dialog.getByRole('button', { name: /Jana Půjčovatelka/ });
  await expect(janasCopy).toContainText('Doma, můžete si ji půjčit');

  await janasCopy.click();
  await expect(page.getByRole('button', { name: 'Požádat o vypůjčení' })).toBeVisible();
});
