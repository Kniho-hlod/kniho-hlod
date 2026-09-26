import '@fontsource-variable/inter';
import '@fontsource-variable/bricolage-grotesque';
import './assets/main.css';
import { createApp, watch } from 'vue';
import { createPinia } from 'pinia';
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import ui from '@nuxt/ui/vue-plugin';
import { ApiError } from '@eleansphere/entity-core';
import App from './App.vue';
import { router } from './app/router';
import { i18n } from './app/i18n';
import { onSessionExpired } from './app/api';
import { useSessionStore } from './features/auth/session-store';
import { listenForInstallPrompt } from './shared/install-prompt';

listenForInstallPrompt();

const MAX_QUERY_RETRIES = 2;
const STALE_TIME_MS = 30_000;

/** Retry only what a retry can fix: a wrong request or a missing row never gets better. */
function retryQuery(failureCount: number, error: Error): boolean {
  const isClientError = error instanceof ApiError && error.status < 500;
  return !isClientError && failureCount < MAX_QUERY_RETRIES;
}

const app = createApp(App);

app.use(createPinia());
app.use(i18n);
app.use(ui);
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: retryQuery, staleTime: STALE_TIME_MS } },
});
app.use(VueQueryPlugin, { queryClient });

const session = useSessionStore();

// Cached server data belongs to whoever was signed in; once that changes, none of it may show.
watch(
  () => session.user?.id,
  () => queryClient.clear()
);

onSessionExpired(() => {
  session.forget();
  void router.push({ name: 'sign-in' });
});

// The app shows its splash screen straight away; the router's first navigation waits for the
// stored session (see its guard), and the splash screen for that first page.
app.use(router);
app.mount('#app');
