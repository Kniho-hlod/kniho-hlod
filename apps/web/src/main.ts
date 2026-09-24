import './assets/main.css';
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { VueQueryPlugin } from '@tanstack/vue-query';
import ui from '@nuxt/ui/vue-plugin';
import { ApiError } from '@eleansphere/entity-core';
import App from './App.vue';
import { router } from './app/router';
import { i18n } from './app/i18n';
import { onSessionExpired } from './app/api';
import { useSessionStore } from './features/auth/session-store';

const MAX_QUERY_RETRIES = 2;
const STALE_TIME_MS = 30_000;

/** Retry only what a retry can fix: a wrong request or a missing row never gets better. */
function retryQuery(failureCount: number, error: Error): boolean {
  const isClientError = error instanceof ApiError && error.status < 500;
  return !isClientError && failureCount < MAX_QUERY_RETRIES;
}

const app = createApp(App);

app.use(createPinia());
app.use(router);
app.use(i18n);
app.use(ui);
app.use(VueQueryPlugin, {
  queryClientConfig: {
    defaultOptions: { queries: { retry: retryQuery, staleTime: STALE_TIME_MS } },
  },
});

const session = useSessionStore();
onSessionExpired(() => {
  session.forget();
  void router.push({ name: 'sign-in' });
});

// Mount once we know whether anyone is signed in, so the first render is already the right one.
void session.restore().finally(() => app.mount('#app'));
