import { readonly, ref } from 'vue';
import type { Release } from './releases';

/** Closed, the releases the reader hasn't seen yet, or every release. */
export type ReleaseNotesView =
  { view: 'closed' } | { view: 'news'; releases: readonly Release[] } | { view: 'history' };

const state = ref<ReleaseNotesView>({ view: 'closed' });

/**
 * The release notes' one state for the whole app: `WhatsNew` shows it and opens the news after an
 * update; the account menu and the account page open the history.
 */
export function useReleaseNotes() {
  return {
    state: readonly(state),
    showNews(releases: readonly Release[]): void {
      state.value = { view: 'news', releases };
    },
    showHistory(): void {
      state.value = { view: 'history' };
    },
    close(): void {
      state.value = { view: 'closed' };
    },
  };
}
