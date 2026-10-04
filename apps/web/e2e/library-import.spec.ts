import { expect, test } from '@playwright/test';
import { register, signIn, uniqueEmail } from './accounts';

const GOODREADS_EXPORT = [
  'Book Id,Title,Author,Author l-f,Additional Authors,ISBN,ISBN13,My Rating,Average Rating,Publisher,Binding,Number of Pages,Year Published,Original Publication Year,Date Read,Date Added,Bookshelves,Bookshelves with positions,Exclusive Shelf,My Review,Spoiler,Private Notes,Read Count,Owned Copies',
  '1,Válka s mloky,Karel Čapek,"Čapek, Karel",,"=""""","=""""",5,4.1,Argo,Paperback,256,2009,1936,2024/03/05,2024/01/02,"klasika, read","klasika (#1), read (#2)",read,,,,1,1',
  '2,Krakatit,Karel Čapek,"Čapek, Karel",,"=""""","=""""",0,4.0,,,,,1924,,2024/01/02,"klasika, to-read","klasika (#2), to-read (#1)",to-read,,,,0,1',
].join('\n');

test('a Goodreads export goes into the library, on its shelves, once', async ({
  page,
  request,
}) => {
  const email = uniqueEmail('import');
  await register(request, email, 'Importér');
  await signIn(page, email);

  await page.goto('/books');
  await page.getByRole('link', { name: 'Importovat' }).click();
  await expect(page.getByRole('heading', { name: 'Import knihovny' })).toBeVisible();

  const upload = {
    name: 'goodreads_library_export.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(GOODREADS_EXPORT),
  };
  await page.locator('input[type="file"]').setInputFiles(upload);
  await expect(page.getByRole('heading', { name: 'Našli jsme 2 knihy' })).toBeVisible();
  await expect(page.getByText('1 přečtená')).toBeVisible();
  await page.getByRole('button', { name: 'Importovat 2 knihy' }).click();
  await expect(page.getByRole('heading', { name: 'Přidali jsme 2 knihy' })).toBeVisible();
  await expect(page.getByText('Založili jsme 1 novou poličku.')).toBeVisible();

  await page.getByRole('button', { name: 'Importovat další soubor' }).click();
  await page.locator('input[type="file"]').setInputFiles(upload);
  await page.getByRole('button', { name: 'Importovat 2 knihy' }).click();
  await expect(page.getByRole('heading', { name: 'Nic nového k přidání' })).toBeVisible();

  await page.getByRole('link', { name: 'Do knihovny' }).click();
  await expect(page.getByRole('link', { name: /^Válka s mloky/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /^Krakatit/ })).toBeVisible();
  await expect(page.getByText('Celkem: 2')).toBeVisible();

  // A small library offers the quick start until the reader hides it.
  const quickStart = page.getByRole('heading', { name: 'Rychle naplňte knihovnu' });
  await expect(quickStart).toBeVisible();
  await page.getByRole('button', { name: 'Skrýt rychlý start' }).click();
  await expect(quickStart).toBeHidden();
  await page.reload();
  await expect(page.getByText('Celkem: 2')).toBeVisible();
  await expect(quickStart).toBeHidden();
});
