import { AuthSession, createWebSessionStorage } from '@eleansphere/entity-core';
import type { FileDto } from '@eleansphere/entity-core';
import { createServices } from '@kniho-hlod/domain';

const SESSION_STORAGE_KEY = 'kniho-hlod.session';

export const apiBaseUrl: string = import.meta.env.VITE_API_URL;

let reportSessionExpired: () => void = () => undefined;

/**
 * Runs when the refresh token is rejected — the app has to send the user back to sign-in. Set once
 * during startup, after the router exists.
 */
export function onSessionExpired(handle: () => void): void {
  reportSessionExpired = handle;
}

/**
 * The stored tokens. The session reads and writes them on its own; the app reaches for the refresh
 * token only to revoke it when signing out.
 */
export const sessionStorage = createWebSessionStorage(SESSION_STORAGE_KEY);

/** The signed-in user's tokens; renews the access token behind every request. */
export const session = new AuthSession({
  baseUrl: apiBaseUrl,
  storage: sessionStorage,
  onSessionExpired: () => reportSessionExpired(),
});

/** One client per entity, sharing the session: `services.auth`, `services.systemNotifications`, … */
export const services = createServices(apiBaseUrl, session);

/**
 * Where the browser loads an uploaded file from. The API answers with an absolute CDN URL for
 * public files once a bucket has a public address, and otherwise with its own `/api/files/:id`
 * path — which lives on the API's origin, not the web app's.
 */
export function fileUrl(file: Pick<FileDto, 'url'> | null | undefined): string | undefined {
  if (!file) return undefined;
  return file.url.startsWith('/') ? `${apiBaseUrl}${file.url}` : file.url;
}
