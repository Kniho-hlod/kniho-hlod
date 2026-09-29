import { expect, test } from '@playwright/test';
import { API_URL, register, signIn, uniqueEmail } from './accounts';

test("the overview's reading tile opens the books being read", async ({ page, request }) => {
  const email = uniqueEmail('reading-tile');
  const token = await register(request, email, 'Čtenářka');
  for (const [title, readingStatus] of [
    ['Krakatit', 'reading'],
    ['Saturnin', 'read'],
  ]) {
    const created = await request.post(`${API_URL}/api/books`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { title, readingStatus },
    });
    expect(created.ok()).toBe(true);
  }

  await signIn(page, email);
  await page.getByRole('link', { name: /Právě čtu/ }).click();

  await expect(page).toHaveURL(/\/books\?status=reading$/);
  await expect(page.getByRole('link', { name: /Krakatit/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Saturnin/ })).toBeHidden();
  await expect(page.getByText('Celkem: 1')).toBeVisible();
});
