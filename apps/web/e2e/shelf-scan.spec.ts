import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import type { IsbnLookupResult } from '@kniho-hlod/domain';
import { writeBarcodeVideo } from './barcode-video';
import { register, signIn, uniqueEmail } from './accounts';
import { answerFromCzechLibraries } from './czech-libraries';

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
const VIDEO_PATH = `${VIDEO_DIR}shelf-barcode.y4m`;
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

test('a reader scans books off a shelf and adds them at once', async ({ page, request }) => {
  await page.route(`**/api/isbn/${ISBN}`, (route) => route.fulfill({ json: FOUND }));
  await answerFromCzechLibraries(page);
  const email = uniqueEmail('shelf-scan');
  await register(request, email, 'Skener');
  await signIn(page, email);

  await test.step('the scanned book is looked up and listed once', async () => {
    await page.goto('/books');
    await page.getByRole('link', { name: 'Sken poličky' }).first().click();
    await expect(page.getByRole('heading', { name: 'Sken celé poličky' })).toBeVisible();
    await expect(page.getByText('Hobit')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('J. R. R. Tolkien')).toBeVisible();
    await expect(page.getByRole('status')).toHaveText('Načteno, další knihu!');
    // The barcode stays in front of the camera, read again and again, but listed only once.
    await page.waitForTimeout(3_000);
    await expect(page.getByText('Hobit')).toHaveCount(1);
  });

  await test.step('adding puts it into the library', async () => {
    await page.getByRole('button', { name: 'Přidat 1 knihu' }).click();
    await expect(page.getByRole('heading', { name: 'Přidali jsme 1 knihu' })).toBeVisible();
    await page.getByRole('link', { name: 'Do knihovny' }).click();
    await expect(page.getByRole('link', { name: /^Hobit/ })).toBeVisible();
  });

  await test.step('scanning it again says it is in the library already', async () => {
    await page.goto('/books/scan');
    await expect(page.getByText('Už ji máte v knihovně, nepřidáme ji znovu.')).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole('button', { name: 'Přidat knihy' })).toBeDisabled();
  });
});
