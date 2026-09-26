import { expect, test } from '@playwright/test';
import { readerToday } from '@kniho-hlod/domain';

const PASSWORD = 'correct-horse-battery';
const SHELVED_TITLE = 'Saturnin';
const OTHER_TITLE = 'Babička';
const SHELF = 'Oblíbené';
const RENAMED_SHELF = 'Nejlepší';
/** A new reader's time zone is the default one, so this is the app's "today" too. */
const TODAY = readerToday(null);

function uniqueEmail(): string {
  return `e2e-shelves-${Date.now()}-${Math.round(Math.random() * 1000)}@kniho-hlod.test`;
}

test('a reader shelves a book, reads it and tidies the shelves', async ({ page }) => {
  await test.step('register', async () => {
    await page.goto('/register');
    await page.getByLabel('Jméno').fill('Shelver');
    await page.getByLabel('E-mail').fill(uniqueEmail());
    await page.getByLabel('Heslo', { exact: true }).fill(PASSWORD);
    await page.getByRole('button', { name: 'Založit účet' }).click();
    await expect(page.getByRole('heading', { name: /Ahoj/ })).toBeVisible();
  });

  await test.step('add a book on a new shelf, started today', async () => {
    await page.goto('/books/new');
    await page.getByLabel('Název').fill(SHELVED_TITLE);

    await page.getByLabel('Stav čtení').click();
    await page.getByRole('option', { name: 'Čtu' }).click();
    await expect(page.getByLabel('Začátek čtení')).toHaveValue(TODAY);

    await page.getByLabel('Poličky').click();
    await page.getByPlaceholder('Hledat nebo napsat novou').fill(SHELF);
    await page.getByRole('option', { name: `Nová polička: ${SHELF}` }).click();
    await expect(page.getByRole('option', { name: SHELF, exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    // Typed while the menu is still closing, text would go to the menu instead of the next field.
    await expect(page.getByRole('listbox')).toBeHidden();
    await expect(page.getByLabel('Poličky')).toHaveText(SHELF);

    await page.getByLabel('Poznámky').fill('Skvělý humor.');
    await page.getByRole('button', { name: 'Uložit' }).click();

    await expect(page.getByRole('heading', { name: SHELVED_TITLE })).toBeVisible();
    await expect(page.getByRole('link', { name: SHELF })).toBeVisible();
    await expect(page.getByText(/^Čtu od /)).toBeVisible();
    await expect(page.getByText('Skvělý humor.')).toBeVisible();
  });

  await test.step('finish it with one tap', async () => {
    await page.getByRole('button', { name: 'Dočteno' }).click();
    await expect(page.getByText(/^Čteno .+ – /)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Dočteno' })).toBeHidden();
  });

  await test.step('see only the shelf’s books', async () => {
    await page.goto('/books/new');
    await page.getByLabel('Název').fill(OTHER_TITLE);
    await page.getByRole('button', { name: 'Uložit' }).click();
    await expect(page.getByRole('heading', { name: OTHER_TITLE })).toBeVisible();

    await page.getByRole('link', { name: 'Knihy', exact: true }).first().click();
    await expect(page.getByRole('link', { name: new RegExp(OTHER_TITLE) })).toBeVisible();
    await page
      .getByRole('navigation', { name: 'Poličky' })
      .getByRole('link', { name: SHELF })
      .click();
    await expect(page.getByRole('link', { name: new RegExp(SHELVED_TITLE) })).toBeVisible();
    await expect(page.getByRole('link', { name: new RegExp(OTHER_TITLE) })).toBeHidden();
  });

  await test.step('rename the shelf, then delete it', async () => {
    await page.getByRole('link', { name: 'Upravit poličky' }).click();
    await expect(page.getByRole('heading', { name: 'Poličky' })).toBeVisible();
    await expect(page.getByText('1 kniha')).toBeVisible();

    await page.getByRole('button', { name: `Upravit „${SHELF}“` }).click();
    await page.getByRole('dialog').getByLabel('Název').fill(RENAMED_SHELF);
    await page.getByRole('dialog').getByRole('button', { name: 'Uložit' }).click();
    await expect(page.getByRole('link', { name: new RegExp(RENAMED_SHELF) })).toBeVisible();

    await page.getByRole('button', { name: `Smazat „${RENAMED_SHELF}“` }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Smazat', exact: true }).click();
    await expect(page.getByText('Zatím nemáte žádnou poličku.')).toBeVisible();
  });
});
