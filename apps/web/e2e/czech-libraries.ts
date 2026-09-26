import type { Page } from '@playwright/test';

const SEARCH_URL = 'https://www.knihovny.cz/api/v1/search?';

/**
 * Answers the app's searches in knihovny.cz, which the browser asks itself, with these records.
 * The real API lets any web page read it, so the stand-in says the same.
 */
export async function answerFromCzechLibraries(page: Page, records: object[] = []): Promise<void> {
  await page.route(
    (url) => url.href.startsWith(SEARCH_URL),
    (route) =>
      route.fulfill({
        json: { status: 'OK', resultCount: records.length, records },
        headers: { 'Access-Control-Allow-Origin': '*' },
      })
  );
}
