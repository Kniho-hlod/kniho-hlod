import { expect, test } from '@playwright/test';
import type { IsbnCover, IsbnLookupResult } from '@kniho-hlod/domain';

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
  description: 'Cesta tam a zase zpátky.',
  hasCover: true,
};
/** A 2×3 blue PNG — small, but a real image the browser has to decode, scale and upload. */
const CATALOGUE_COVER: IsbnCover = {
  mimeType: 'image/png',
  base64:
    'iVBORw0KGgoAAAANSUhEUgAAAAIAAAADCAIAAAA2iEnWAAAAEklEQVR4nGOwbvpm3fSNAYUCAGbACjPC8yHSAAAAAElFTkSuQmCC',
};
const NEW_TITLE = 'Hobit aneb Cesta tam a zase zpátky';

function uniqueEmail(): string {
  return `e2e-books-${Date.now()}-${Math.round(Math.random() * 1000)}@kniho-hlod.test`;
}

test('a reader adds a book by its ISBN, edits it and deletes it', async ({ page }) => {
  // Open Library and Google Books are not ours to test: answer the lookup the API would proxy.
  await page.route(`**/api/isbn/${ISBN}`, (route) => route.fulfill({ json: FOUND }));
  await page.route(`**/api/isbn/${ISBN}/cover`, (route) =>
    route.fulfill({ json: CATALOGUE_COVER })
  );

  await test.step('register', async () => {
    await page.goto('/register');
    await page.getByLabel('Jméno').fill('Book Reader');
    await page.getByLabel('E-mail').fill(uniqueEmail());
    await page.getByLabel('Heslo').fill(PASSWORD);
    await page.getByRole('button', { name: 'Založit účet' }).click();
    await expect(page.getByRole('heading', { name: /Vítejte/ })).toBeVisible();
  });

  await test.step('add a book from the catalogue', async () => {
    await page.getByRole('link', { name: 'Knihy', exact: true }).click();
    await expect(page.getByText(/Zatím tu nemáte žádnou knihu/)).toBeVisible();
    await page.getByRole('link', { name: 'Přidat knihu' }).first().click();
    await expect(page.getByRole('heading', { name: 'Přidat knihu' })).toBeVisible();

    // A typo gets an explanation, not a silently disabled button.
    await page.getByLabel('ISBN').fill('978-0-306-40615-8');
    await page.getByRole('button', { name: 'Vyhledat' }).click();
    await expect(page.getByText(/Tohle není platné ISBN/)).toBeVisible();

    // Copied from a website: a label and en dashes instead of hyphens.
    await page.getByLabel('ISBN').fill('ISBN: 978\u20130\u2013306\u201340615\u20137');
    await page.getByRole('button', { name: 'Vyhledat' }).click();
    await expect(page.getByLabel('Název')).toHaveValue('Hobit');
    await expect(page.getByLabel('Autor')).toHaveValue('J. R. R. Tolkien');
    await expect(page.getByText(/Obálka z katalogu/)).toBeVisible();

    await page.getByRole('button', { name: 'Uložit' }).click();
    await expect(page.getByRole('heading', { name: 'Hobit' })).toBeVisible();
    await expect(page.getByText(ISBN)).toBeVisible();
  });

  await test.step('see the stored cover', async () => {
    // The API serves the stored file itself; an image that fails to load has no natural width.
    const cover = page.getByRole('img', { name: 'Obálka knihy Hobit' });
    await expect
      .poll(() => cover.evaluate((image: HTMLImageElement) => image.naturalWidth))
      .toBeGreaterThan(0);
  });

  await test.step('edit it', async () => {
    await page.getByRole('link', { name: 'Upravit knihu' }).click();
    await expect(page.getByLabel('Název')).toHaveValue('Hobit');
    await page.getByLabel('Název').fill(NEW_TITLE);
    await page.getByRole('button', { name: 'Uložit' }).click();
    await expect(page.getByRole('heading', { name: NEW_TITLE })).toBeVisible();
  });

  await test.step('find it in the list', async () => {
    await page.getByRole('link', { name: 'Knihy', exact: true }).first().click();
    await page.getByLabel('Hledat podle názvu, autora nebo ISBN').fill('tolkien');
    await expect(page.getByRole('link', { name: new RegExp(NEW_TITLE) })).toBeVisible();
  });

  await test.step('delete it', async () => {
    await page.getByRole('link', { name: new RegExp(NEW_TITLE) }).click();
    await page.getByRole('button', { name: 'Smazat knihu' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Smazat', exact: true }).click();
    await expect(page.getByText(/Zatím tu nemáte žádnou knihu/)).toBeVisible();
  });
});
