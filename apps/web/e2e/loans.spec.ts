import { expect, test } from '@playwright/test';
import { addDays } from '@eleansphere/schema';
import { readerToday } from '@kniho-hlod/domain';

const PASSWORD = 'correct-horse-battery';
const BOOK_TITLE = 'Saturnin';
const BORROWER = 'Jana Nováková';
/** The toast; exact, because the toast region announces it again with a prefix. */
const BLOCKED_DELETE = 'Půjčenou knihu nejde smazat. Nejdřív ji označte jako vrácenou.';
/** A new reader's time zone is the default one, so this is the app's "today" too. */
const TODAY = readerToday(null);

function uniqueEmail(): string {
  return `e2e-loans-${Date.now()}-${Math.round(Math.random() * 1000)}@kniho-hlod.test`;
}

test('a reader lends a book, sees it overdue, gets it back and tidies up', async ({ page }) => {
  await test.step('register and add a book', async () => {
    await page.goto('/register');
    await page.getByLabel('Jméno').fill('Lender');
    await page.getByLabel('E-mail').fill(uniqueEmail());
    await page.getByLabel('Heslo').fill(PASSWORD);
    await page.getByRole('button', { name: 'Založit účet' }).click();
    await expect(page.getByRole('heading', { name: /Vítejte/ })).toBeVisible();

    await page.goto('/books/new');
    await page.getByLabel('Název').fill(BOOK_TITLE);
    await page.getByRole('button', { name: 'Uložit' }).click();
    await expect(page.getByRole('heading', { name: BOOK_TITLE })).toBeVisible();
    await expect(page.getByText('Kniha je doma.')).toBeVisible();
  });

  await test.step('lend it to someone new, already past the due date', async () => {
    await page.getByRole('link', { name: 'Půjčit', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Půjčit knihu' })).toBeVisible();

    await page.getByLabel('Komu').click();
    await page.getByPlaceholder('Hledat nebo napsat jméno').fill(BORROWER);
    await page.getByRole('option', { name: `Nový kontakt: ${BORROWER}` }).click();
    await page.getByLabel('Půjčeno dne').fill(addDays(TODAY, -10));
    await page.getByLabel('Vrátit do').fill(addDays(TODAY, -1));
    await page.getByRole('button', { name: 'Půjčit', exact: true }).click();

    await expect(page.getByRole('heading', { name: BOOK_TITLE })).toBeVisible();
    await expect(page.getByRole('link', { name: `Komu: ${BORROWER}` })).toBeVisible();
    await expect(page.getByText('Po termínu')).toBeVisible();
  });

  await test.step('a lent book cannot be deleted', async () => {
    await page.getByRole('button', { name: 'Smazat knihu' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Smazat', exact: true }).click();
    await expect(page.getByText(BLOCKED_DELETE, { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: BOOK_TITLE })).toBeVisible();
  });

  await test.step('the overview calls the loan out', async () => {
    await page.getByRole('link', { name: 'Přehled' }).first().click();
    await expect(page.getByRole('heading', { name: 'K vrácení' })).toBeVisible();
    await expect(page.getByRole('link', { name: BOOK_TITLE })).toBeVisible();
    await expect(page.getByRole('link', { name: /Po termínu\s*1/ })).toBeVisible();
  });

  await test.step('mark it returned from the loans', async () => {
    await page.getByRole('link', { name: 'Výpůjčky' }).first().click();
    await page.getByRole('button', { name: `Označit „${BOOK_TITLE}“ jako vrácenou` }).click();
    await expect(page.getByText(`„${BOOK_TITLE}“ je zpátky doma.`, { exact: true })).toBeVisible();
    await expect(page.getByText('Teď nemáte nic půjčeného.')).toBeVisible();

    await page.getByRole('tab', { name: 'Vrácené' }).click();
    await expect(page.getByRole('link', { name: BOOK_TITLE })).toBeVisible();
  });

  await test.step('the borrower keeps the history until deleted', async () => {
    await page.getByRole('link', { name: 'Kontakty' }).click();
    await page.getByRole('link', { name: BORROWER }).click();
    await expect(page.getByRole('heading', { name: BORROWER })).toBeVisible();
    await expect(page.getByText('Teď nemá nic půjčeného.')).toBeVisible();
    await expect(page.getByRole('link', { name: BOOK_TITLE })).toBeVisible();

    await page.getByRole('button', { name: 'Smazat kontakt' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Smazat', exact: true }).click();
    await expect(page.getByText(/Zatím nemáte žádné kontakty/)).toBeVisible();
  });
});
