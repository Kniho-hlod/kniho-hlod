import type { RouteLocationRaw, Router } from 'vue-router';

/**
 * Returns to the page the reader came from — a form opened from a book, a contact or the loans
 * leads back there — or, opened directly, goes to `fallback`.
 */
export async function goBackOr(router: Router, fallback: RouteLocationRaw): Promise<void> {
  if (router.options.history.state.back) {
    router.back();
    return;
  }
  await router.push(fallback);
}
