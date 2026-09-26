import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { IsbnCover, IsbnLookupResult } from '@kniho-hlod/domain';
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
const CZECH_ISBN = '9788072037285';
/** How knihovny.cz lists a Czech edition: cataloguing punctuation, life dates and all. */
const LIBRARY_RECORD = {
  title: 'Pán prstenů. Návrat krále /',
  primaryAuthors: ['J. R. R. Tolkien, 1892-1973'],
  publishers: ['Argo,'],
  publicationDates: ['c2007'],
  physicalDescriptions: ['476 s. ; 22 cm'],
  isbns: ['978-80-7203-728-5'],
};

function uniqueEmail(): string {
  return `e2e-books-${Date.now()}-${Math.round(Math.random() * 1000)}@kniho-hlod.test`;
}

async function register(page: Page, name: string): Promise<void> {
  await page.goto('/register');
  await page.getByLabel('Jméno').fill(name);
  await page.getByLabel('E-mail').fill(uniqueEmail());
  await page.getByLabel('Heslo').fill(PASSWORD);
  await page.getByRole('button', { name: 'Založit účet' }).click();
  await expect(page.getByRole('heading', { name: /Vítejte/ })).toBeVisible();
}

test('a reader adds a book by its ISBN, edits it and deletes it', async ({ page }) => {
  // Open Library and Google Books are not ours to test: answer the lookup the API would proxy.
  await page.route(`**/api/isbn/${ISBN}`, (route) => route.fulfill({ json: FOUND }));
  await page.route(`**/api/isbn/${ISBN}/cover`, (route) =>
    route.fulfill({ json: CATALOGUE_COVER })
  );
  await answerFromCzechLibraries(page);

  await test.step('register', () => register(page, 'Book Reader'));

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

test('a Czech edition is filled in from the Czech libraries, asked by the browser', async ({
  page,
}) => {
  // Open Library and Google Books don't know it; knihovny.cz does.
  await page.route(`**/api/isbn/${CZECH_ISBN}`, (route) =>
    route.fulfill({
      status: 404,
      json: { error: 'Not Found', message: 'No catalogue knows this ISBN' },
    })
  );
  await answerFromCzechLibraries(page, [LIBRARY_RECORD]);
  await register(page, 'Czech Reader');

  await page.goto('/books/new');
  await page.getByLabel('ISBN').fill(CZECH_ISBN);
  await page.getByRole('button', { name: 'Vyhledat' }).click();

  await expect(page.getByLabel('Název')).toHaveValue('Pán prstenů. Návrat krále');
  await expect(page.getByLabel('Autor')).toHaveValue('J. R. R. Tolkien');
  await expect(page.getByLabel('Nakladatel')).toHaveValue('Argo');
  await expect(page.getByLabel('Počet stran')).toHaveValue('476');
});
