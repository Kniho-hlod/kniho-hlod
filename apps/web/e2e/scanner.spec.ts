import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import type { IsbnLookupResult } from '@kniho-hlod/domain';
import { writeBarcodeVideo } from './barcode-video';
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
    await page.getByLabel('Heslo').fill(PASSWORD);
    await page.getByRole('button', { name: 'Založit účet' }).click();
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
