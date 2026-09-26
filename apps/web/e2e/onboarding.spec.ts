import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { PASSWORD, uniqueEmail } from './accounts';

const SAMPLE_BOOKS = 8;
const STEP_TITLES = [
  'Tady máte přehled',
  'Knihy přidáte raz dva',
  'Poličky na všechno',
  'Kdo má kterou knihu?',
  'Termíny hlídám za vás',
  'A je to!',
];

function tour(page: Page) {
  return page.getByRole('region', { name: 'Průvodce aplikací' });
}

async function expectStep(page: Page, number: number): Promise<void> {
  await expect(tour(page).getByText(`Krok ${number} z ${STEP_TITLES.length}`)).toBeVisible();
  await expect(tour(page).getByRole('heading', { name: STEP_TITLES[number - 1] })).toBeVisible();
}

test('a new reader takes the tour with a sample library, then clears it out', async ({ page }) => {
  await test.step('register and be greeted', async () => {
    await page.goto('/register');
    await page.getByLabel('Jméno').fill('Nová Čtenářka');
    await page.getByLabel('E-mail').fill(uniqueEmail('tour'));
    await page.getByLabel('Heslo', { exact: true }).fill(PASSWORD);
    await page.getByRole('button', { name: 'Založit účet' }).click();

    const welcome = page.getByRole('dialog', { name: 'Vítejte v Kniho-hlodu!' });
    await expect(welcome).toBeVisible();
    await expect(welcome.getByRole('switch', { name: 'Naplnit knihovnu ukázkami' })).toBeChecked();
    await welcome.getByRole('button', { name: 'Provést mě' }).click();
  });

  await test.step('walk through every step, one back and forth', async () => {
    await expectStep(page, 1);
    await expect(page.getByRole('link', { name: `Knihy ${SAMPLE_BOOKS}` })).toBeVisible();

    await tour(page).getByRole('button', { name: 'Dál' }).click();
    await expectStep(page, 2);
    await expect(page).toHaveURL(/\/books$/);
    await expect(page.getByText(`Celkem: ${SAMPLE_BOOKS}`)).toBeVisible();
    await expect(page.getByText('Ukázka').first()).toBeVisible();

    await tour(page).getByRole('button', { name: 'Dál' }).click();
    await expectStep(page, 3);
    await tour(page).getByRole('button', { name: 'Dál' }).click();
    await expectStep(page, 4);
    await expect(page).toHaveURL(/\/loans$/);
    await expect(page.getByText('Saturnin')).toBeVisible();

    await tour(page).getByRole('button', { name: 'Zpět' }).click();
    await expectStep(page, 3);
    await tour(page).getByRole('button', { name: 'Dál' }).click();
    await expectStep(page, 4);

    await tour(page).getByRole('button', { name: 'Dál' }).click();
    await expectStep(page, 5);
    await expect(page).toHaveURL(/\/account$/);
    // Further down the page than the window reaches: the tour scrolls to it.
    await expect(page.locator('[data-tour="reminder-settings"]')).toBeInViewport();

    await tour(page).getByRole('button', { name: 'Dál' }).click();
    await expectStep(page, 6);
    await expect(tour(page).getByText('Ukázky smažete v Nastavení účtu')).toBeVisible();
    await tour(page).getByRole('button', { name: 'Hotovo' }).click();
    await expect(tour(page)).toBeHidden();
  });

  await test.step('the tour has been, so it does not greet again', async () => {
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Ahoj, Nová!' })).toBeVisible();
    await expect(page.getByRole('dialog')).toBeHidden();
  });

  await test.step('clear the samples out in the account settings', async () => {
    await page.goto('/account');
    await page.getByRole('button', { name: 'Smazat ukázková data' }).click();
    await expect(page.getByText('Opravdu smazat ukázky?')).toBeVisible();
    await page.getByRole('button', { name: 'Smazat ukázková data' }).click();
    await expect(
      page.getByText('Ukázky jsou pryč. Knihovna je celá vaše!', { exact: true })
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Ukázková data' })).toBeHidden();

    await page.goto('/books');
    await expect(page.getByText('Zatím tu nemáte žádnou knihu.')).toBeVisible();
  });

  await test.step('start the tour again from the account menu, and end it at once', async () => {
    await page.getByRole('button', { name: 'Účet a nastavení' }).click();
    await page.getByRole('menuitem', { name: 'Průvodce aplikací' }).click();

    const welcome = page.getByRole('dialog', { name: 'Vítejte v Kniho-hlodu!' });
    await expect(welcome.getByRole('switch', { name: 'Naplnit knihovnu ukázkami' })).toBeVisible();
    await welcome.getByRole('switch', { name: 'Naplnit knihovnu ukázkami' }).click();
    await welcome.getByRole('button', { name: 'Provést mě' }).click();
    await expectStep(page, 1);
    await tour(page).getByRole('button', { name: 'Ukončit průvodce' }).click();
    await expect(tour(page)).toBeHidden();
    await expect(page.getByRole('link', { name: 'Knihy 0' })).toBeVisible();
  });
});
